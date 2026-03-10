/**
 * Barrel re-export for transaction-fetcher module.
 * All public types and functions are re-exported for backward compatibility.
 */

export type {
  AlchemyCategory,
  SyncDirection,
  AlchemyTransfer,
  AlchemyResponse,
  HistoryJobStatus,
  SyncErrorDetail,
  WalletChainSyncResult,
  HistorySyncRunResult,
  SyncStepOptions,
} from "./types"

export {
  CATEGORIES,
  PHASES,
  WINDOW_BLOCKS,
  INCREMENTAL_WINDOW_BLOCKS,
  MAX_STEP_REQUESTS_DEFAULT,
  MAX_STEP_MS_DEFAULT,
} from "./types"

export {
  phaseToString,
  parsePhase,
  nextPhase,
  classifyAlchemyError,
  throttleDetailFromError,
  fetchLatestBlock,
  sleep,
  deriveTransferValue,
} from "./helpers"

export {
  SYNC_CHAINS,
  ensureWalletChainSyncState,
  ensureSyncStatesForUser,
  getLatestHistorySyncJob,
  getSyncProgress,
  isIncrementalSyncStale,
  scheduleIncrementalSync,
} from "./sync-state"

export { syncWalletTransactionsStep } from "./evm"

export {
  startOrResumeHistorySyncJob,
  buildCursorSnapshot,
} from "./job-manager"

export { runHistorySyncWorker } from "./worker"
