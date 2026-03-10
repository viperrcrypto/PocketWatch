/**
 * Data assembly functions for the portfolio history snapshots route.
 * Handles series merging, exchange blending, status computation,
 * sync triggers, coverage analysis, pruning, and data purging.
 */

import { db } from "@/lib/db"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import { reconstructExchangeBalanceHistory } from "@/lib/portfolio/exchange-balance-reconstructor"
import { startOrResumeHistorySyncJob } from "@/lib/portfolio/transaction-fetcher"
import { normalizeWalletAddress } from "@/lib/portfolio/utils"
import { capBlendedValue } from "@/lib/portfolio/snapshot-validation"
import type { Prisma } from "@/generated/prisma/client"
import {
  type SnapshotRange, type SnapshotScope, type SnapshotStatus, type SnapshotWarningCode,
  type ChartPoint,
  CHART_CACHE_TTL_SEC, TOTAL_MIN_POINTS_FOR_READY, DAY_SEC, SOURCE_PRIORITY,
  SCALE_FACTOR_MIN, SCALE_FACTOR_MAX,
  sanitizeSeriesOutliers, onchainValueFromSnapshot,
  bridgeLiveGap, interpolateExchangeValue,
  pruneDivergentZerionTail, isZerionLowConfidence,
  safeScaleReference,
} from "@/lib/portfolio/snapshot-helpers"

// ── Series merging ──

interface MergeParams {
  zerionPoints: ChartPoint[]
  snapshotMergePoints: ChartPoint[]
  latestLiveSnapshot: ChartPoint | undefined
}

export function mergeChartSeries(params: MergeParams): ChartPoint[] {
  const { zerionPoints, snapshotMergePoints, latestLiveSnapshot } = params
  const mergedByTimestamp = new Map<number, ChartPoint>()

  if (zerionPoints.length > 0 && snapshotMergePoints.length > 0) {
    const snapshotDays = new Set<number>()
    for (const point of snapshotMergePoints) {
      snapshotDays.add(Math.floor(point.timestamp / DAY_SEC))
    }

    for (const point of zerionPoints) {
      const day = Math.floor(point.timestamp / DAY_SEC)
      if (!snapshotDays.has(day)) {
        mergedByTimestamp.set(point.timestamp, point)
      }
    }

    for (const point of snapshotMergePoints) {
      const existing = mergedByTimestamp.get(point.timestamp)
      const existingPrio = existing ? SOURCE_PRIORITY[existing.source] ?? 1 : -1
      const nextPrio = SOURCE_PRIORITY[point.source] ?? 1
      if (!existing || nextPrio >= existingPrio) {
        mergedByTimestamp.set(point.timestamp, point)
      }
    }
  } else {
    const allPoints = zerionPoints.length > 0 ? zerionPoints : snapshotMergePoints
    for (const point of allPoints) {
      const existing = mergedByTimestamp.get(point.timestamp)
      const existingPrio = existing ? SOURCE_PRIORITY[existing.source] ?? 1 : -1
      const nextPrio = SOURCE_PRIORITY[point.source] ?? 1
      if (!existing || nextPrio >= existingPrio) {
        mergedByTimestamp.set(point.timestamp, point)
      }
    }
  }

  const mergedRaw = sanitizeSeriesOutliers(
    Array.from(mergedByTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp)
  )

  return latestLiveSnapshot
    ? bridgeLiveGap(mergedRaw, latestLiveSnapshot)
    : mergedRaw
}

// ── Exchange balance blending ──

interface BlendExchangeParams {
  userId: string
  merged: ChartPoint[]
  matchingLiveSnapshots: Array<{
    totalValue: number; source: string | null; metadata: unknown; createdAt: Date
  }>
  onchainValueFromSnapshot: (s: { totalValue: number; source: string | null; metadata: unknown }) => number
}

