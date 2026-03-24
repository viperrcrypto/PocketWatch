/**
 * Position-based historical chart projection engine.
 *
 * Projects current portfolio positions backward using historical token prices
 * from DeFiLlama. This fills the "DeFi cliff" gap where Zerion's chart API
 * only tracks wallet-held fungibles and misses DeFi deposits/staking.
 *
 * Core formula: projected_value[day] = sum(quantity[token] × price[token][day])
 */

import { createHash } from "node:crypto"
import { db } from "@/lib/db"
import { fetchMultiCoinChart, type ChartPricePoint } from "@/lib/defillama/chart"
import { NATIVE_COINGECKO_IDS } from "@/lib/tracker/chains"
import { isStableLikeSymbol, normalizeSymbolForPricing } from "@/lib/portfolio/price-symbol-utils"
import { fetchMultiWalletPositions, type ZerionPosition } from "@/lib/portfolio/zerion-client"
import { withProviderPermit } from "@/lib/portfolio/provider-governor"
import type { ChartPoint } from "@/lib/portfolio/snapshot-helpers"

// ─── Constants ───

const VALUE_COVERAGE_THRESHOLD = 0.95
const MAX_POSITIONS = 20
const PROJECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

// ─── Zerion chain → DeFiLlama chain mapping ───

const ZERION_TO_LLAMA_CHAIN: Record<string, string> = {
  ethereum: "ethereum",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  "binance-smart-chain": "bsc",
  bsc: "bsc",
  avalanche: "avax",
  linea: "linea",
  scroll: "scroll",
  "zksync-era": "era",
  solana: "solana",
}

// ─── Build DeFiLlama coin ID from Zerion position ───

export function buildLlamaCoinId(position: ZerionPosition): string | null {
  // Native tokens → use coingecko ID
  const upperSymbol = position.symbol.toUpperCase()
  const nativeCgId = NATIVE_COINGECKO_IDS[upperSymbol]
  if (nativeCgId && !position.contractAddress) {
    return nativeCgId
  }

  // Wrapped natives also use coingecko when no contract
  if (nativeCgId && position.contractAddress) {
    const llamaChain = ZERION_TO_LLAMA_CHAIN[position.chain]
    if (llamaChain) {
      return `${llamaChain}:${position.contractAddress}`
    }
    return nativeCgId
  }

  // ERC-20 / DeFi tokens → {chain}:{contractAddress}
  if (position.contractAddress) {
    const llamaChain = ZERION_TO_LLAMA_CHAIN[position.chain]
    if (llamaChain) {
      return `${llamaChain}:${position.contractAddress}`
    }
  }

  return null
}

// ─── Select significant positions covering threshold of total value ───

export function selectSignificantPositions(
  positions: ZerionPosition[],
  threshold = VALUE_COVERAGE_THRESHOLD,
): ZerionPosition[] {
  // Only consider positive-value positions for selection
  const positivePositions = positions.filter((p) => p.value > 0 && p.quantity > 0)
  const totalValue = positivePositions.reduce((sum, p) => sum + p.value, 0)
  if (totalValue <= 0) return []

  const sorted = [...positivePositions].sort((a, b) => b.value - a.value)

  const selected: ZerionPosition[] = []
  let accumulated = 0

  for (const position of sorted) {
    if (selected.length >= MAX_POSITIONS) break
    if (accumulated / totalValue >= threshold) break

    selected.push(position)
    accumulated += position.value
  }

  // Always include a few non-stablecoin positions for price history timestamps,
  // even if stablecoins already cover the value threshold
  const selectedSet = new Set(selected.map((p) => p.id))
  for (const position of sorted) {
    if (selected.length >= MAX_POSITIONS) break
    if (selectedSet.has(position.id)) continue
    const norm = normalizeSymbolForPricing(position.symbol)
    if (norm && isStableLikeSymbol(norm)) continue
    selected.push(position)
    selectedSet.add(position.id)
  }

  return selected
}

// ─── Project position values using historical prices ───

interface PositionWithCoinId {
  position: ZerionPosition
  coinId: string
  isStable: boolean
}

export function projectPositionValues(
  positionsWithIds: PositionWithCoinId[],
  priceHistory: Record<string, ChartPricePoint[]>,
  startTimestamp?: number,
): ChartPoint[] {
  if (positionsWithIds.length === 0) return []

  // Collect all unique timestamps from price data
  const timestampSet = new Set<number>()
  for (const points of Object.values(priceHistory)) {
    for (const point of points) {
      timestampSet.add(point.timestamp)
    }
  }

  // If no price history (e.g. stablecoin-only), generate daily timestamps
  if (timestampSet.size === 0 && startTimestamp) {
    const nowSec = Math.floor(Date.now() / 1000)
    for (let ts = startTimestamp; ts <= nowSec; ts += 86400) {
      timestampSet.add(ts)
    }
  }

  const timestamps = Array.from(timestampSet).sort((a, b) => a - b)
  if (timestamps.length === 0) return []

  // Build price lookup: coinId → timestamp → price
  const priceLookup = new Map<string, Map<number, number>>()
  for (const [coinId, points] of Object.entries(priceHistory)) {
    const tsMap = new Map<number, number>()
    for (const point of points) {
      tsMap.set(point.timestamp, point.price)
    }
    priceLookup.set(coinId, tsMap)
  }

  // For each timestamp, compute sum(quantity × price)
  const chartPoints: ChartPoint[] = []

  for (const ts of timestamps) {
    let dayValue = 0
    let hasAnyPrice = false

    for (const { position, coinId, isStable } of positionsWithIds) {
      if (isStable) {
        // Stablecoins: constant $1.00
        dayValue += position.quantity * 1.0
        hasAnyPrice = true
        continue
      }

      const priceAtTs = priceLookup.get(coinId)?.get(ts)
      if (priceAtTs !== undefined && priceAtTs > 0) {
        dayValue += position.quantity * priceAtTs
        hasAnyPrice = true
      }
    }

    if (hasAnyPrice && dayValue > 0) {
      chartPoints.push({
        timestamp: ts,
        value: dayValue,
        source: "projected",
      })
    }
  }

  return chartPoints
}

