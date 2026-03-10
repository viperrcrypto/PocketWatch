/**
 * Position enrichment helpers for the staking API route.
 * Handles yield enrichment, price fallbacks, lifecycle sync, and active/inactive splitting.
 */

import { getCurrentPrices, type TokenPriceInput } from "@/lib/defillama"
import { KNOWN_LST_COIN_IDS } from "@/lib/portfolio/defi-yields"
import { ZERION_CHAIN_ID_MAP } from "@/lib/portfolio/multi-chain-client"
import {
  resolveYield,
  resolveAaveRewards,
  type RewardItem,
} from "@/lib/portfolio/yields"
import { getEtherFiVaultBalances } from "@/lib/portfolio/yields/etherfi-vaults"
import {
  buildPositionKey,
  getFrozenPositionKeys,
  syncStakingLifecycle,
  type LifecyclePositionInput,
  type RewardLike,
} from "@/lib/portfolio/staking-lifecycle"
import type { EnrichedPosition } from "./route-helpers"

// Reverse map: EVM chain ID -> DeFiLlama chain slug
const CHAIN_ID_TO_LLAMA: Record<number, string> = Object.fromEntries(
  Object.entries(ZERION_CHAIN_ID_MAP).map(([name, id]) => [id, name]),
)

// ─── Vault position merging ───

export function mergeVaultPositions(
  allPositions: EnrichedPosition[],
  vaultPositions: Awaited<ReturnType<typeof getEtherFiVaultBalances>>,
): void {
  for (const vp of vaultPositions) {
    const existingIdx = allPositions.findIndex(
      (p) => p.wallet === vp.wallet && p.protocol === "EtherFi"
        && p.symbol.toLowerCase() === vp.symbol.toLowerCase(),
    )

    const vaultEnriched: EnrichedPosition = {
      id: `vault-${vp.symbol}-${vp.wallet}`,
      positionKey: buildPositionKey({
        wallet: vp.wallet, chain: vp.chain, protocol: "EtherFi",
        symbol: vp.symbol, contractAddress: vp.contractAddress,
      }),
      symbol: vp.symbol, name: vp.vault, chain: vp.chain,
      quantity: vp.quantity, price: vp.price, value: vp.value,
      iconUrl: null, positionType: "staked",
      contractAddress: vp.contractAddress,
      protocolIcon: null, protocolUrl: null, isDefi: true,
      wallet: vp.wallet, protocol: "EtherFi",
      defiProject: "ether.fi-liquid", underlying: "ETH",
      apy: null, apyBase: null, apyReward: null,
      dailyYield: null, annualYield: null, yieldSource: null,
      pnl: null, pnlPercent: null, maturityDate: null,
    }

    if (existingIdx === -1) {
      allPositions.push(vaultEnriched)
    } else if (allPositions[existingIdx].value === 0) {
      allPositions[existingIdx] = { ...allPositions[existingIdx], ...vaultEnriched }
    }
  }
}

// ─── Yield enrichment ───

export async function enrichWithYields(
  stakingPositions: EnrichedPosition[],
  frozenPositionKeys: Set<string>,
  userId: string,
): Promise<EnrichedPosition[]> {
  const yieldPromises = stakingPositions
    .filter((p) => p.defiProject && !frozenPositionKeys.has(p.positionKey))
    .map(async (p) => {
      try {
        const result = await resolveYield({
          defiProject: p.defiProject, chain: p.chain, symbol: p.symbol,
          underlying: p.underlying, contractAddress: p.contractAddress,
          value: p.value, userId,
        })
        if (result) {
          return {
            id: p.id,
            apy: result.totalApy, apyBase: result.apyBase, apyReward: result.apyReward,
            dailyYield: p.value * (result.totalApy / 365 / 100),
            annualYield: p.value * (result.totalApy / 100),
            yieldSource: result.source,
            pnl: result.pnl, pnlPercent: result.pnlPercent,
            maturityDate: result.maturityDate,
            vaultRate: result.vaultRate ?? null,
            pendleMarketAddress: result.marketAddress ?? null,
          }
        }
      } catch (err) {
        console.warn(`[staking] Yield fetch failed for ${p.symbol}:`, err)
      }
      return null
    })

  const yieldResults = await Promise.all(yieldPromises)

  const yieldMap = new Map(
    yieldResults
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => [r.id, r]),
  )

  return stakingPositions.map((p) => {
    const yieldData = yieldMap.get(p.id)
    if (!yieldData) return p
    return {
      ...p,
      apy: yieldData.apy, apyBase: yieldData.apyBase, apyReward: yieldData.apyReward,
      dailyYield: yieldData.dailyYield, annualYield: yieldData.annualYield,
      yieldSource: yieldData.yieldSource,
      pnl: yieldData.pnl, pnlPercent: yieldData.pnlPercent,
      maturityDate: yieldData.maturityDate,
      vaultRate: yieldData.vaultRate ?? null,
      pendleMarketAddress: yieldData.pendleMarketAddress ?? p.pendleMarketAddress ?? null,
    }
  })
}

