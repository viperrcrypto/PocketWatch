/**
 * Staking DB queries — barrel re-export.
 * Split into: db-record-conversion, db-tx-context, db-summary-backfill.
 */

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
