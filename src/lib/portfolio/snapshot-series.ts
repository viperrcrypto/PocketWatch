/**
 * Series sanitization and outlier removal for chart data.
 * Used by snapshot-helpers for Zerion and merged series processing.
 */

import type { ChartPoint } from "@/lib/portfolio/snapshot-helpers"

const OUTLIER_SPIKE_RATIO = 4
const OUTLIER_DROP_RATIO = 0.25
const MAX_FUTURE_SKEW_SEC = 60 * 60

// ── Shared outlier helpers ──

/** Detect points where value > ratio × average of both neighbors (unconditional, no recovery check). */
function detectNeighborOutliers(
  points: ChartPoint[],
  spikeRatio: number,
  dropRatio: number,
): Set<number> {
  const removed = new Set<number>()
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].value
    const curr = points[i].value
    const next = points[i + 1].value
    if (prev <= 0 || curr <= 0 || next <= 0) continue

    const neighborAvg = (prev + next) / 2
    if (curr > neighborAvg * spikeRatio || curr < neighborAvg * dropRatio) {
      removed.add(i)
    }
  }
  return removed
}

/**
 * Detect consecutive outlier runs (2-3 points) that all deviate from surrounding context.
 * Prevents consecutive bad points from validating each other in the adaptive pass.
 */
function detectConsecutiveOutliers(
  points: ChartPoint[],
  existingRemoved: Set<number>,
): Set<number> {
  const removed = new Set<number>()
  if (points.length < 7) return removed

  for (let start = 1; start < points.length - 3; start++) {
    // Try windows of size 2 and 3
    for (const windowSize of [2, 3]) {
      const end = start + windowSize
      if (end >= points.length - 1) continue

      // Collect context values (5 points before and after the window, excluding removed)
      const contextValues: number[] = []
      for (let j = Math.max(0, start - 5); j < start; j++) {
        if (!existingRemoved.has(j) && !removed.has(j) && points[j].value > 0) {
          contextValues.push(points[j].value)
        }
      }
      for (let j = end; j < Math.min(points.length, end + 5); j++) {
        if (!existingRemoved.has(j) && !removed.has(j) && points[j].value > 0) {
          contextValues.push(points[j].value)
        }
      }
      if (contextValues.length < 3) continue

      const sorted = [...contextValues].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      if (median <= 0) continue

      // Check if ALL points in the window deviate significantly
      let allDeviate = true
      for (let j = start; j < end; j++) {
        const ratio = points[j].value / median
        if (ratio <= 3.0 && ratio >= 0.33) {
          allDeviate = false
          break
        }
      }

      if (allDeviate) {
        // Monotonic-trend escape: if the window points form a consistent
        // trend (all increasing or all decreasing), this is likely a
        // legitimate multi-day move, not consecutive bad data.
        let isMonotonic = false
        if (end - start >= 2) {
          let allIncreasing = true
          let allDecreasing = true
          for (let j = start; j < end - 1; j++) {
            if (points[j + 1].value <= points[j].value) allIncreasing = false
            if (points[j + 1].value >= points[j].value) allDecreasing = false
          }
          // Also check that the trend connects to context (prev point before window)
          const prevIdx = start - 1
          if (prevIdx >= 0 && !existingRemoved.has(prevIdx) && points[prevIdx].value > 0) {
            const prevVal = points[prevIdx].value
            if (allIncreasing && points[start].value > prevVal) isMonotonic = true
            if (allDecreasing && points[start].value < prevVal) isMonotonic = true
          }
        }

        if (!isMonotonic) {
          for (let j = start; j < end; j++) removed.add(j)
        }
      }
    }
  }
  return removed
}

/**
 * Remove extreme outliers from Zerion chart data using fixed-ratio backstop
 * AND adaptive rolling-median detection for subtler transient anomalies.
 */
