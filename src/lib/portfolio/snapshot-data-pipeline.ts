/**
 * Data pipeline functions for the portfolio history snapshots route.
 * Handles Zerion cache refresh, range fetching, DeFi smoothing,
 * snapshot point building, on-chain reference, and normalization.
 *
 * Assembly functions (merging, blending, status, etc.) live in snapshot-data-assembly.ts.
 */

import { db } from "@/lib/db"
import { reconstructPortfolioHistory } from "@/lib/portfolio/value-reconstructor"
import { fetchMultiWalletChart, type ZerionChartPeriod } from "@/lib/portfolio/zerion-client"
import { withProviderPermit } from "@/lib/portfolio/provider-governor"
import { smoothDefiDips } from "@/lib/portfolio/chart-defi-smoother"
import { filterValidPoints } from "@/lib/portfolio/snapshot-validation"
import {
  type SnapshotRange, type SnapshotScope,
  type ChartPoint,
  CHART_CACHE_TTL_SEC, RECONSTRUCTION_TRIGGER_INTERVAL_MS,
  LEGACY_LIVE_SNAPSHOT_WINDOW_SEC,
  sanitizeZerionSeries,
  getSnapshotWalletFingerprint, parseMetadata, onchainValueFromSnapshot,
  hasUsableReconstructedHistory, safeScaleReference,
  SCALE_FACTOR_MIN, SCALE_FACTOR_MAX,
} from "@/lib/portfolio/snapshot-helpers"

// Re-export assembly functions so the route can import from a single module
export {
  mergeChartSeries,
  mergeWithProjectedChart,
  blendExchangeBalances,
  computeStatusAndWarning,
  triggerSyncIfNeeded,
  computeCoverageInfo,
  pruneAndNormalize,
  purgeSnapshotData,
} from "@/lib/portfolio/snapshot-data-assembly"

// ── Zerion cache refresh ──

interface RefreshZerionParams {
  userId: string
  zerionKey: string | null
  addresses: string[]
  zerionPoints: ChartPoint[]
  nowSec: number
  previousFingerprint: string
  walletFingerprint: string
  staleReconstructedSnapshotIds: string[]
  futureRows: Array<{ timestamp: number }>
}

export async function refreshZerionCache(params: RefreshZerionParams): Promise<ChartPoint[]> {
  const {
    userId, zerionKey, addresses, nowSec,
    previousFingerprint, walletFingerprint,
    staleReconstructedSnapshotIds, futureRows,
  } = params
  let { zerionPoints } = params

  if (!zerionKey || addresses.length === 0) return zerionPoints

  const latestCachedTs = zerionPoints.length > 0
    ? zerionPoints[zerionPoints.length - 1].timestamp
    : 0
  const cacheAgeSec = latestCachedTs > 0 ? nowSec - latestCachedTs : Number.POSITIVE_INFINITY
  const cacheIsFresh = cacheAgeSec >= 0 && cacheAgeSec < CHART_CACHE_TTL_SEC
  const walletSetChanged = previousFingerprint !== walletFingerprint
  const shouldRefresh = !cacheIsFresh || walletSetChanged || zerionPoints.length === 0

  if (!shouldRefresh) return zerionPoints

  try {
    const freshChart = await withProviderPermit(
      userId,
      "zerion",
      `chart:max:${walletFingerprint}`,
      undefined,
      () => fetchMultiWalletChart(zerionKey, addresses, "max")
    )
    const sanitized = sanitizeZerionSeries(freshChart, nowSec)
    const { valid: freshPoints } = filterValidPoints(sanitized)

    await db.$transaction(async (tx) => {
      await tx.chartCache.deleteMany({ where: { userId } })

      if (freshPoints.length > 0) {
        const BATCH_SIZE = 500
        for (let i = 0; i < freshPoints.length; i += BATCH_SIZE) {
          const batch = freshPoints.slice(i, i + BATCH_SIZE)
          await tx.chartCache.createMany({
            data: batch.map((p) => ({
              userId,
              timestamp: p.timestamp,
              value: p.value,
            })),
          })
        }
      }

      const chartFields = JSON.stringify({
        chartWalletFingerprint: walletFingerprint,
        chartCacheUpdatedAt: new Date().toISOString(),
      })
      const settingId = crypto.randomUUID()
      await tx.$executeRaw`
        INSERT INTO "PortfolioSetting" ("id", "userId", "settings")
        VALUES (${settingId}, ${userId}, ${chartFields}::jsonb)
        ON CONFLICT ("userId") DO UPDATE
        SET settings = "PortfolioSetting".settings || ${chartFields}::jsonb
      `
    })

    zerionPoints = freshPoints

    if (staleReconstructedSnapshotIds.length > 0) {
      await db.portfolioSnapshot.deleteMany({
        where: { userId, id: { in: staleReconstructedSnapshotIds } },
      })
    }
    if (futureRows.length > 0) {
      await db.chartCache.deleteMany({
        where: { userId, timestamp: { in: futureRows.map((row) => row.timestamp) } },
      })
    }
  } catch (error) {
    console.warn("[snapshots] Zerion refresh failed:", error)
    if (walletSetChanged) {
      zerionPoints = []
    }
  }

  return zerionPoints
}

