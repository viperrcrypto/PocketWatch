/**
 * PocketLLM portfolio (crypto) read tool executors.
 *
 * Mirrors the read paths of the matching API routes under src/app/api/portfolio/
 * (balances, staking, history/snapshots) plus a realized-PnL aggregate from
 * RealizedGain, and a non-destructive refresh kick. All reads are scoped by the
 * dispatcher's server-session userId — never from tool args. External token /
 * protocol strings are run through the sanitizer before being serialized into
 * the model context. Numeric amounts are kept as raw numbers.
 */

import { db } from "@/lib/db"
import { buildStakingResponse } from "@/lib/portfolio/staking/route-helpers"
import {
  getRefreshMeta,
  queuePortfolioRefresh,
  runPortfolioRefreshJob,
} from "@/lib/portfolio/refresh-orchestrator"
import { buildBalancesForUser } from "@/lib/portfolio/balances-read"
import { cleanText, cleanTextOrNull } from "./sanitize"
import { z } from "zod/v4"

type ToolInput = Record<string, unknown>

const TOP_HOLDINGS = 25
const MAX_STAKING = 25
const MAX_HISTORY_POINTS = 120

interface RawPosition {
  symbol?: unknown
  name?: unknown
  chain?: unknown
  value?: unknown
  quantity?: unknown
  positionType?: unknown
  protocol?: unknown
  exchange?: unknown
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** get_portfolio_balances — compact top-N crypto holdings by USD value. */
export async function getPortfolioBalances(userId: string): Promise<string> {
  const data = (await buildBalancesForUser(userId)) as {
    error?: string
    message?: string
    positions?: RawPosition[]
    totalValue?: number
    onchainTotalValue?: number
    exchangeTotalValue?: number
    chainDistribution?: Record<string, number>
  }

  if (data.error) {
    return JSON.stringify({ type: "holdings", holdings: [], error: cleanText(String(data.message ?? data.error)) })
  }

  const positions = Array.isArray(data.positions) ? data.positions : []
  const sorted = [...positions].sort((a, b) => num(b.value) - num(a.value))
  const top = sorted.slice(0, TOP_HOLDINGS)

  const holdings = top.map((p) => ({
    symbol: cleanText(String(p.symbol ?? "?")),
    name: cleanText(String(p.name ?? "Unknown")),
    chain: cleanText(String(p.chain ?? "unknown")),
    positionType: cleanTextOrNull(p.positionType == null ? null : String(p.positionType)),
    protocol: cleanTextOrNull(p.protocol == null ? null : String(p.protocol)),
    quantity: num(p.quantity),
    value: round2(num(p.value)),
  }))

  const chainDistribution = data.chainDistribution
    ? Object.fromEntries(
        Object.entries(data.chainDistribution).map(([chain, value]) => [cleanText(chain), round2(num(value))]),
      )
    : {}

  return JSON.stringify({
    type: "holdings",
    holdings,
    totalValue: round2(num(data.totalValue)),
    onchainTotalValue: round2(num(data.onchainTotalValue)),
    exchangeTotalValue: round2(num(data.exchangeTotalValue)),
    chainDistribution,
    shown: holdings.length,
    totalPositions: positions.length,
  })
}

interface RawStakingPosition {
  symbol?: unknown
  name?: unknown
  chain?: unknown
  protocol?: unknown
  value?: unknown
  quantity?: unknown
  apy?: unknown
  annualYield?: unknown
}

/** get_staking_positions — active staking/DeFi yield positions (compact). */
export async function getStakingPositions(userId: string): Promise<string> {
  const data = (await buildStakingResponse(userId)) as {
    positions?: RawStakingPosition[]
    totalStaked?: number
    activePositions?: number
    totalAnnualYield?: number
    avgApy?: number
    totalRewardsValue?: number
  }

  const positions = Array.isArray(data.positions) ? data.positions : []
  const top = positions.slice(0, MAX_STAKING).map((p) => ({
    symbol: cleanText(String(p.symbol ?? "?")),
    name: cleanText(String(p.name ?? "Unknown")),
    chain: cleanText(String(p.chain ?? "unknown")),
    protocol: cleanTextOrNull(p.protocol == null ? null : String(p.protocol)),
    quantity: num(p.quantity),
    value: round2(num(p.value)),
    apy: p.apy == null ? null : round2(num(p.apy)),
    annualYield: p.annualYield == null ? null : round2(num(p.annualYield)),
  }))

  return JSON.stringify({
    positions: top,
    totalStaked: round2(num(data.totalStaked)),
    activePositions: num(data.activePositions),
    totalAnnualYield: round2(num(data.totalAnnualYield)),
    avgApy: round2(num(data.avgApy)),
    totalRewardsValue: round2(num(data.totalRewardsValue)),
    shown: top.length,
    totalPositions: positions.length,
  })
}

/** get_wallet_pnl — realized PnL aggregated from RealizedGain (userId-scoped). */
export async function getWalletPnl(userId: string): Promise<string> {
  const gains = await db.realizedGain.findMany({
    where: { userId },
    select: { symbol: true, gainUsd: true, proceedsUsd: true, costBasisUsd: true },
    take: 5000,
  })

  if (gains.length === 0) {
    return JSON.stringify({ realizedPnl: 0, disposals: 0, byAsset: [], message: "No realized gains recorded yet." })
  }

  const bySymbol = new Map<string, { gainUsd: number; proceedsUsd: number; costBasisUsd: number; disposals: number }>()
  let totalGain = 0
  let totalProceeds = 0
  let totalCost = 0

  for (const g of gains) {
    const symbol = cleanText(g.symbol || "?")
    const entry = bySymbol.get(symbol) ?? { gainUsd: 0, proceedsUsd: 0, costBasisUsd: 0, disposals: 0 }
    entry.gainUsd += g.gainUsd
    entry.proceedsUsd += g.proceedsUsd
    entry.costBasisUsd += g.costBasisUsd
    entry.disposals += 1
    bySymbol.set(symbol, entry)
    totalGain += g.gainUsd
    totalProceeds += g.proceedsUsd
    totalCost += g.costBasisUsd
  }

  const byAsset = [...bySymbol.entries()]
    .map(([symbol, v]) => ({
      symbol,
      realizedPnl: round2(v.gainUsd),
      proceeds: round2(v.proceedsUsd),
      costBasis: round2(v.costBasisUsd),
      disposals: v.disposals,
    }))
    .sort((a, b) => b.realizedPnl - a.realizedPnl)

  return JSON.stringify({
    realizedPnl: round2(totalGain),
    totalProceeds: round2(totalProceeds),
    totalCostBasis: round2(totalCost),
    disposals: gains.length,
    byAsset,
  })
}

const RANGE_DAYS: Record<string, number> = { "1D": 1, "1W": 7, "1M": 30, "3M": 90, "1Y": 365, ALL: 36500 }

const historySchema = z.object({
  range: z.enum(["1D", "1W", "1M", "3M", "1Y", "ALL"]).default("1M"),
})

/** get_portfolio_history — net-worth series points for a range (userId-scoped). */
export async function getPortfolioHistory(userId: string, input: ToolInput): Promise<string> {
  const parsed = historySchema.safeParse(input)
  const range = parsed.success ? parsed.data.range : "1M"
  const days = RANGE_DAYS[range]
  const since = new Date(Date.now() - days * 86_400_000)

  const snapshots = await db.portfolioSnapshot.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { totalValue: true, createdAt: true },
    take: 2000,
  })

  if (snapshots.length === 0) {
    return JSON.stringify({ range, points: [], message: "No portfolio history in this range." })
  }

  // Downsample to a compact series if there are many points.
  const step = Math.max(1, Math.ceil(snapshots.length / MAX_HISTORY_POINTS))
  const sampled = snapshots.filter((_, i) => i % step === 0 || i === snapshots.length - 1)

  const points = sampled.map((s) => ({
    date: s.createdAt.toISOString(),
    value: round2(s.totalValue),
  }))

  const first = points[0].value
  const last = points[points.length - 1].value

  return JSON.stringify({
    range,
    points,
    first,
    last,
    changeUsd: round2(last - first),
    changePercent: first > 0 ? round2(((last - first) / first) * 100) : 0,
    shown: points.length,
  })
}

/** trigger_portfolio_refresh — kick the existing refresh job (non-destructive). */
export async function triggerPortfolioRefresh(userId: string): Promise<string> {
  const refresh = await queuePortfolioRefresh(userId, { reason: "pocketllm_chat" })
  // Respect the freshness TTL: if data is already fresh, don't actually run a full
  // multi-provider refresh just because the model called the tool again this turn.
  if (refresh.queued && refresh.jobId && refresh.reason !== "fresh_within_ttl") {
    void runPortfolioRefreshJob(refresh.jobId).catch((err) => {
      console.warn("[portfolio-tools] Async refresh job failed:", err)
    })
  }
  const meta = await getRefreshMeta(userId)
  return JSON.stringify({
    queued: refresh.queued,
    skipped: refresh.skipped,
    reason: refresh.reason,
    nextEligibleRefreshAt: refresh.nextEligibleRefreshAt,
    meta,
  })
}
