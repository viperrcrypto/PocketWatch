/**
 * DB record conversion, frozen keys, and symbol alias helpers for staking positions.
 */

import { db } from "@/lib/db"
import { buildPositionKey } from "./constants"
import type {
  LifecyclePositionRecord,
  StakingDataConfidence,
  YieldMetricsState,
} from "./types"

// ─── Prisma delegate type ───
type PrismaClient = typeof db & Record<string, any>

// ─── DB record conversion ───

export function toRecordFromDb(row: Record<string, unknown>): LifecyclePositionRecord {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>
  const yieldMetricsStateRaw = typeof metadata.yieldMetricsState === "string"
    ? metadata.yieldMetricsState
    : undefined
  const yieldMetricsState: YieldMetricsState = yieldMetricsStateRaw === "valid"
    || yieldMetricsStateRaw === "recomputing"
    || yieldMetricsStateRaw === "insufficient_history"
    ? yieldMetricsStateRaw
    : "insufficient_history"
  const yieldMetricsReason = typeof metadata.yieldMetricsReason === "string"
    ? metadata.yieldMetricsReason
    : null

  return {
    positionKey: row.positionKey as string,
    wallet: row.wallet as string,
    chain: row.chain as string,
    symbol: row.symbol as string,
    name: row.name as string,
    protocol: (row.protocol as string | null) ?? null,
    providerSlug: (row.providerSlug as string | null) ?? null,
    contractAddress: (row.contractAddress as string | null) ?? null,
    underlying: (row.underlying as string | null) ?? null,
    quantity: row.quantity as number,
    price: row.priceUsd as number,
    value: row.valueUsd as number,
    apy: (row.apy as number | null) ?? null,
    apyBase: (row.apyBase as number | null) ?? null,
    apyReward: (row.apyReward as number | null) ?? null,
    dailyYield: (row.dailyYield as number | null) ?? null,
    annualYield: (row.annualYield as number | null) ?? null,
    status: row.status as "active" | "closed",
    openedAt: row.openedAt ? new Date(row.openedAt as string | number).toISOString() : null,
    closedAt: row.closedAt ? new Date(row.closedAt as string | number).toISOString() : null,
    dataConfidence: row.dataConfidence as StakingDataConfidence,
    confidenceReason: (row.confidenceReason as string) ?? "",
    depositedUsd: row.depositedUsd as number,
    withdrawnUsd: row.withdrawnUsd as number,
    claimedUsd: row.claimedUsd as number,
    principalUsd: row.principalUsd as number,
    yieldEarnedUsd: row.yieldEarnedUsd as number,
    yieldEarnedPct: (row.yieldEarnedPct as number | null) ?? null,
    cacheState: row.cacheState as "live" | "frozen",
    lastValidatedAt: row.lastValidatedAt ? new Date(row.lastValidatedAt as string | number).toISOString() : new Date(0).toISOString(),
    freezeConfidence: (row.freezeConfidence as StakingDataConfidence | null) ?? null,
    isFrozen: !!(row.isFrozen),
    yieldMetricsState,
    yieldMetricsReason,
    excludeFromYield: !!(row.excludeFromYield),
  }
}

// ─── Frozen keys ───

export async function getFrozenPositionKeys(userId: string): Promise<Set<string>> {
  try {
    const prisma = db as PrismaClient
    const rows = await prisma.stakingPosition.findMany({
      where: { userId, isFrozen: true, cacheState: "frozen" },
      select: { positionKey: true },
    })
    return new Set(rows.map((r: { positionKey: string }) => r.positionKey))
  } catch {
    return new Set()
  }
}

// ─── Symbol alias expansion for broader matching ───

const SYMBOL_ALIASES: Record<string, string[]> = {
  ETH: ["WETH", "ETH"],
  WETH: ["ETH", "WETH"],
  USDC: ["USDC.E", "USDCE", "USDC"],
  USDE: ["SUSDE", "USDE"],
  SUSDE: ["USDE", "SUSDE"],
  SUSDAI: ["SDAI", "SUSDAI", "DAI"],
  SDAI: ["SUSDAI", "SDAI", "DAI"],
  RLUSD: ["RLUSD"],
  DAI: ["SDAI", "SUSDAI", "DAI"],
  WEETH: ["EETH", "WEETH", "ETH", "WETH"],
  EETH: ["WEETH", "EETH", "ETH", "WETH"],
  WSTETH: ["STETH", "WSTETH", "ETH", "WETH"],
  STETH: ["WSTETH", "STETH", "ETH", "WETH"],
  CUSDO: ["USDO", "CUSDO"],
  USDO: ["CUSDO", "USDO"],
}

export function buildSymbolAliases(position: { symbol: string; underlying?: string | null }): string[] {
  const aliases = new Set<string>()
  aliases.add(position.symbol.toUpperCase())
  if (position.underlying) aliases.add(position.underlying.toUpperCase())

  // Expand each known alias
  for (const sym of [...aliases]) {
    const extra = SYMBOL_ALIASES[sym]
    if (extra) extra.forEach((a) => aliases.add(a))
  }
  return [...aliases]
}

// ─── Transaction gap diagnostics ───

export interface PositionGap {
  positionKey: string
  symbol: string
  wallet: string
  chain: string
  totalTxs: number
  pricedTxs: number
  unpricedTxs: number
}

export interface TransactionGapDiagnostics {
  syncStates: { walletAddress: string; chain: string; isComplete: boolean; phase: string }[]
  unpricedTotal: number
  positionGaps: PositionGap[]
}

export async function diagnoseTransactionGaps(
  userId: string,
  positions: { positionKey?: string; wallet: string; chain: string; symbol: string; underlying?: string | null; contractAddress?: string | null }[],
): Promise<TransactionGapDiagnostics> {
  const prisma = db as PrismaClient
  const { getTxChain } = await import("./constants")

  // 1. Check TransactionSyncState completeness
  const syncStates = await prisma.transactionSyncState.findMany({
    where: { userId },
    select: { walletAddress: true, chain: true, isComplete: true, phase: true },
  })

  // 2. Count total unpriced transactions
  const unpricedTotal = await prisma.transactionCache.count({
    where: { userId, usdValue: null, value: { not: null } },
  })

  // 3. Per-position gap analysis
  const positionGaps: PositionGap[] = []
  for (const pos of positions) {
    const txChain = getTxChain(pos.chain)
    if (!txChain) continue

    const wallet = pos.wallet.toLowerCase()
    const allAliases = buildSymbolAliases(pos)
    const assets = pos.contractAddress ? [pos.contractAddress.toLowerCase()] : []

    const orFilters: Record<string, unknown>[] = []
    if (allAliases.length > 0) orFilters.push({ symbol: { in: allAliases } })
    if (assets.length > 0) orFilters.push({ asset: { in: assets } })
    if (orFilters.length === 0) continue

    const baseWhere = {
      userId,
      walletAddress: wallet,
      chain: txChain,
      OR: orFilters,
    }

    const [totalTxs, pricedTxs] = await Promise.all([
      prisma.transactionCache.count({ where: baseWhere }),
      prisma.transactionCache.count({ where: { ...baseWhere, usdValue: { not: null } } }),
    ])

    const positionKey = pos.positionKey ?? buildPositionKey(pos as any)
    positionGaps.push({
      positionKey,
      symbol: pos.symbol,
      wallet,
      chain: txChain,
      totalTxs,
      pricedTxs,
      unpricedTxs: totalTxs - pricedTxs,
    })
  }

  return { syncStates, unpricedTotal, positionGaps }
}