// ─── Zero-price LST fallback ───

export async function applyPriceFallback(
  positions: EnrichedPosition[],
  userId: string,
): Promise<EnrichedPosition[]> {
  const zeroPriceSymbols = positions
    .filter((p) => p.value === 0 && p.quantity > 0 && KNOWN_LST_COIN_IDS[p.symbol.toUpperCase()])
    .map((p) => p.symbol.toUpperCase())

  if (zeroPriceSymbols.length === 0) return positions

  try {
    const tokens: TokenPriceInput[] = zeroPriceSymbols.map((sym) => {
      const coinId = KNOWN_LST_COIN_IDS[sym]
      const colonIdx = coinId.indexOf(":")
      return { chain: coinId.slice(0, colonIdx), address: coinId.slice(colonIdx + 1) }
    })

    const priceData = await getCurrentPrices(tokens, { userId })
    const priceMap = new Map<string, number>()
    for (const sym of zeroPriceSymbols) {
      const coinId = KNOWN_LST_COIN_IDS[sym]
      const entry = priceData.coins[coinId]
      if (entry?.price) {
        console.log(`[staking] DeFiLlama fallback: ${sym} $0 → $${entry.price.toFixed(4)}`)
        priceMap.set(sym, entry.price)
      }
    }

    if (priceMap.size > 0) {
      return positions.map((p) => {
        const price = priceMap.get(p.symbol.toUpperCase())
        if (!price || p.value !== 0) return p
        const newValue = p.quantity * price
        return {
          ...p, price, value: newValue,
          dailyYield: p.apy ? newValue * (p.apy / 365 / 100) : p.dailyYield,
          annualYield: p.apy ? newValue * (p.apy / 100) : p.annualYield,
        }
      })
    }
  } catch (err) {
    console.warn("[staking] DeFiLlama price fallback failed:", err)
  }

  return positions
}

// ─── Pendle valuation override ───

/** Skip override when Zerion and Pendle agree within this USD threshold. */
const PENDLE_VALUE_DRIFT_THRESHOLD_USD = 1

/**
 * Override Zerion's value with Pendle API's authoritative valuation for active Pendle positions.
 * Recalculates dailyYield/annualYield when value changes. Returns new array (immutable).
 */
export function applyPendleValuations(
  positions: EnrichedPosition[],
  valuations: Map<string, number>,
): EnrichedPosition[] {
  if (valuations.size === 0) return positions

  return positions.map((p) => {
    if (p.defiProject !== "pendle" || !p.pendleMarketAddress) return p
    const chainId = ZERION_CHAIN_ID_MAP[p.chain?.toLowerCase()]
    if (!chainId) return p

    const key = `${chainId}:${p.pendleMarketAddress.toLowerCase()}`
    const pendleValue = valuations.get(key)
    if (pendleValue === undefined || Math.abs(pendleValue - p.value) <= PENDLE_VALUE_DRIFT_THRESHOLD_USD) return p

    console.log(`[staking] Pendle valuation override: ${p.symbol} $${p.value.toFixed(2)} → $${pendleValue.toFixed(2)}`)
    return {
      ...p,
      value: pendleValue,
      dailyYield: p.apy ? pendleValue * (p.apy / 365 / 100) : p.dailyYield,
      annualYield: p.apy ? pendleValue * (p.apy / 100) : p.annualYield,
    }
  })
}

