/**
 * Helper functions for the portfolio history snapshots route.
 * Types, constants, metadata parsing, range filtering, confidence checks,
 * interpolation, and wallet helpers.
 *
 * Series sanitization lives in snapshot-series.ts to keep files under 400 lines.
 */

import { normalizeWalletAddress } from "@/lib/portfolio/utils"

// Re-export series sanitization functions
export { sanitizeZerionSeries, sanitizeSeriesOutliers, safeScaleReference } from "@/lib/portfolio/snapshot-series"

// ── Types ──

export type SnapshotRange = "ALL" | "1Y" | "3M" | "1W" | "1D"
export type SnapshotScope = "onchain" | "total"
export type SnapshotStatus = "ready" | "syncing" | "insufficient_history"
export type SnapshotWarningCode =
  | "onchain_sync_incomplete"
  | "onchain_missing_coverage"
  | "total_sparse_history"
  | null
export type SnapshotFormat = "legacy" | "envelope"

export interface ChartPoint {
  timestamp: number
  value: number
  source: string
}

// ── Constants ──

export const CHART_CACHE_TTL_SEC = parseInt(process.env.CHART_CACHE_TTL_SEC ?? "", 10) || 6 * 60 * 60
export const MAX_FUTURE_SKEW_SEC = 60 * 60
export const ZERION_STALE_WINDOW_SEC = 3 * 86400
export const ZERION_LIVE_RATIO_MIN = 0.33
export const ZERION_LIVE_RATIO_MAX = 3.0
export const RECONSTRUCTION_TRIGGER_INTERVAL_MS = 6 * 60 * 60 * 1000
export const RECONSTRUCTION_MIN_POINTS = 30
export const LEGACY_LIVE_SNAPSHOT_WINDOW_SEC = 36 * 60 * 60
export const TOTAL_MIN_POINTS_FOR_READY = 8
export const DAY_SEC = 86400

export const RANGE_SECONDS: Record<Exclude<SnapshotRange, "ALL">, number> = {
  "1D": 86400,
  "1W": 7 * 86400,
  "3M": 90 * 86400,
  "1Y": 365 * 86400,
}

export const SOURCE_PRIORITY: Record<string, number> = {
  live_refresh: 4,
  reconstructed: 3,
  zerion: 2,
  unknown: 1,
}

// Shared scale factor bounds — used across all normalization paths
export const SCALE_FACTOR_MIN = 0.33
export const SCALE_FACTOR_MAX = 3.0

// ── Normalizers ──

export function normalizeRange(input: string | null): SnapshotRange {
  const value = (input ?? "ALL").toUpperCase()
  if (value === "1D" || value === "1W" || value === "3M" || value === "1Y" || value === "ALL") {
    return value
  }
  return "ALL"
}

export function normalizeScope(input: string | null): SnapshotScope {
  const value = (input ?? "total").toLowerCase()
  if (value === "onchain") return "onchain"
  return "total"
}

export function normalizeFormat(input: string | null): SnapshotFormat {
  return input === "legacy" ? "legacy" : "envelope"
}

export function toIso(timestampSec: number | null): string | null {
  if (!timestampSec || !Number.isFinite(timestampSec) || timestampSec <= 0) return null
  return new Date(timestampSec * 1000).toISOString()
}

// ── Metadata parsing ──

export function parseMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata) return null
  if (typeof metadata === "object") return metadata as Record<string, unknown>
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata)
      if (parsed && typeof parsed === "object") return parsed
    } catch {
      return null
    }
  }
  return null
}

export function getSnapshotWalletFingerprint(metadata: unknown): string | null {
  const parsed = parseMetadata(metadata)
  if (!parsed) return null
  const fingerprint = parsed.walletFingerprint
  if (typeof fingerprint !== "string" || !fingerprint.trim()) return null
  return fingerprint
}

export function onchainValueFromSnapshot(snapshot: { totalValue: number; source: string | null; metadata: unknown }): number {
  const source = snapshot.source ?? "unknown"

  if (source === "live_refresh") {
    const parsed = parseMetadata(snapshot.metadata)
    if (parsed) {
      const directValue = parsed.onchainTotalValue
      if (typeof directValue === "number" && Number.isFinite(directValue) && directValue > 0) {
        return directValue
      }

      const chainDistribution = parsed.chainDistribution
      if (chainDistribution && typeof chainDistribution === "object") {
        let total = 0
        for (const [chain, raw] of Object.entries(chainDistribution as Record<string, unknown>)) {
          if (chain === "exchange") continue
          const value = Number(raw)
          if (Number.isFinite(value) && value > 0) total += value
        }
        if (total > 0) return total
      }
    }
  }

  return snapshot.totalValue
}