// ── Range-specific Zerion fetch ──

const RANGE_ZERION_PERIOD: Partial<Record<SnapshotRange, ZerionChartPeriod>> = {
  "1D": "day",
  "1W": "week",
}

interface FetchRangeParams {
  range: SnapshotRange
  zerionKey: string | null
  addresses: string[]
  userId: string
  walletFingerprint: string
  nowSec: number
}

export async function fetchRangeSpecificZerion(params: FetchRangeParams): Promise<ChartPoint[]> {
  const { range, zerionKey, addresses, userId, walletFingerprint, nowSec } = params
  const rangeZerionPeriod = RANGE_ZERION_PERIOD[range]

  if (!rangeZerionPeriod || !zerionKey || addresses.length === 0) return []

  try {
    const rangeChart = await withProviderPermit(
      userId,
      "zerion",
      `chart:${rangeZerionPeriod}:${walletFingerprint}`,
      undefined,
      () => fetchMultiWalletChart(zerionKey, addresses, rangeZerionPeriod)
    )
    return sanitizeZerionSeries(rangeChart, nowSec)
  } catch (error) {
    console.warn(`[snapshots] Zerion ${rangeZerionPeriod} range fetch failed:`, error)
    return []
  }
}

// ── DeFi dip smoothing ──

interface SmoothParams {
  zerionPoints: ChartPoint[]
  rangeSpecificZerionPoints: ChartPoint[]
  userId: string
  normalizedAddresses: string[]
  hasRangeOverride: boolean
}

export async function smoothZerionPoints(params: SmoothParams): Promise<{
  zerionPoints: ChartPoint[]
  rangeSpecificZerionPoints: ChartPoint[]
}> {
  let { zerionPoints, rangeSpecificZerionPoints } = params
  const { userId, normalizedAddresses, hasRangeOverride } = params

  if (!hasRangeOverride && zerionPoints.length > 4) {
    try {
      zerionPoints = await smoothDefiDips(zerionPoints, userId, normalizedAddresses)
    } catch (error) {
      console.warn("[snapshots] DeFi dip smoother failed (non-fatal):", error)
    }
  }
  if (hasRangeOverride && rangeSpecificZerionPoints.length > 4) {
    try {
      rangeSpecificZerionPoints = await smoothDefiDips(rangeSpecificZerionPoints, userId, normalizedAddresses)
    } catch (error) {
      console.warn("[snapshots] DeFi dip smoother (range) failed (non-fatal):", error)
    }
  }

  return { zerionPoints, rangeSpecificZerionPoints }
}

// Current reconstruction version — old snapshots with a different version are treated as stale
const CURRENT_RECONSTRUCTION_VERSION = "tx_cache_daily_v4_defi_supplement"

// ── Snapshot point building ──

interface BuildSnapshotPointsParams {
  snapshots: Array<{
    id: string; createdAt: Date; totalValue: number
    source: string | null; metadata: unknown
  }>
  effectiveScope: SnapshotScope
  walletFingerprint: string
  nowSec: number
  cachedChartRows: unknown[]
  zerionPoints: ChartPoint[]
}