// ─── Orchestrator: select → fetch prices → compute values ───

export interface ProjectionResult {
  points: ChartPoint[]
  positionCount: number
  coinIds: string[]
}

export async function computeProjectedChart(
  positions: ZerionPosition[],
  startTimestamp: number,
  opts?: { userId?: string },
): Promise<ProjectionResult> {
  const significant = selectSignificantPositions(positions)
  if (significant.length === 0) {
    return { points: [], positionCount: 0, coinIds: [] }
  }

  // Map positions to DeFiLlama coin IDs
  const positionsWithIds: PositionWithCoinId[] = []
  const coinIdSet = new Set<string>()

  for (const position of significant) {
    const normalized = normalizeSymbolForPricing(position.symbol)
    const isStable = normalized !== null && isStableLikeSymbol(normalized)

    if (isStable) {
      positionsWithIds.push({ position, coinId: "stable", isStable: true })
      continue
    }

    const coinId = buildLlamaCoinId(position)
    if (!coinId) continue

    positionsWithIds.push({ position, coinId, isStable: false })
    coinIdSet.add(coinId)
  }

  if (positionsWithIds.length === 0) {
    return { points: [], positionCount: 0, coinIds: [] }
  }

  const coinIds = Array.from(coinIdSet)
  console.info(`[projected] ${significant.length} positions → ${positionsWithIds.length} mapped, ${coinIds.length} unique coins`)

  // Fetch historical prices from DeFiLlama
  const chartData = await fetchMultiCoinChart(coinIds, startTimestamp, {
    userId: opts?.userId,
  })

  // Extract price arrays
  const priceHistory: Record<string, ChartPricePoint[]> = {}
  for (const [coinId, data] of Object.entries(chartData.coins)) {
    if (data.prices && data.prices.length > 0) {
      priceHistory[coinId] = data.prices
    }
  }

  const points = projectPositionValues(positionsWithIds, priceHistory, startTimestamp)

  return {
    points,
    positionCount: positionsWithIds.length,
    coinIds,
  }
}

// ─── Fetch & cache projected chart ───

const DAY_SEC = 86400
const BATCH_SIZE = 500

interface FetchProjectedChartParams {
  userId: string
  zerionKey: string | null
  addresses: string[]
  walletFingerprint: string
  nowSec: number
}

export async function fetchProjectedChart(params: FetchProjectedChartParams): Promise<ChartPoint[]> {
  const { userId, zerionKey, addresses, walletFingerprint, nowSec } = params

  if (!zerionKey || addresses.length === 0) return []

  // Check for cached projection with matching fingerprint
  const cacheCutoff = new Date(Date.now() - PROJECTION_CACHE_TTL_MS)
  const cachedRows = await db.projectedChartCache.findMany({
    where: { userId, walletFingerprint, computedAt: { gte: cacheCutoff } },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, value: true },
  })

  if (cachedRows.length > 0) {
    return cachedRows.map((r) => ({
      timestamp: r.timestamp,
      value: r.value,
      source: "projected",
    }))
  }

  // Compute projection: fetch current positions, project backward
  try {
    const opHash = createHash("sha256").update(walletFingerprint).digest("hex").slice(0, 16)
    const { wallets } = await withProviderPermit(
      userId,
      "zerion",
      `positions:projected:${opHash}`,
      undefined,
      () => fetchMultiWalletPositions(zerionKey, addresses),
    )

    const allPositions = wallets.flatMap((w) => w.positions)
    if (allPositions.length === 0) return []

    const startTimestamp = nowSec - 365 * DAY_SEC
    const result = await computeProjectedChart(allPositions, startTimestamp, { userId })
    if (result.points.length === 0) return []

    // Cache the projection
    await db.$transaction(async (tx) => {
      await tx.projectedChartCache.deleteMany({ where: { userId } })
      for (let i = 0; i < result.points.length; i += BATCH_SIZE) {
        const batch = result.points.slice(i, i + BATCH_SIZE)
        await tx.projectedChartCache.createMany({
          data: batch.map((p) => ({
            userId,
            timestamp: p.timestamp,
            value: p.value,
            walletFingerprint,
          })),
          skipDuplicates: true,
        })
      }
    })

    console.info(
      `[snapshots] Projected chart cached: ${result.points.length} pts, ${result.positionCount} positions`
    )
    return result.points
  } catch (error) {
    console.warn("[snapshots] Projected chart computation failed (non-fatal):", error)
    return []
  }
}