export async function blendExchangeBalances(params: BlendExchangeParams): Promise<ChartPoint[]> {
  const { userId, merged, matchingLiveSnapshots } = params

  await reconstructExchangeBalanceHistory(userId)

  const exchangeSnapshots = await db.exchangeBalanceSnapshot.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { totalValue: true, createdAt: true },
  })

  for (const snapshot of matchingLiveSnapshots) {
    const onchainVal = onchainValueFromSnapshot(snapshot)
    if (onchainVal > 0 && snapshot.totalValue > onchainVal + 0.01) {
      exchangeSnapshots.push({
        totalValue: snapshot.totalValue - onchainVal,
        createdAt: snapshot.createdAt,
      })
    }
  }

  const exchangeByDay = new Map<number, { timestamp: number; value: number }>()
  for (const snap of exchangeSnapshots) {
    const ts = Math.floor(snap.createdAt.getTime() / 1000)
    const day = Math.floor(ts / 86400)
    const existing = exchangeByDay.get(day)
    if (!existing || ts > existing.timestamp) {
      exchangeByDay.set(day, { timestamp: ts, value: snap.totalValue })
    }
  }
  const exchangeTimeline = Array.from(exchangeByDay.values()).sort((a, b) => a.timestamp - b.timestamp)

  if (exchangeTimeline.length > 0) {
    console.info(`[snapshots] Exchange blend: ${exchangeTimeline.length} days, range ${new Date(exchangeTimeline[0].timestamp * 1000).toISOString().slice(0, 10)} → ${new Date(exchangeTimeline[exchangeTimeline.length - 1].timestamp * 1000).toISOString().slice(0, 10)}, earliest value $${exchangeTimeline[0].value.toFixed(0)}`)
    return merged.map((point) => {
      if (point.source === "live_refresh") return point
      const exchangeValue = interpolateExchangeValue(point.timestamp, exchangeTimeline)
      if (exchangeValue <= 0) return point
      return { ...point, value: capBlendedValue(point.value, exchangeValue) }
    })
  }

  return merged
}

// ── Status computation ──

interface StatusParams {
  effectiveScope: SnapshotScope
  strictCoverageStartSec: number | null
  incompleteSyncCount: number
  strictPointsLength: number
  range: SnapshotRange
}

export function computeStatusAndWarning(params: StatusParams): {
  status: SnapshotStatus
  warningCode: SnapshotWarningCode
} {
  const { effectiveScope, strictCoverageStartSec, incompleteSyncCount, strictPointsLength, range } = params
  let status: SnapshotStatus = "ready"
  let warningCode: SnapshotWarningCode = null

  if (effectiveScope === "onchain") {
    if (strictCoverageStartSec === null) {
      status = incompleteSyncCount > 0 ? "syncing" : "insufficient_history"
      warningCode = incompleteSyncCount > 0 ? "onchain_sync_incomplete" : "onchain_missing_coverage"
    } else if (incompleteSyncCount > 0) {
      status = "syncing"
      warningCode = "onchain_sync_incomplete"
    } else if (strictPointsLength < 2) {
      status = "insufficient_history"
      warningCode = "onchain_missing_coverage"
    }
  } else if (strictPointsLength < (range === "ALL" ? TOTAL_MIN_POINTS_FOR_READY : 2)) {
    status = "insufficient_history"
    warningCode = "total_sparse_history"
  }

  return { status, warningCode }
}

// ── Sync trigger ──

interface TriggerSyncParams {
  userId: string
  wallets: Array<{ address: string }>
  syncStates: Array<{ walletAddress: string; updatedAt: Date; isComplete: boolean }>
  normalizedAddresses: string[]
}

export async function triggerSyncIfNeeded(params: TriggerSyncParams): Promise<void> {
  const { userId, wallets, syncStates } = params

  const alchemyKey = await getServiceKey(userId, "alchemy")
  if (!alchemyKey || wallets.length === 0) return

  const syncedSet = new Set(syncStates.map((s) => normalizeWalletAddress(s.walletAddress)))
  const hasUnsyncedWallets = wallets.some((w) => !syncedSet.has(normalizeWalletAddress(w.address)))

  const oldestSync = syncStates.length > 0
    ? Math.min(...syncStates.map((s) => s.updatedAt.getTime()))
    : 0
  const syncIsStale = syncStates.length > 0 && (Date.now() - oldestSync) > CHART_CACHE_TTL_SEC * 1000

  if (hasUnsyncedWallets || syncIsStale) {
    startOrResumeHistorySyncJob(userId)
      .then((job) => console.log(`[snapshots] Queued history sync job ${job.jobId} (${job.status})`))
      .catch((e) => console.warn("[snapshots] Failed to queue history sync job:", e))
  }
}

// ── Coverage computation ──