export function buildSnapshotPoints(params: BuildSnapshotPointsParams): ChartPoint[] {
  const { snapshots, effectiveScope, walletFingerprint, nowSec, cachedChartRows, zerionPoints } = params

  const snapshotPoints: ChartPoint[] = snapshots.flatMap((snapshot) => {
    const timestamp = Math.floor(snapshot.createdAt.getTime() / 1000)
    const source = snapshot.source ?? "unknown"
    const snapshotWalletFingerprint = getSnapshotWalletFingerprint(snapshot.metadata)
    const ageSec = nowSec - timestamp

    if (effectiveScope === "total" && source !== "live_refresh" && source !== "reconstructed") return []
    if (source === "live_refresh") {
      if (snapshotWalletFingerprint && snapshotWalletFingerprint !== walletFingerprint) return []
      if (!snapshotWalletFingerprint && ageSec > LEGACY_LIVE_SNAPSHOT_WINDOW_SEC) return []
    }
    if (source === "reconstructed") {
      if (!snapshotWalletFingerprint || snapshotWalletFingerprint !== walletFingerprint) return []
      // Stale reconstruction version — discard so fresh reconstruction is triggered
      const meta = parseMetadata(snapshot.metadata)
      if (meta?.reconstructionVersion !== CURRENT_RECONSTRUCTION_VERSION) return []
    }

    const value = effectiveScope === "onchain"
      ? onchainValueFromSnapshot(snapshot)
      : snapshot.totalValue

    if (!Number.isFinite(value) || value <= 0) return []
    return [{ timestamp, value, source }]
  })

  const latestLiveSnapshot = [...snapshotPoints].reverse().find((p) => p.source === "live_refresh")
  const reconstructedPoints = snapshotPoints
    .filter((p) => p.source === "reconstructed")
    .sort((a, b) => a.timestamp - b.timestamp)
  const usableReconstructed = hasUsableReconstructedHistory(reconstructedPoints, latestLiveSnapshot)

  const hasZerionBackbone = cachedChartRows.length > 0
  const result = usableReconstructed
    ? snapshotPoints
    : hasZerionBackbone
      ? snapshotPoints.filter((p) => p.source !== "reconstructed")
      : snapshotPoints

  return trimReconstructionRamp(result)
}

/**
 * Clean reconstructed data: trim the initial "discovery ramp" and smooth
 * outlier spikes that revert within a few days.
 *
 * The value reconstructor has two artifact patterns:
 * 1. **Discovery ramp**: positions found incrementally → $15K/day staircase
 * 2. **Transient spikes**: intermittent reward accruals or stale prices →
 *    sudden $3-5K jumps that revert back within days
 *
 * This function handles both by:
 * - Trimming the initial ramp up to the stabilization point
 * - Replacing spike values with the local median of surrounding points
 */
function trimReconstructionRamp(points: ChartPoint[]): ChartPoint[] {
  const reconstructed = points
    .filter((p) => p.source === "reconstructed")
    .sort((a, b) => a.timestamp - b.timestamp)

  if (reconstructed.length < 7) return points

  // ── Phase 1: Trim initial discovery ramp ──
  const RAMP_THRESHOLD = 0.05
  const STABLE_DAYS_REQUIRED = 3
  let lastRampIdx = -1

  for (let i = 1; i < reconstructed.length; i++) {
    const prev = reconstructed[i - 1].value
    const curr = reconstructed[i].value
    const changePct = prev > 0 ? Math.abs(curr - prev) / prev : 0
    if (changePct > RAMP_THRESHOLD) {
      lastRampIdx = i
    }
  }

  let cutoffTimestamp = -1
  if (lastRampIdx >= 0) {
    let stableDays = 0
    for (let i = lastRampIdx + 1; i < reconstructed.length; i++) {
      const prev = reconstructed[i - 1].value
      const curr = reconstructed[i].value
      const changePct = prev > 0 ? Math.abs(curr - prev) / prev : 0
      if (changePct <= RAMP_THRESHOLD) {
        stableDays++
        if (stableDays >= STABLE_DAYS_REQUIRED) break
      } else {
        stableDays = 0
      }
    }
    if (stableDays >= STABLE_DAYS_REQUIRED) {
      cutoffTimestamp = reconstructed[lastRampIdx].timestamp
    }
  }

  // ── Phase 2: Smooth transient spikes ──
  // Compute the rolling median of stable (non-spike) values, then replace
  // any point that deviates >2% from its local neighborhood median.
  const SPIKE_THRESHOLD = 0.02
  const WINDOW = 3 // days on each side

  const smoothed = reconstructed.map((p, i) => {
    // Skip points that will be trimmed anyway
    if (cutoffTimestamp >= 0 && p.timestamp < cutoffTimestamp) return p

    const windowStart = Math.max(0, i - WINDOW)
    const windowEnd = Math.min(reconstructed.length - 1, i + WINDOW)
    const neighbors: number[] = []
    for (let j = windowStart; j <= windowEnd; j++) {
      if (j !== i) neighbors.push(reconstructed[j].value)
    }
    if (neighbors.length < 2) return p

    neighbors.sort((a, b) => a - b)
    const median = neighbors[Math.floor(neighbors.length / 2)]
    const deviation = median > 0 ? Math.abs(p.value - median) / median : 0

    if (deviation > SPIKE_THRESHOLD) {
      return { ...p, value: median }
    }
    return p
  })

  // Build a map of timestamp → smoothed value for reconstructed points
  const smoothedMap = new Map<number, number>()
  for (const p of smoothed) {
    smoothedMap.set(p.timestamp, p.value)
  }

  return points.filter((p) => {
    if (p.source !== "reconstructed") return true
    if (cutoffTimestamp >= 0 && p.timestamp < cutoffTimestamp) return false
    return true
  }).map((p) => {
    if (p.source !== "reconstructed") return p
    const sv = smoothedMap.get(p.timestamp)
    if (sv !== undefined && sv !== p.value) {
      return { ...p, value: sv }
    }
    return p
  })
}

