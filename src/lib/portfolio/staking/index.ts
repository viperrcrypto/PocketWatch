/**
 * Staking lifecycle — barrel re-exports.
 * All logic lives in focused sub-modules.
 */

// ─── Core coordinator ───
export { syncStakingLifecycle } from "./sync-coordinator"

// ─── DB queries ───
export {
  toRecordFromDb,
  getFrozenPositionKeys,
  buildSymbolAliases,
  diagnoseTransactionGaps,
} from "./db-record-conversion"
export type { PositionGap, TransactionGapDiagnostics } from "./db-record-conversion"
export { buildTxContext } from "./db-tx-context"
export {
  getDefaultSummary,
  computeYearlySummary,
  maybeBackfill,
  discoverHistoricalClosedCandidates,
} from "./db-summary-backfill"

// ─── Flow reconstruction ───
export { pickFlow, reconstructFlowFromLedger, fallbackAggregateFlow, addToAgg, isReceiptTokenPosition } from "./flow-reconstruction"

// ─── Economic math ───
export { computeEconomic, computeNativeEconomic, computeNativeYieldForReceipt, computeEconomicYieldUsd, combineConfidence, confidenceFromFlow } from "./economic-math"

// ─── Freeze gate ───
export { buildPositionKey } from "./constants"
export { isDustPosition, passesFreezeGate, shouldReopenFrozenPosition, hasPendingRewards } from "./freeze-gate"

// ─── History ───
export { getStakingHistoryV2, resetStakingLifecycleData, runFrozenIntegritySweep } from "./history"

// ─── Types ───
export * from "./types"

// ─── Constants ───
export {
  round2,
  hourStart,
  toEpochSeconds,
  isFutureMaturity,
  yearStartUtc,
  yearEndUtc,
  getTxChain,
  getZerionChainFromTx,
  toAssetKey,
  toSymbolKey,
  walletChainKey,
  toTxKey,
  isStableUnderlying,
  HOUR_MS,
  FREEZE_DUST_STREAK,
  DUST_QTY_THRESHOLD,
  DUST_USD_THRESHOLD,
  MAX_BACKFILL_ROWS,
  CONFIDENCE_RANK,
  ZERION_TO_TX_CHAIN,
  TX_TO_ZERION_CHAIN,
  RECEIPT_PROJECTS,
  RECEIPT_SYMBOL_PATTERNS,
  REWARD_CATEGORY_HINTS,
  KNOWN_REWARD_DISTRIBUTORS,
  STABLE_UNDERLYING_SYMBOLS,
} from "./constants"
