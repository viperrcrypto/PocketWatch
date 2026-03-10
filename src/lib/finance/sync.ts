/**
 * Unified sync orchestrator — barrel re-export.
 * Split into: sync/helpers, sync/plaid-sync, sync/simplefin-sync, sync/snapshots, sync/index.
 */

export type { SyncResult } from "./sync/helpers"
export { reconcileProviderDuplicates } from "./sync/helpers"
export { syncPlaid, fetchFullPlaidHistory } from "./sync/plaid-sync"
export { syncSimpleFIN } from "./sync/simplefin-sync"
export { saveFinanceSnapshot, backfillHistoricalSnapshots } from "./sync/snapshots"
export { syncInstitution, syncAllInstitutions } from "./sync/index"
