import { round2 } from "./constants"
import type { YieldSource } from "../yields"
import type { StakingDataConfidence, YieldMetricsState, FlowTotals } from "./types"
import { DUST_USD_THRESHOLD } from "./constants"

// ─── Guard-rail constants ───

/** Yield cannot exceed 200% of deposited amount (catches runaway calculations) */
const MAX_YIELD_RATIO = 2.0
/** Yield cannot be more negative than the deposited amount */
const MIN_YIELD_RATIO = -1.0

export function confidenceFromFlow(
  source: YieldSource | null,
  flow: FlowTotals,
  hasFlowData: boolean,
): { confidence: StakingDataConfidence; reason: string } {
  if (flow.confidence === "exact") {
    return {
      confidence: "exact",
      reason: flow.confidenceReason || "Transaction-level economic flow reconstruction",
    }
  }

  if (flow.confidence === "modeled" || hasFlowData) {
    return {
      confidence: "modeled",
      reason: flow.confidenceReason || "Transaction-reconstructed flow model",
    }
  }

  if (source === "on-chain" || source === "pendle-api") {
    return {
      confidence: "estimated",
      reason: "APY source is exact, but flow history is still missing",
    }
  }

  return {
    confidence: "estimated",
    reason: flow.confidenceReason || "APY interpolation fallback",
  }
}

export function combineConfidence(confidences: StakingDataConfidence[]): StakingDataConfidence {
  if (confidences.length === 0) return "estimated"
  if (confidences.includes("estimated")) return "estimated"
  if (confidences.includes("modeled")) return "modeled"
  return "exact"
}

export function resolveYieldMetricsState(
  currentValueUsd: number,
  flow: FlowTotals,
  yieldEarnedUsd: number,
): { state: YieldMetricsState; reason: string | null } {
  const hasFlows = flow.depositedUsd > 0 || flow.withdrawnUsd > 0 || flow.claimedUsd > 0
  if (!hasFlows) {
    return {
      state: "insufficient_history",
      reason: "Waiting for transaction reconstruction",
    }
  }

  if (flow.depositedUsd <= 0 && (flow.withdrawnUsd > 0 || currentValueUsd > DUST_USD_THRESHOLD)) {
    return {
      state: "recomputing",
      reason: "Flow reconstruction incomplete (deposits missing)",
    }
  }

  if (!Number.isFinite(yieldEarnedUsd)) {
    return {
      state: "recomputing",
      reason: "Yield math still reconciling",
    }
  }

  // Guard rail: check if yield was clamped (exceeds sanity bounds)
  if (flow.depositedUsd > 0) {
    const yieldRatio = yieldEarnedUsd / flow.depositedUsd
    if (yieldRatio > MAX_YIELD_RATIO || yieldRatio < MIN_YIELD_RATIO) {
      return {
        state: "clamped",
        reason: `Yield exceeded sanity bounds (${(yieldRatio * 100).toFixed(0)}% of deposited)`,
      }
    }
  }

  return {
    state: "valid",
    reason: null,
  }
}

/**
 * Clamp yield values to sanity bounds.
 * Returns clamped values and whether clamping was applied.
 */
export function clampYield(
  yieldEarnedUsd: number,
  yieldEarnedPct: number | null,
  depositedUsd: number,
): { yieldEarnedUsd: number; yieldEarnedPct: number | null; wasClamped: boolean } {
  if (depositedUsd <= 0) return { yieldEarnedUsd, yieldEarnedPct, wasClamped: false }

  const maxYield = depositedUsd * MAX_YIELD_RATIO
  const minYield = depositedUsd * MIN_YIELD_RATIO

  if (yieldEarnedUsd > maxYield) {
    return {
      yieldEarnedUsd: round2(maxYield),
      yieldEarnedPct: round2(MAX_YIELD_RATIO * 100),
      wasClamped: true,
    }
  }

  if (yieldEarnedUsd < minYield) {
    return {
      yieldEarnedUsd: round2(minYield),
      yieldEarnedPct: round2(MIN_YIELD_RATIO * 100),
      wasClamped: true,
    }
  }

  return { yieldEarnedUsd, yieldEarnedPct, wasClamped: false }
}

export function computeEconomic(
  currentValueUsd: number,
  depositedUsd: number,
  withdrawnUsd: number,
  claimedUsd: number,
): {
  principalUsd: number
  yieldEarnedUsd: number
  yieldEarnedPct: number | null
} {
  const principalUsd = Math.max(0, depositedUsd - withdrawnUsd)
  const yieldEarnedUsd = withdrawnUsd + currentValueUsd + claimedUsd - depositedUsd
  const yieldEarnedPct = depositedUsd > 0 ? (yieldEarnedUsd / depositedUsd) * 100 : null

  return {
    principalUsd: round2(principalUsd),
    yieldEarnedUsd: round2(yieldEarnedUsd),
    yieldEarnedPct: yieldEarnedPct === null ? null : round2(yieldEarnedPct),
  }
}

export function computeNativeEconomic(
  currentQuantity: number,
  depositedNative: number,
  withdrawnNative: number,
  currentPriceUsd: number,
): { yieldEarnedNative: number; yieldEarnedUsd: number; yieldEarnedPct: number | null } {
  const yieldEarnedNative = withdrawnNative + currentQuantity - depositedNative
  const yieldEarnedUsd = round2(yieldEarnedNative * currentPriceUsd)
  const yieldEarnedPct = depositedNative > 0
    ? round2((yieldEarnedNative / depositedNative) * 100)
    : null

  return { yieldEarnedNative, yieldEarnedUsd, yieldEarnedPct }
}

/**
 * Receipt-token-aware native yield calculation.
 *
 * For receipt tokens (PT-sUSDai, weETH, aTokens), position.quantity/price
 * are in receipt-token units, but flow.depositedNative/withdrawnNative
 * track the *underlying* token. This function derives the underlying price
 * from flow data and converts currentValueUsd back to underlying qty.
 *
 * Returns null if the data is insufficient (caller falls through to USD math).
 */
export function computeNativeYieldForReceipt(
  currentValueUsd: number,
  depositedUsd: number,
  depositedNative: number,
  withdrawnNative: number,
): { yieldEarnedUsd: number; yieldEarnedPct: number | null } | null {
  if (depositedNative <= 0 || depositedUsd <= 0) return null

  const underlyingPrice = depositedUsd / depositedNative

  if (currentValueUsd <= DUST_USD_THRESHOLD) {
    // Closed position: yield is purely withdrawn - deposited (in underlying units)
    const yieldNative = withdrawnNative - depositedNative
    const yieldEarnedUsd = round2(yieldNative * underlyingPrice)
    const yieldEarnedPct = round2((yieldNative / depositedNative) * 100)
    return { yieldEarnedUsd, yieldEarnedPct }
  }

  // Active position: estimate current underlying qty from USD value
  const currentUnderlyingQty = currentValueUsd / underlyingPrice
  const yieldNative = withdrawnNative + currentUnderlyingQty - depositedNative
  const yieldEarnedUsd = round2(yieldNative * underlyingPrice)
  const yieldEarnedPct = round2((yieldNative / depositedNative) * 100)
  return { yieldEarnedUsd, yieldEarnedPct }
}

/** Public convenience wrapper — same signature as before. */
export function computeEconomicYieldUsd(
  currentValueUsd: number,
  depositedUsd: number,
  withdrawnUsd: number,
  claimedUsd: number,
): {
  principalUsd: number
  yieldEarnedUsd: number
  yieldEarnedPct: number | null
} {
  return computeEconomic(currentValueUsd, depositedUsd, withdrawnUsd, claimedUsd)
}
