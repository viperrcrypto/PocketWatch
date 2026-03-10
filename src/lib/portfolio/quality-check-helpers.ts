/**
 * Quality check analysis logic for transaction data.
 * Contains types, data fetching, and the main analysis orchestrator.
 *
 * Individual check functions live in quality-check-analyzers.ts.
 */

import { db } from "@/lib/db"
import { getLatestHistorySyncJob } from "@/lib/portfolio/transaction-fetcher"
import { ZERION_MULTI_CHAIN } from "@/lib/portfolio/zerion-transaction-fetcher"
import {
  checkStructuralIntegrity,
  checkChainCompleteness,
  checkSyncDbConsistency,
  checkSyncHealth,
  checkProviderThrottles,
  checkWalletCoverage,
} from "@/lib/portfolio/quality-check-analyzers"

// ── Types ──

export interface QualityIssue {
  severity: "error" | "warning" | "info"
  chain: string | null
  wallet: string | null
  code: string
  message: string
  detail?: string
}

export interface WalletChainDetail {
  wallet: string
  chain: string
  count: number
  syncComplete: boolean
  syncPhase: string | null
  syncError: string | null
  recordsInserted: number
  dbVsSyncDelta: number | null
}

export interface ChainDetail {
  count: number
  earliest: string | null
  latest: string | null
  spanDays: number | null
  categories: Record<string, number>
  directions: { in: number; out: number }
  syncComplete: boolean
  syncPhase: string | null
  syncError: string | null
  recordsInserted: number
  dbVsSyncDelta: number | null
}

export interface QualityCheckResult {
  score: number
  verdict: string
  syncRunning: boolean
  totalRows: number
  walletCount: number
  chainCount: number
  chainDetail: Record<string, ChainDetail>
  walletDetail: WalletChainDetail[]
  issues: QualityIssue[]
  counts: { errors: number; warnings: number; info: number }
  syncStates: Array<{
    chain: string
    wallet: string
    isComplete: boolean
    phase: string | null
    errorCode: string | null
    requestsProcessed: number
    recordsInserted: number
    syncMode: string | null
  }>
  checkedAt: string
}

// ── Data fetching ──

export async function fetchQualityData(userId: string) {
  const nowSec = Math.floor(Date.now() / 1000)
  const activeJob = await getLatestHistorySyncJob(userId)
  const syncRunning = activeJob?.status === "running" || activeJob?.status === "queued"

  const [
    chainStats, categoryStats, directionStats, totalRows,
    zeroValueCount, nullValueCount, futureCount, ancientCount,
    nullHashCount, nullFromCount, syncStates, activeGates,
    wallets, perWalletChainCounts,
  ] = await Promise.all([
    db.transactionCache.groupBy({
      by: ["chain"],
      where: { userId },
      _count: { _all: true },
      _min: { blockTimestamp: true, blockNumber: true },
      _max: { blockTimestamp: true, blockNumber: true },
    }),
    db.transactionCache.groupBy({ by: ["chain", "category"], where: { userId }, _count: { _all: true } }),
    db.transactionCache.groupBy({ by: ["chain", "direction"], where: { userId }, _count: { _all: true } }),
    db.transactionCache.count({ where: { userId } }),
    db.transactionCache.count({ where: { userId, value: 0 } }),
    db.transactionCache.count({ where: { userId, value: null } }),
    db.transactionCache.count({ where: { userId, blockTimestamp: { gt: nowSec + 3600 } } }),
    db.transactionCache.count({ where: { userId, blockTimestamp: { lt: 1438300800 } } }),
    db.transactionCache.count({ where: { userId, txHash: "" } }),
    db.transactionCache.count({ where: { userId, from: "" } }),
    db.transactionSyncState.findMany({
      where: { userId },
      select: {
        chain: true, walletAddress: true, isComplete: true, phase: true,
        lastErrorCode: true, lastErrorMessage: true, requestsProcessed: true,
        recordsInserted: true, syncMode: true, retryAfter: true,
        highWaterMark: true, updatedAt: true,
      },
    }),
    db.providerCallGate.findMany({
      where: { userId },
      select: { provider: true, operationKey: true, consecutive429: true, nextAllowedAt: true },
    }),
    db.trackedWallet.findMany({ where: { userId }, select: { address: true } }),
    db.transactionCache.groupBy({ by: ["walletAddress", "chain"], where: { userId }, _count: { _all: true } }),
  ])

  return {
    nowSec, syncRunning, chainStats, categoryStats, directionStats,
    totalRows, zeroValueCount, nullValueCount, futureCount, ancientCount,
    nullHashCount, nullFromCount, syncStates, activeGates, wallets, perWalletChainCounts,
  }
}