// ── Range & filtering ──

export function applyRange(points: ChartPoint[], range: SnapshotRange, nowSec: number): ChartPoint[] {
  if (range === "ALL") return points

  const windowSec = RANGE_SECONDS[range]
  const cutoff = nowSec - windowSec
  const firstInsideIdx = points.findIndex((p) => p.timestamp >= cutoff)

  if (firstInsideIdx === -1) {
    return points.length > 0 ? [points[points.length - 1]] : []
  }

  if (firstInsideIdx > 0) {
    const previous = points[firstInsideIdx - 1]
    const firstInside = points[firstInsideIdx]
    if (firstInside.timestamp - previous.timestamp > windowSec * 1.5) {
      return points.slice(firstInsideIdx)
    }
    return points.slice(firstInsideIdx - 1)
  }

  return points.slice(firstInsideIdx)
}

// ── Zerion confidence & pruning ──

export function pruneDivergentZerionTail(
  zerionPoints: ChartPoint[],
  livePoint: ChartPoint
): { points: ChartPoint[]; removedTimestamps: number[] } {
  if (zerionPoints.length < 3 || livePoint.value <= 0) {
    return { points: zerionPoints, removedTimestamps: [] }
  }

  const windowStart = livePoint.timestamp - 10 * 86400
  const tail = zerionPoints.filter((point) => point.timestamp >= windowStart)
  if (tail.length < 3) {
    return { points: zerionPoints, removedTimestamps: [] }
  }

  const sortedValues = tail.map((point) => point.value).sort((a, b) => a - b)
  const median = sortedValues[Math.floor(sortedValues.length / 2)]
  const ratio = median / livePoint.value

  if (ratio > 2.0 || ratio < 0.5) {
    const kept = zerionPoints.filter((point) => point.timestamp < windowStart)
    const removed = zerionPoints
      .filter((point) => point.timestamp >= windowStart)
      .map((point) => point.timestamp)
    return { points: kept, removedTimestamps: removed }
  }

  return { points: zerionPoints, removedTimestamps: [] }
}

export function isZerionLowConfidence(
  zerionPoints: ChartPoint[],
  livePoint: ChartPoint | undefined
): boolean {
  if (!livePoint || zerionPoints.length === 0 || livePoint.value <= 0) return false

  const last = zerionPoints[zerionPoints.length - 1]
  const ageSec = livePoint.timestamp - last.timestamp
  if (ageSec > ZERION_STALE_WINDOW_SEC) return true

  const endRatio = last.value / livePoint.value
  if (endRatio < ZERION_LIVE_RATIO_MIN || endRatio > ZERION_LIVE_RATIO_MAX) return true

  // Check for spikes/dips in the tail — if any of the last 10 points deviates
  // from the tail median by more than 3x, the data is unreliable.
  const tailPoints = zerionPoints.slice(-10)
  if (tailPoints.length >= 5) {
    const tailValues = tailPoints.map((p) => p.value).sort((a, b) => a - b)
    const tailMedian = tailValues[Math.floor(tailValues.length / 2)]
    if (tailMedian > 0) {
      const hasSpike = tailPoints.some((p) => p.value / tailMedian > 3 || p.value / tailMedian < 0.33)
      if (hasSpike) return true
    }
  }

  return false
}

export function hasUsableReconstructedHistory(
  reconstructedPoints: ChartPoint[],
  livePoint: ChartPoint | undefined
): boolean {
  if (reconstructedPoints.length < RECONSTRUCTION_MIN_POINTS) return false
  if (!livePoint) return true

  const latestReconstructed = reconstructedPoints[reconstructedPoints.length - 1]
  const ageSec = livePoint.timestamp - latestReconstructed.timestamp
  if (ageSec > 30 * 86400) return false
  if (livePoint.value <= 0 || latestReconstructed.value <= 0) return false

  const ratio = latestReconstructed.value / livePoint.value
  return ratio >= 0.15 && ratio <= 5.0
}

// ── Interpolation & bridging ──

export function interpolateSparseGaps(
  points: ChartPoint[],
  maxGapSec: number = 3 * 86400
): ChartPoint[] {
  if (points.length < 2) return points

  const result: ChartPoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const gap = curr.timestamp - prev.timestamp

    if (gap > maxGapSec) {
      const steps = Math.floor(gap / 86400)
      const minVal = Math.min(prev.value, curr.value)
      const maxVal = Math.max(prev.value, curr.value)
      for (let s = 1; s < steps; s++) {
        const t = prev.timestamp + s * 86400
        const ratio = (t - prev.timestamp) / gap
        const interpolated = prev.value + (curr.value - prev.value) * ratio
        result.push({
          timestamp: t,
          value: Math.min(Math.max(interpolated, minVal), maxVal),
          source: "interpolated",
        })
      }
    }
    result.push(curr)
  }

  return result
}