// ── On-chain reference computation ──

interface ComputeRefParams {
  snapshots: Array<{
    id: string; createdAt: Date; totalValue: number
    source: string | null; metadata: unknown
  }>
  walletFingerprint: string
  snapshotMergePoints: ChartPoint[]
}

export function computeOnchainRef(params: ComputeRefParams): {
  onchainRefPoint: ChartPoint | undefined
  latestLiveSnapshot: ChartPoint | undefined
  reconstructedPoints: ChartPoint[]
  matchingLiveSnapshots: typeof params.snapshots
} {
  const { snapshots, walletFingerprint, snapshotMergePoints } = params

  // Find the latest live_refresh snapshot, but skip outliers (partial fetches)
  // that are <10% of recent live values
  const liveSnapshotCandidates = [...snapshotMergePoints]
    .reverse()
    .filter((p) => p.source === "live_refresh" && p.value > 0)
  const liveCandidateValues = liveSnapshotCandidates
    .slice(0, 20)
    .map((p) => p.value)
    .sort((a, b) => a - b)
  const liveCandidateMedian = liveCandidateValues.length >= 3
    ? liveCandidateValues[Math.floor(liveCandidateValues.length / 2)]
    : 0
  const latestLiveSnapshot = liveSnapshotCandidates.find((p) => {
    if (liveCandidateMedian > 0 && p.value < liveCandidateMedian * 0.10) return false
    return true
  }) ?? liveSnapshotCandidates[0]
  const reconstructedPoints = snapshotMergePoints
    .filter((p) => p.source === "reconstructed")
    .sort((a, b) => a.timestamp - b.timestamp)

  const matchingLiveSnapshots = [...snapshots].reverse().filter((s) => {
    if (s.source !== "live_refresh") return false
    const fp = getSnapshotWalletFingerprint(s.metadata)
    return !fp || fp === walletFingerprint
  })

  // Validate reference snapshot against recent history median.
  // A partial-fetch snapshot (e.g., $614 when portfolio is $110k) would
  // catastrophically scale the entire chart if used as the reference.
  const recentOnchainValues = matchingLiveSnapshots
    .slice(0, 30)
    .map((s) => onchainValueFromSnapshot(s))
    .filter((v) => v > 0)
    .sort((a, b) => a - b)
  const recentMedian = recentOnchainValues.length >= 3
    ? recentOnchainValues[Math.floor(recentOnchainValues.length / 2)]
    : 0

  const isValidReference = (s: (typeof matchingLiveSnapshots)[0]): boolean => {
    const val = onchainValueFromSnapshot(s)
    if (val <= 0) return false
    // Skip if <10% of recent median — likely a partial-fetch artifact
    if (recentMedian > 0 && val < recentMedian * 0.10) {
      console.warn(`[snapshots] Skipping outlier reference: $${val.toFixed(0)} vs median $${recentMedian.toFixed(0)}`)
      return false
    }
    return true
  }

  const latestLiveWithExchange = matchingLiveSnapshots.find((s) => {
    const v = onchainValueFromSnapshot(s)
    return v > 0 && Math.abs(v - s.totalValue) > 0.01 && isValidReference(s)
  })
  const latestLiveRaw = latestLiveWithExchange
    ?? matchingLiveSnapshots.find(isValidReference)
    ?? matchingLiveSnapshots[0]

  const onchainRefValue = latestLiveRaw ? onchainValueFromSnapshot(latestLiveRaw) : undefined
  const onchainIsExact = onchainRefValue !== undefined
    && latestLiveRaw
    && Math.abs(onchainRefValue - latestLiveRaw.totalValue) > 0.01
  const onchainRefPoint: ChartPoint | undefined =
    latestLiveSnapshot && onchainIsExact
      ? { ...latestLiveSnapshot, value: onchainRefValue }
      : undefined

  return { onchainRefPoint, latestLiveSnapshot, reconstructedPoints, matchingLiveSnapshots }
}