// ── Analysis orchestrator ──

export function runQualityAnalysis(data: Awaited<ReturnType<typeof fetchQualityData>>): QualityCheckResult {
  const {
    nowSec, syncRunning, chainStats, categoryStats, directionStats,
    totalRows, zeroValueCount, nullValueCount, futureCount, ancientCount,
    nullHashCount, nullFromCount, syncStates, activeGates, wallets, perWalletChainCounts,
  } = data

  const issues: QualityIssue[] = []

  // Build lookup maps
  const catMap = new Map<string, Record<string, number>>()
  for (const row of categoryStats) {
    if (!catMap.has(row.chain)) catMap.set(row.chain, {})
    catMap.get(row.chain)![row.category] = row._count._all
  }

  const dirMap = new Map<string, { in: number; out: number }>()
  for (const row of directionStats) {
    if (!dirMap.has(row.chain)) dirMap.set(row.chain, { in: 0, out: 0 })
    const dir = dirMap.get(row.chain)!
    if (row.direction === "in") dir.in = row._count._all
    else if (row.direction === "out") dir.out = row._count._all
  }

  const wcCountMap = new Map<string, number>()
  for (const row of perWalletChainCounts) {
    wcCountMap.set(`${row.walletAddress}:${row.chain}`, row._count._all)
  }

  const zerionMultiByWallet = new Map<string, typeof syncStates[number]>()
  for (const s of syncStates) {
    if (s.chain === ZERION_MULTI_CHAIN) {
      zerionMultiByWallet.set(s.walletAddress.toLowerCase(), s)
    }
  }

  // Build chain detail
  const chainDetail = buildChainDetail(chainStats, catMap, dirMap, perWalletChainCounts, syncStates, zerionMultiByWallet)

  // Build per-wallet-chain detail
  const walletDetail = buildWalletDetail(syncStates, perWalletChainCounts, wcCountMap)

  // Run all checks
  checkStructuralIntegrity(issues, { futureCount, ancientCount, nullHashCount, nullFromCount, zeroValueCount, nullValueCount, totalRows })
  checkChainCompleteness(issues, chainDetail, perWalletChainCounts, zerionMultiByWallet, nowSec)
  checkSyncDbConsistency(issues, syncStates, perWalletChainCounts, wcCountMap)
  checkSyncHealth(issues, syncStates)
  checkProviderThrottles(issues, activeGates)
  checkWalletCoverage(issues, wallets, syncStates)

  if (syncRunning) {
    issues.unshift({
      severity: "info", chain: null, wallet: null,
      code: "sync_in_progress",
      message: "Sync is still running — results may be incomplete. Run check again after sync completes for accurate results.",
    })
  }

  // Score
  const errorCount = issues.filter((i) => i.severity === "error").length
  const warningCount = issues.filter((i) => i.severity === "warning").length
  const infoCount = issues.filter((i) => i.severity === "info").length
  const score = Math.max(0, Math.min(100, 100 - errorCount * 20 - warningCount * 5 - infoCount * 1))

  const verdict =
    score >= 90 ? "Excellent — data looks clean and complete" :
    score >= 70 ? "Good — minor issues, data is usable" :
    score >= 50 ? "Fair — some issues worth investigating" :
    score >= 30 ? "Poor — significant data quality problems" :
    "Bad — recommend wiping and restarting sync"

  return {
    score, verdict, syncRunning, totalRows,
    walletCount: wallets.length,
    chainCount: Object.keys(chainDetail).length,
    chainDetail, walletDetail, issues,
    counts: { errors: errorCount, warnings: warningCount, info: infoCount },
    syncStates: syncStates.map((s) => ({
      chain: s.chain, wallet: s.walletAddress, isComplete: s.isComplete, phase: s.phase,
      errorCode: s.lastErrorCode, requestsProcessed: s.requestsProcessed,
      recordsInserted: s.recordsInserted, syncMode: s.syncMode,
    })),
    checkedAt: new Date().toISOString(),
  }
}

