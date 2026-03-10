/**
 * Data validation layer for chart and snapshot data.
 * Validates points before DB insertion to prevent bad data from entering the pipeline.
 */

const MAX_FUTURE_SKEW_SEC = 60 * 60

interface ValidatablePoint {
  timestamp: number
  value: number
}

/** Validate a single chart point against recent history. Returns null if valid, reason string if invalid. */
export function validateChartPoint(
  point: ValidatablePoint,
  recentValues: number[],
): string | null {
  if (!Number.isFinite(point.value) || point.value <= 0) {
    return `invalid value: ${point.value}`
  }

  if (!Number.isFinite(point.timestamp) || point.timestamp <= 0) {
    return `invalid timestamp: ${point.timestamp}`
  }

  const nowSec = Math.floor(Date.now() / 1000)
  if (point.timestamp > nowSec + MAX_FUTURE_SKEW_SEC) {
    return `future timestamp: ${point.timestamp} (now=${nowSec})`
  }

  if (recentValues.length >= 3) {
    const sorted = [...recentValues].filter((v) => v > 0).sort((a, b) => a - b)
    if (sorted.length >= 3) {
      const median = sorted[Math.floor(sorted.length / 2)]
      if (median > 0) {
        const ratio = point.value / median
        if (ratio > 10 || ratio < 0.1) {
          return `extreme deviation: value=${point.value}, median=${median}, ratio=${ratio.toFixed(2)}`
        }
      }
    }
  }

  return null
}

interface FilterOptions {
  /** Maximum allowed day-over-day change ratio (default: 10) */
  maxDayOverDayChange?: number
  /** Minimum valid value (default: 0, exclusive) */
  minValue?: number
}

interface FilterResult<T> {
  valid: T[]
  rejected: Array<{ point: T; reason: string }>
}

/**
 * Validate a batch of points, returning only valid ones plus a rejection log.
 *
 * Uses a rolling window for local context AND a global median anchor to prevent
 * gradual drift where slowly rising/falling bad data eventually replaces
 * the rolling window's reference entirely.
 */
export function filterValidPoints<T extends ValidatablePoint>(
  points: T[],
  options?: FilterOptions,
): FilterResult<T> {
  const maxChange = options?.maxDayOverDayChange ?? 10
  const minValue = options?.minValue ?? 0

  const valid: T[] = []
  const rejected: Array<{ point: T; reason: string }> = []

  // Compute global median as a drift anchor — if the rolling window drifts
  // far from this, we catch it
  const allValues = points
    .map((p) => p.value)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b)
  const globalMedian = allValues.length >= 5
    ? allValues[Math.floor(allValues.length / 2)]
    : 0

  // Build a rolling window of recent valid values for context
  const recentValid: number[] = []
  const CONTEXT_SIZE = 10
  const GLOBAL_DEVIATION_LIMIT = 20 // reject if >20x or <0.05x global median

  for (const point of points) {
    // Basic validation
    if (!Number.isFinite(point.value) || point.value <= minValue) {
      rejected.push({ point, reason: `invalid value: ${point.value}` })
      continue
    }

    if (!Number.isFinite(point.timestamp) || point.timestamp <= 0) {
      rejected.push({ point, reason: `invalid timestamp: ${point.timestamp}` })
      continue
    }

    // Global median anchor check — catches gradual drift
    if (globalMedian > 0) {
      const globalRatio = point.value / globalMedian
      if (globalRatio > GLOBAL_DEVIATION_LIMIT || globalRatio < 1 / GLOBAL_DEVIATION_LIMIT) {
        rejected.push({ point, reason: `global deviation: value=${point.value}, globalMedian=${globalMedian}, ratio=${globalRatio.toFixed(2)}` })
        continue
      }
    }

    // Context-based validation
    const contextReason = validateChartPoint(point, recentValid)
    if (contextReason !== null) {
      rejected.push({ point, reason: contextReason })
      continue
    }

    // Day-over-day change check
    if (recentValid.length > 0) {
      const lastValid = recentValid[recentValid.length - 1]
      if (lastValid > 0) {
        const change = point.value / lastValid
        if (change > maxChange || change < 1 / maxChange) {
          rejected.push({ point, reason: `excessive change: ${change.toFixed(2)}x from previous` })
          continue
        }
      }
    }

    valid.push(point)
    recentValid.push(point.value)
    if (recentValid.length > CONTEXT_SIZE) recentValid.shift()
  }

  if (rejected.length > 0) {
    console.warn(`[snapshot-validation] Rejected ${rejected.length}/${points.length} points:`,
      rejected.slice(0, 5).map((r) => r.reason))
  }

  return { valid, rejected }
}

/**
 * Cap a blended value if exchange data appears suspect.
 * If adding exchange value would increase the point by more than capRatio, cap it.
 */
export function capBlendedValue(
  originalValue: number,
  exchangeValue: number,
  capRatio = 10,
): number {
  if (exchangeValue <= 0) return originalValue
  const blended = originalValue + exchangeValue
  const maxAllowed = originalValue * capRatio
  if (blended > maxAllowed && originalValue > 0) {
    console.warn(`[snapshot-validation] Capped exchange blend: ${blended.toFixed(0)} → ${maxAllowed.toFixed(0)} (exchange=${exchangeValue.toFixed(0)})`)
    return maxAllowed
  }
  return blended
}