// ── Zerion normalization to reference ──

interface NormalizeParams {
  zerionPoints: ChartPoint[]
  rangeSpecificZerionPoints: ChartPoint[]
  onchainRefPoint: ChartPoint | undefined
  zerionLowConfidence: boolean
}

export function normalizeZerionToRef(params: NormalizeParams): ChartPoint[] {
  const { rangeSpecificZerionPoints, onchainRefPoint, zerionLowConfidence } = params
  let { zerionPoints } = params

  if (!zerionLowConfidence && rangeSpecificZerionPoints.length > 0 && onchainRefPoint && onchainRefPoint.value > 0) {
    const safeRef = safeScaleReference(rangeSpecificZerionPoints)
    if (safeRef > 0) {
      const rangeScale = onchainRefPoint.value / safeRef
      if (rangeScale >= SCALE_FACTOR_MIN && rangeScale <= SCALE_FACTOR_MAX && rangeScale !== 1 && Number.isFinite(rangeScale)) {
        return rangeSpecificZerionPoints.map((p) => ({
          ...p,
          value: p.value * rangeScale,
        }))
      } else if (rangeScale < SCALE_FACTOR_MIN || rangeScale > SCALE_FACTOR_MAX) {
        console.warn(`[snapshots] Suppressed extreme range scale ${rangeScale.toFixed(3)} (ref=${onchainRefPoint.value}, zerion=${safeRef})`)
      }
    }
    return rangeSpecificZerionPoints
  }

  return zerionPoints
}

// ── Low confidence handling ──

interface LowConfidenceParams {
  userId: string
  walletFingerprint: string
  settingsObject: Record<string, unknown>
  transactionCount: number
  usableReconstructed: boolean
}

export async function handleLowConfidenceZerion(params: LowConfidenceParams): Promise<ChartPoint[]> {
  const { userId, walletFingerprint, settingsObject, transactionCount, usableReconstructed } = params

  await db.$transaction(async (tx) => {
    await tx.chartCache.deleteMany({ where: { userId } })
    const chartFields = JSON.stringify({ chartWalletFingerprint: walletFingerprint })
    const settingId = crypto.randomUUID()
    await tx.$executeRaw`
      INSERT INTO "PortfolioSetting" ("id", "userId", "settings")
      VALUES (${settingId}, ${userId}, ${chartFields}::jsonb)
      ON CONFLICT ("userId") DO UPDATE
      SET settings = ("PortfolioSetting".settings - 'chartZerionSuppressedUntil' - 'chartZerionSuppressedAt' - 'chartZerionSuppressedReason') || ${chartFields}::jsonb
    `
  })

  const lastReconstructionTriggerMs = typeof settingsObject.chartReconstructionRequestedAt === "string"
    ? Date.parse(settingsObject.chartReconstructionRequestedAt)
    : 0
  const shouldTriggerReconstruction =
    !usableReconstructed &&
    transactionCount > 0 &&
    (!Number.isFinite(lastReconstructionTriggerMs) || Date.now() - lastReconstructionTriggerMs > RECONSTRUCTION_TRIGGER_INTERVAL_MS)

  if (shouldTriggerReconstruction) {
    const reconstructionRequestedAt = new Date().toISOString()
    const reconFields = JSON.stringify({
      chartReconstructionRequestedAt: reconstructionRequestedAt,
      chartWalletFingerprint: walletFingerprint,
    })
    const reconSettingId = crypto.randomUUID()
    db.$executeRaw`
      INSERT INTO "PortfolioSetting" ("id", "userId", "settings")
      VALUES (${reconSettingId}, ${userId}, ${reconFields}::jsonb)
      ON CONFLICT ("userId") DO UPDATE
      SET settings = "PortfolioSetting".settings || ${reconFields}::jsonb
    `.catch((error: unknown) => {
      console.warn("[snapshots] Failed to mark reconstruction request:", error)
    })

    reconstructPortfolioHistory(userId)
      .then((result) => {
        console.log(`[snapshots] Low-confidence fallback reconstruction complete: ${result.snapshotsCreated} snapshots`)
      })
      .catch((error) => {
        console.warn("[snapshots] Low-confidence fallback reconstruction failed:", error)
      })
  }

  return []
}

// Re-export fetchProjectedChart from projector module
export { fetchProjectedChart } from "@/lib/portfolio/chart-position-projector"