// ── Internal helpers ──

function buildChainDetail(
  chainStats: Array<{ chain: string; _count: { _all: number }; _min: { blockTimestamp: number | null; blockNumber: number | null }; _max: { blockTimestamp: number | null; blockNumber: number | null } }>,
  catMap: Map<string, Record<string, number>>,
  dirMap: Map<string, { in: number; out: number }>,
  perWalletChainCounts: Array<{ walletAddress: string; chain: string; _count: { _all: number } }>,
  syncStates: Array<{ chain: string; walletAddress: string; isComplete: boolean; phase: string | null; lastErrorCode: string | null; recordsInserted: number }>,
  zerionMultiByWallet: Map<string, typeof syncStates[number]>
): Record<string, ChainDetail> {
  const chainDetail: Record<string, ChainDetail> = {}

  for (const row of chainStats) {
    const minTs = row._min.blockTimestamp
    const maxTs = row._max.blockTimestamp
    const spanDays = minTs && maxTs ? Math.round((maxTs - minTs) / 86400) : null

    let chainSyncs = syncStates.filter((s) => s.chain === row.chain)
    if (chainSyncs.length === 0 && row.chain !== "SOLANA" && zerionMultiByWallet.size > 0) {
      const walletsOnChain = perWalletChainCounts
        .filter((wc) => wc.chain === row.chain)
        .map((wc) => wc.walletAddress.toLowerCase())
      const zerionCoverage = walletsOnChain
        .map((addr) => zerionMultiByWallet.get(addr))
        .filter((s): s is NonNullable<typeof s> => s != null)
      if (zerionCoverage.length > 0 && walletsOnChain.every((addr) => zerionMultiByWallet.has(addr))) {
        chainSyncs = zerionCoverage
      }
    }

    const allComplete = chainSyncs.length > 0 && chainSyncs.every((s) => s.isComplete)
    const totalInserted = chainSyncs.reduce((sum, s) => sum + s.recordsInserted, 0)

    chainDetail[row.chain] = {
      count: row._count._all,
      earliest: minTs ? new Date(minTs * 1000).toISOString() : null,
      latest: maxTs ? new Date(maxTs * 1000).toISOString() : null,
      spanDays,
      categories: catMap.get(row.chain) ?? {},
      directions: dirMap.get(row.chain) ?? { in: 0, out: 0 },
      syncComplete: allComplete,
      syncPhase: chainSyncs[0]?.phase ?? null,
      syncError: chainSyncs[0]?.lastErrorCode ?? null,
      recordsInserted: totalInserted,
      dbVsSyncDelta: totalInserted > 0 ? row._count._all - totalInserted : null,
    }
  }

  return chainDetail
}

function buildWalletDetail(
  syncStates: Array<{ chain: string; walletAddress: string; isComplete: boolean; phase: string | null; lastErrorCode: string | null; recordsInserted: number }>,
  perWalletChainCounts: Array<{ walletAddress: string; chain: string; _count: { _all: number } }>,
  wcCountMap: Map<string, number>
): WalletChainDetail[] {
  const walletDetail: WalletChainDetail[] = []

  for (const state of syncStates) {
    if (state.phase === "skipped" || state.phase === "needs_key") continue

    let dbCount: number
    if (state.chain === ZERION_MULTI_CHAIN) {
      dbCount = perWalletChainCounts
        .filter((wc) => wc.walletAddress === state.walletAddress && wc.chain !== "SOLANA")
        .reduce((sum, wc) => sum + wc._count._all, 0)
    } else {
      dbCount = wcCountMap.get(`${state.walletAddress}:${state.chain}`) ?? 0
    }

    walletDetail.push({
      wallet: state.walletAddress,
      chain: state.chain,
      count: dbCount,
      syncComplete: state.isComplete,
      syncPhase: state.phase,
      syncError: state.lastErrorCode,
      recordsInserted: state.recordsInserted,
      dbVsSyncDelta: state.recordsInserted > 0 ? dbCount - state.recordsInserted : null,
    })
  }

  return walletDetail
}