export function computeCoverageInfo(
  normalizedAddresses: string[],
  walletCoverageRows: Array<{ walletAddress: string; _min: { blockTimestamp: number | null } }>,
  syncStates: Array<{ walletAddress: string; updatedAt: Date; isComplete: boolean }>,
  totalWalletCount: number
) {
  const walletCoverageMap = new Map<string, number>()
  for (const row of walletCoverageRows) {
    if (row._min.blockTimestamp) {
      walletCoverageMap.set(normalizeWalletAddress(row.walletAddress), row._min.blockTimestamp)
    }
  }

  const completedSyncWallets = new Set(
    syncStates
      .filter((s) => s.isComplete)
      .map((s) => normalizeWalletAddress(s.walletAddress))
  )
  const hasCoverageForAllWallets = normalizedAddresses.length > 0 &&
    normalizedAddresses.every((address) =>
      walletCoverageMap.has(address) || completedSyncWallets.has(address)
    )
  const walletsWithData = normalizedAddresses.filter((a) => walletCoverageMap.has(a))
  const strictCoverageStartSec = hasCoverageForAllWallets && walletsWithData.length > 0
    ? Math.max(...walletsWithData.map((address) => walletCoverageMap.get(address) ?? 0))
    : null

  const inferredMissingSyncStates = totalWalletCount > 0 && syncStates.length === 0 ? totalWalletCount : 0
  const incompleteSyncCount = syncStates.filter((state) => !state.isComplete).length + inferredMissingSyncStates

  return { walletCoverageMap, completedSyncWallets, hasCoverageForAllWallets, strictCoverageStartSec, incompleteSyncCount }
}

// ── Merge with projected chart ──

/**
 * Merge Zerion chart with position-projected chart to fill DeFi valleys.
 *
 * Zerion tracks wallet-held fungibles but misses DeFi deposits/staking.
 * The projected chart estimates total holdings at historical prices.
 *
 * Strategy: weighted blend that preserves Zerion's shape.
 * When Zerion < projected (assets are in DeFi), blend toward projected
 * using weight = zerion / projected. This compresses Zerion's variance
 * toward the projected baseline without eliminating dips entirely.
 * When Zerion >= projected (assets in wallet), use Zerion directly.
 *
 * The blend naturally handles stablecoin-heavy portfolios: Zerion's
 * DeFi deposit/withdrawal noise is dampened while real price movements
 * are preserved proportionally.
 */
export function mergeWithProjectedChart(
  zerionPoints: ChartPoint[],
  projectedPoints: ChartPoint[],
): ChartPoint[] {
  if (projectedPoints.length === 0) return zerionPoints
  if (zerionPoints.length === 0) return projectedPoints

  // Build day-bucket lookup for projected values
  const projectedByDay = new Map<number, number>()
  for (const p of projectedPoints) {
    const day = Math.floor(p.timestamp / DAY_SEC)
    const existing = projectedByDay.get(day)
    if (existing === undefined || p.value > existing) {
      projectedByDay.set(day, p.value)
    }
  }

  // Blend: when Zerion < projected, interpolate toward projected
  // weight = min(1, zerion / projected)
  // result = weight × zerion + (1 - weight) × projected
  const merged = zerionPoints.map((point) => {
    const day = Math.floor(point.timestamp / DAY_SEC)
    const projectedValue = projectedByDay.get(day)
    if (projectedValue === undefined || projectedValue <= 0) return point
    if (point.value >= projectedValue) return point

    const weight = point.value / projectedValue
    const blendedValue = weight * point.value + (1 - weight) * projectedValue
    return { ...point, value: blendedValue, source: "projected" }
  })

  // Add projected points for days with no Zerion data
  const zerionDays = new Set(zerionPoints.map((p) => Math.floor(p.timestamp / DAY_SEC)))
  for (const p of projectedPoints) {
    const day = Math.floor(p.timestamp / DAY_SEC)
    if (!zerionDays.has(day)) {
      merged.push(p)
    }
  }

  return merged.sort((a, b) => a.timestamp - b.timestamp)
}

// ── Prune & normalize ──