export function bridgeLiveGap(
  points: ChartPoint[],
  liveSnapshot: ChartPoint
): ChartPoint[] {
  if (points.length === 0) return points

  const last = points[points.length - 1]
  const gapSec = liveSnapshot.timestamp - last.timestamp
  if (gapSec <= 0) return points

  const valueDrift = Math.abs(last.value - liveSnapshot.value) / Math.max(liveSnapshot.value, 1)
  if (valueDrift <= 0.10) return points

  const result = [...points]
  if (gapSec > 2 * 86400) {
    // Multi-day gap: use daily interpolation steps (up to 7 days)
    const stepSec = 86400
    const steps = Math.min(Math.floor(gapSec / stepSec), 7)
    for (let s = 1; s <= steps; s++) {
      const t = last.timestamp + s * stepSec
      if (t >= liveSnapshot.timestamp) break
      const ratio = (t - last.timestamp) / gapSec
      result.push({
        timestamp: t,
        value: last.value + (liveSnapshot.value - last.value) * ratio,
        source: "bridge",
      })
    }
  } else if (gapSec > 2 * 3600) {
    // Sub-2-day gap: hourly interpolation (up to 48 hours)
    const stepSec = 3600
    const steps = Math.min(Math.floor(gapSec / stepSec), 48)
    for (let s = 1; s <= steps; s++) {
      const t = last.timestamp + s * stepSec
      if (t >= liveSnapshot.timestamp) break
      const ratio = (t - last.timestamp) / gapSec
      result.push({
        timestamp: t,
        value: last.value + (liveSnapshot.value - last.value) * ratio,
        source: "bridge",
      })
    }
  } else {
    for (let s = 1; s <= 3; s++) {
      const t = last.timestamp + Math.floor((gapSec * s) / 4)
      if (t >= liveSnapshot.timestamp) break
      const ratio = s / 4
      result.push({
        timestamp: t,
        value: last.value + (liveSnapshot.value - last.value) * ratio,
        source: "bridge",
      })
    }
  }

  return result
}

export function interpolateExchangeValue(
  timestamp: number,
  timeline: Array<{ timestamp: number; value: number }>
): number {
  if (timeline.length === 0) return 0
  // Extrapolate earliest known exchange balance backward — the user likely
  // had at least this much before we started tracking (exchange APIs have
  // limited history). This is a conservative floor, not an overestimate.
  if (timestamp < timeline[0].timestamp) return timeline[0].value
  if (timestamp >= timeline[timeline.length - 1].timestamp) return timeline[timeline.length - 1].value
  for (let i = 0; i < timeline.length - 1; i++) {
    if (timestamp >= timeline[i].timestamp && timestamp <= timeline[i + 1].timestamp) {
      const t1 = timeline[i].timestamp
      const t2 = timeline[i + 1].timestamp
      const v1 = timeline[i].value
      const v2 = timeline[i + 1].value
      const ratio = (timestamp - t1) / (t2 - t1)
      return v1 + (v2 - v1) * ratio
    }
  }
  return timeline[timeline.length - 1].value
}

// ── Wallet helpers ──

export function buildWalletFingerprint(addresses: string[]): string {
  const sorted = [...addresses].sort((a, b) => a.localeCompare(b))
  return sorted.map(normalizeWalletAddress).join("|")
}

export function getNormalizedAddresses(addresses: string[]): string[] {
  return addresses.map(normalizeWalletAddress)
}

/**
 * Check if a projected chart has meaningful price variance.
 * A flat projection (CoV < 3%) means the portfolio is stablecoin-heavy —
 * the projected chart provides no useful historical shape information.
 *
 * The 3% CoV threshold is conservative: a portfolio with 99% stablecoins and
 * 1% ETH would have CoV ≈ 0.3%, well below the threshold. Even a 10% volatile
 * allocation with 30% price swings only produces ~3% CoV, so this threshold
 * correctly identifies stablecoin-dominated portfolios without false positives.
 */
const FLAT_CHART_MIN_POINTS = 10
const FLAT_CHART_COV_THRESHOLD = 0.03

export function isProjectedChartFlat(points: ChartPoint[]): boolean {
  if (points.length < FLAT_CHART_MIN_POINTS) return false
  const values = points.map((p) => p.value).filter((v) => v > 0)
  if (values.length < FLAT_CHART_MIN_POINTS) return false
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  if (mean <= 0) return false
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  const cov = Math.sqrt(variance) / mean
  return cov < FLAT_CHART_COV_THRESHOLD
}