export function sanitizeZerionSeries(
  points: Array<[number, number]> | ChartPoint[],
  nowSec: number
): ChartPoint[] {
  const futureCutoff = nowSec + MAX_FUTURE_SKEW_SEC
  const byTimestamp = new Map<number, number>()

  for (const point of points) {
    const timestamp = Array.isArray(point) ? point[0] : point.timestamp
    const value = Array.isArray(point) ? point[1] : point.value

    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) continue
    if (timestamp > futureCutoff) continue
    if (value < 0) continue

    const existing = byTimestamp.get(timestamp)
    if (existing === undefined || value > existing) {
      byTimestamp.set(timestamp, value)
    }
  }

  const sorted = Array.from(byTimestamp.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, value]) => ({ timestamp, value, source: "zerion" }))

  if (sorted.length < 3) return sorted

  // Pass 1: Fixed-ratio backstop — remove single-point extreme outliers
  const pass1Removed = detectNeighborOutliers(sorted, OUTLIER_SPIKE_RATIO, OUTLIER_DROP_RATIO)
  const afterPass1 = pass1Removed.size > 0
    ? interpolateRemovedPoints(sorted, pass1Removed, "zerion")
    : sorted

  if (afterPass1.length < 10) return afterPass1

  // Pass 2: Adaptive rolling-median detection for transient glitches
  const WINDOW_SIZE = 7
  const DROP_THRESHOLD = 0.40
  const SPIKE_THRESHOLD = 1.5
  const RECOVERY_WINDOW = 3
  const adaptiveRemoved = new Set<number>()

  for (let i = 1; i < afterPass1.length - 1; i++) {
    const windowStart = Math.max(0, i - WINDOW_SIZE)
    const windowEnd = Math.min(afterPass1.length, i + WINDOW_SIZE + 1)
    const window: number[] = []
    for (let j = windowStart; j < windowEnd; j++) {
      if (j !== i) window.push(afterPass1[j].value)
    }
    if (window.length < 3) continue

    const sortedWindow = [...window].sort((a, b) => a - b)
    const median = sortedWindow[Math.floor(sortedWindow.length / 2)]
    if (median <= 0) continue

    const curr = afterPass1[i].value
    const deviationDown = (median - curr) / median
    const deviationUp = (curr - median) / median

    const isTransientDip = deviationDown > DROP_THRESHOLD
    const isTransientSpike = deviationUp > SPIKE_THRESHOLD

    if (!isTransientDip && !isTransientSpike) continue

    let recovers = false
    for (let j = 1; j <= RECOVERY_WINDOW && i + j < afterPass1.length; j++) {
      const futureValue = afterPass1[i + j].value
      const recoveryDeviation = Math.abs(futureValue - median) / median
      if (recoveryDeviation < 0.10) {
        recovers = true
        break
      }
    }

    if (recovers) {
      adaptiveRemoved.add(i)
    }
  }

  // Pass 3: Consecutive-outlier detection (catches 2-3 bad points that validate each other)
  const consecutiveRemoved = detectConsecutiveOutliers(afterPass1, adaptiveRemoved)
  for (const idx of consecutiveRemoved) adaptiveRemoved.add(idx)

  if (adaptiveRemoved.size === 0) return afterPass1

  return interpolateRemovedPoints(afterPass1, adaptiveRemoved, "zerion")
}

/**
 * Two-pass outlier removal on final merged series:
 * Pass 1: Fixed-ratio backstop (>4x spike, <0.25x drop vs both neighbors)
 * Pass 2: Adaptive rolling-median (>20% dip / >40% spike from rolling median, recovers within 2 points)
 * Pass 3: Consecutive-outlier detection (2-3 adjacent bad points)
 */