// ─── Lifecycle sync ───

export async function runLifecycleSync(
  userId: string,
  priceCorrected: EnrichedPosition[],
  zerionRewards: EnrichedPosition[],
  frozenPositionKeys: Set<string>,
  stakingPositions: EnrichedPosition[],
  walletAddresses: string[],
) {
  let lifecycle: Awaited<ReturnType<typeof syncStakingLifecycle>> = {
    metricsByKey: new Map(),
    closedRows: [],
    summary: {
      yieldEarnedAllTimeUsd: 0, yieldEarnedYtdUsd: 0, yearlyYield: [],
      coverage: { exactPct: 0, modeledPct: 0, estimatedPct: 0 },
      counts: { exact: 0, modeled: 0, estimated: 0, total: 0 },
    },
  }

  const aavePositionsByChain = new Map<number, string[]>()
  for (const p of stakingPositions) {
    if (frozenPositionKeys.has(p.positionKey)) continue
    if (p.defiProject !== "aave-v3" || !p.contractAddress) continue
    const chainId = ZERION_CHAIN_ID_MAP[p.chain?.toLowerCase()]
    if (!chainId) continue
    const existing = aavePositionsByChain.get(chainId) ?? []
    existing.push(p.contractAddress)
    aavePositionsByChain.set(chainId, existing)
  }

  const getRewardUsdPrice = async (
    chainId: number, tokenAddress: string, _symbol: string,
  ): Promise<number | null> => {
    const llamaChain = CHAIN_ID_TO_LLAMA[chainId]
    if (!llamaChain) return null
    try {
      const priceData = await getCurrentPrices([{ chain: llamaChain, address: tokenAddress }], { userId })
      const coinId = `${llamaChain}:${tokenAddress.toLowerCase()}`
      return priceData.coins[coinId]?.price ?? null
    } catch {
      return null
    }
  }

  const onChainRewards: RewardItem[] = aavePositionsByChain.size > 0
    ? await resolveAaveRewards(
        Array.from(aavePositionsByChain.entries()).map(([chainId, addrs]) => ({
          chainId, aTokenAddresses: addrs,
        })),
        walletAddresses, getRewardUsdPrice,
      )
    : []

  try {
    const lifecycleInputs: LifecyclePositionInput[] = priceCorrected.map((p) => ({
      positionKey: p.positionKey, wallet: p.wallet, chain: p.chain,
      symbol: p.symbol, name: p.name, protocol: p.protocol,
      defiProject: p.defiProject, underlying: p.underlying,
      contractAddress: p.contractAddress, quantity: p.quantity,
      price: p.price, value: p.value, apy: p.apy,
      apyBase: p.apyBase, apyReward: p.apyReward,
      annualYield: p.annualYield, dailyYield: p.dailyYield,
      maturityDate: p.maturityDate, yieldSource: p.yieldSource,
      vaultRate: p.vaultRate ?? null,
    }))

    const rewardInputs: RewardLike[] = [
      ...zerionRewards.map((r) => ({
        wallet: r.wallet, symbol: r.symbol, usdValue: r.value, source: "zerion",
      })),
      ...onChainRewards.map((r) => ({
        wallet: r.wallet ?? null, symbol: r.symbol, usdValue: r.usdValue, source: r.source,
      })),
    ]

    lifecycle = await syncStakingLifecycle(userId, lifecycleInputs, rewardInputs)
  } catch (err) {
    console.warn("[staking] Lifecycle sync failed:", err)
  }

  return { lifecycle, onChainRewards }
}

// ─── Lifecycle metric application ───