export async function pruneAndNormalize(params: {
  userId: string
  zerionPoints: ChartPoint[]
  onchainRefPoint: ChartPoint | undefined
  reconstructedPoints: ChartPoint[]
  latestLiveSnapshot: ChartPoint | undefined
}): Promise<ChartPoint[]> {
  const { userId, onchainRefPoint, reconstructedPoints, latestLiveSnapshot } = params
  let { zerionPoints } = params

  const pruneRef = onchainRefPoint
    ?? (reconstructedPoints.length > 0
      ? reconstructedPoints[reconstructedPoints.length - 1]
      : undefined)

  if (zerionPoints.length > 0 && pruneRef) {
    const pruned = pruneDivergentZerionTail(zerionPoints, pruneRef)
    zerionPoints = pruned.points
    if (pruned.removedTimestamps.length > 0) {
      await db.chartCache.deleteMany({
        where: { userId, timestamp: { in: pruned.removedTimestamps } },
      })
    }
  }

  const confidenceRef = onchainRefPoint ?? latestLiveSnapshot
    ?? (reconstructedPoints.length > 0 ? reconstructedPoints[reconstructedPoints.length - 1] : undefined)
  const zerionLowConfidence = isZerionLowConfidence(zerionPoints, confidenceRef)

  if (!zerionLowConfidence && zerionPoints.length > 0 && onchainRefPoint) {
    const safeRef = safeScaleReference(zerionPoints)
    if (safeRef > 0 && onchainRefPoint.value > 0) {
      const scaleFactor = onchainRefPoint.value / safeRef
      if (scaleFactor >= SCALE_FACTOR_MIN && scaleFactor <= SCALE_FACTOR_MAX && scaleFactor !== 1 && Number.isFinite(scaleFactor)) {
        zerionPoints = zerionPoints.map((p) => ({
          ...p,
          value: p.value * scaleFactor,
        }))
      } else if (scaleFactor < SCALE_FACTOR_MIN || scaleFactor > SCALE_FACTOR_MAX) {
        console.warn(`[snapshots] Suppressed extreme scale factor ${scaleFactor.toFixed(3)} (ref=${onchainRefPoint.value}, zerion=${safeRef})`)
      }
    }
  }

  return zerionPoints
}

// ── Purge all snapshot data ──

const CHART_SETTINGS_KEYS = [
  "chartWalletFingerprint",
  "chartCacheUpdatedAt",
  "chartZerionSuppressedUntil",
  "chartZerionSuppressedAt",
  "chartZerionSuppressedReason",
  "chartReconstructionRequestedAt",
  "chartWipedAt",
] as const

export async function purgeSnapshotData(userId: string) {
  return db.$transaction(async (tx) => {
    const [deletedSnapshots, deletedChartCache, deletedSyncState, resetJobs, _deletedProjected] = await Promise.all([
      tx.portfolioSnapshot.deleteMany({ where: { userId } }),
      tx.chartCache.deleteMany({ where: { userId } }),
      tx.transactionSyncState.deleteMany({ where: { userId } }),
      tx.historySyncJob.updateMany({
        where: { userId, status: { in: ["queued", "running"] } },
        data: { status: "failed", completedAt: new Date(), error: "reset_by_snapshot_purge" },
      }),
      tx.projectedChartCache.deleteMany({ where: { userId } }),
    ])

    let settingsReset = false
    const existingSetting = await tx.portfolioSetting.findUnique({
      where: { userId },
      select: { settings: true },
    })

    if (existingSetting?.settings && typeof existingSetting.settings === "object") {
      const nextSettings = { ...(existingSetting.settings as Record<string, unknown>) }
      for (const key of CHART_SETTINGS_KEYS) {
        delete nextSettings[key]
      }
      // Mark that chart was just wiped — GET handler will return empty until user explicitly refreshes
      nextSettings.chartWipedAt = new Date().toISOString()

      await tx.portfolioSetting.update({
        where: { userId },
        data: { settings: nextSettings as Prisma.InputJsonValue },
      })
      settingsReset = true
    } else {
      // No settings row yet — create one with the wipe marker
      await tx.portfolioSetting.upsert({
        where: { userId },
        create: { userId, settings: { chartWipedAt: new Date().toISOString() } as Prisma.InputJsonValue },
        update: { settings: { chartWipedAt: new Date().toISOString() } as Prisma.InputJsonValue },
      })
      settingsReset = true
    }

    return {
      snapshots: deletedSnapshots.count,
      chartCache: deletedChartCache.count,
      syncStates: deletedSyncState.count,
      historyJobsReset: resetJobs.count,
      settingsReset,
    }
  })
}