export function sanitizeSeriesOutliers(points: ChartPoint[]): ChartPoint[] {
  if (points.length < 3) return points

  // Pass 1: Fixed-ratio backstop for extreme outliers
  const removed = detectNeighborOutliers(points, OUTLIER_SPIKE_RATIO, OUTLIER_DROP_RATIO)
  const afterPass1 = removed.size > 0
    ? interpolateRemovedPoints(points, removed, "interpolated")
    : points

  // Pass 2: Adaptive rolling-median for transient dips/spikes
  if (afterPass1.length < 5) return afterPass1

  const WINDOW = 5
  const DROP_THRESHOLD = 0.20
  const SPIKE_THRESHOLD = 0.40
  const RECOVERY_WINDOW = 2

  const adaptiveRemoved = new Set<number>()

  for (let i = 1; i < afterPass1.length - 1; i++) {
    const windowStart = Math.max(0, i - WINDOW)
    const window = afterPass1.slice(windowStart, i).map((p) => p.value)
    if (window.length < 2) continue

    const sortedWindow = [...window].sort((a, b) => a - b)
    const median = sortedWindow[Math.floor(sortedWindow.length / 2)]
    if (median <= 0) continue

    const curr = afterPass1[i].value
    const deviationDown = (median - curr) / median
    const deviationUp = (curr - median) / median

    const isTransientDip = deviationDown > DROP_THRESHOLD
    const isTransientSpike = deviationUp > SPIKE_THRESHOLD

    if (!isTransientDip && !isTransientSpike) continue

    let recovers = false
    for (let j = 1; j <= RECOVERY_WINDOW && i + j < afterPass1.length; j++) {
      const futureValue = afterPass1[i + j].value
      const recoveryDeviation = Math.abs(futureValue - median) / median
      if (recoveryDeviation < 0.10) {
        recovers = true
        break
      }
    }

    if (recovers) {
      adaptiveRemoved.add(i)
    }
  }

  // Pass 3: Consecutive-outlier detection
  const consecutiveRemoved = detectConsecutiveOutliers(afterPass1, adaptiveRemoved)
  for (const idx of consecutiveRemoved) adaptiveRemoved.add(idx)

  if (adaptiveRemoved.size === 0) return afterPass1

  return interpolateRemovedPoints(afterPass1, adaptiveRemoved, "interpolated")
}

/**
 * Compute a safe scale reference value from the tail of a series.
 * If the last point is an outlier relative to the tail median, returns the median instead.
 * Prevents a single bad endpoint from catastrophically scaling the entire series.
 */
export function safeScaleReference(points: ChartPoint[], count = 10): number {
  if (points.length === 0) return 0
  const tail = points.slice(-count)
  const values = tail.map((p) => p.value).filter((v) => v > 0).sort((a, b) => a - b)
  if (values.length === 0) return 0
  const median = values[Math.floor(values.length / 2)]
  const last = points[points.length - 1].value
  if (last <= 0 || median <= 0) return median
  const ratio = last / median
  return (ratio > 2.0 || ratio < 0.5) ? median : last
}

/** Replace removed points with linearly interpolated values. */
function interpolateRemovedPoints(
  points: ChartPoint[],
  removedIndices: Set<number>,
  source: string
): ChartPoint[] {
  const result: ChartPoint[] = []
  for (let i = 0; i < points.length; i++) {
    if (!removedIndices.has(i)) {
      result.push(points[i])
      continue
    }

    let prevIdx = i - 1
    while (prevIdx >= 0 && removedIndices.has(prevIdx)) prevIdx--
    let nextIdx = i + 1
    while (nextIdx < points.length && removedIndices.has(nextIdx)) nextIdx++

    if (prevIdx < 0 || nextIdx >= points.length) {
      result.push(points[i])
      continue
    }

    const prev = points[prevIdx]
    const next = points[nextIdx]
    const gap = next.timestamp - prev.timestamp
    if (gap <= 0) {
      result.push(points[i])
      continue
    }

    const ratio = (points[i].timestamp - prev.timestamp) / gap
    result.push({
      timestamp: points[i].timestamp,
      value: prev.value + (next.value - prev.value) * ratio,
      source,
    })
  }
  return result
}