export function applyLifecycleMetrics(
  priceCorrected: EnrichedPosition[],
  lifecycle: Awaited<ReturnType<typeof syncStakingLifecycle>>,
  rebuildInProgress: boolean,
): EnrichedPosition[] {
  return priceCorrected.map((p) => {
    const metrics = lifecycle.metricsByKey.get(p.positionKey)
    if (!metrics) {
      return {
        ...p,
        yieldMetricsState: rebuildInProgress ? "recomputing" : "insufficient_history",
        yieldMetricsReason: rebuildInProgress ? "Rebuild in progress" : "Waiting for transaction reconstruction",
      }
    }
    return {
      ...p,
      status: metrics.status,
      openedAt: metrics.openedAt,
      closedAt: metrics.closedAt,
      dataConfidence: metrics.dataConfidence,
      confidenceReason: metrics.confidenceReason,
      depositedUsd: metrics.depositedUsd,
      withdrawnUsd: metrics.withdrawnUsd,
      claimedUsd: metrics.claimedUsd,
      principalUsd: metrics.principalUsd,
      yieldEarnedUsd: metrics.yieldEarnedUsd,
      yieldEarnedPct: metrics.yieldEarnedPct,
      cacheState: metrics.cacheState,
      lastValidatedAt: metrics.lastValidatedAt,
      freezeConfidence: metrics.freezeConfidence,
      isFrozen: metrics.isFrozen,
      yieldMetricsState: rebuildInProgress ? "recomputing" : metrics.yieldMetricsState,
      yieldMetricsReason: rebuildInProgress ? "Rebuild in progress" : metrics.yieldMetricsReason,
      annualYield: p.annualYield ?? (p.apy ? p.value * (p.apy / 100) : null),
      dailyYield: p.dailyYield ?? (p.apy ? p.value * (p.apy / 365 / 100) : null),
      excludeFromYield: metrics.excludeFromYield,
    }
  })
}

// ─── Cached closed positions ───

export function buildCachedClosed(
  closedRows: Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any -- DB rows
  currentPositionKeys: Set<string>,
  rebuildInProgress: boolean,
): EnrichedPosition[] {
  return closedRows
    .filter((row) => !currentPositionKeys.has(row.positionKey))
    .map((row) => ({
      id: `cached-${row.positionKey}`,
      positionKey: row.positionKey, symbol: row.symbol,
      name: row.name, chain: row.chain,
      quantity: row.quantity, price: row.price, value: row.value,
      iconUrl: null, positionType: "staked",
      contractAddress: row.contractAddress,
      protocolIcon: null, protocolUrl: null, isDefi: true,
      wallet: row.wallet, protocol: row.protocol,
      defiProject: row.providerSlug ?? null,
      underlying: row.underlying,
      apy: row.apy, apyBase: row.apyBase, apyReward: row.apyReward,
      dailyYield: row.dailyYield, annualYield: row.annualYield,
      yieldSource: null, pnl: null, pnlPercent: null, maturityDate: null,
      status: row.status, openedAt: row.openedAt, closedAt: row.closedAt,
      dataConfidence: row.dataConfidence, confidenceReason: row.confidenceReason,
      depositedUsd: row.depositedUsd, withdrawnUsd: row.withdrawnUsd,
      claimedUsd: row.claimedUsd, principalUsd: row.principalUsd,
      yieldEarnedUsd: row.yieldEarnedUsd, yieldEarnedPct: row.yieldEarnedPct,
      cacheState: row.cacheState, lastValidatedAt: row.lastValidatedAt,
      freezeConfidence: row.freezeConfidence, isFrozen: row.isFrozen,
      yieldMetricsState: rebuildInProgress ? "recomputing" : row.yieldMetricsState,
      yieldMetricsReason: rebuildInProgress ? "Rebuild in progress" : row.yieldMetricsReason,
      excludeFromYield: !!row.excludeFromYield,
    }))
}

// ─── Active/inactive split ───

export function splitActiveInactive(
  withLifecycle: EnrichedPosition[],
  cachedClosed: EnrichedPosition[],
) {
  function isInactive(p: EnrichedPosition): boolean {
    if (p.cacheState === "frozen" || p.status === "closed") return true
    if (p.maturityDate && new Date(p.maturityDate) < new Date()) return true
    if (p.quantity <= 0) return true
    return false
  }

  const active = withLifecycle.filter((p) => !isInactive(p))
  const inactiveMap = new Map<string, EnrichedPosition>()
  for (const row of withLifecycle.filter((p) => isInactive(p))) inactiveMap.set(row.positionKey, row)
  for (const row of cachedClosed) inactiveMap.set(row.positionKey, row)
  const inactive = [...inactiveMap.values()]

  return {
    sortedActive: [...active].sort((a, b) => b.value - a.value),
    sortedInactive: [...inactive].sort((a, b) => b.value - a.value),
  }
}
