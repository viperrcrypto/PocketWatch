"use client"

import {
  useSyncProgress,
  useProcessHistory,
  useResetSync,
  useHistoryRepairSummary,
  type SyncProgressResponse,
} from "@/hooks/use-portfolio-tracker"
import { toast } from "sonner"
import { CollapsibleSection } from "./collapsible-section"
import { estimateSyncEtaMs } from "./settings-utils"
import {
  SyncStatusBadges,
  SyncProgressCard,
  RateLimitCard,
  DbCacheCard,
  KeyRotationCard,
  QualityChecklist,
} from "./sync-diagnostics-cards"

function deriveSyncMetrics(syncData: SyncProgressResponse | undefined) {
  const syncTotal = syncData?.totalSyncs ?? 0
  const syncProcessed = syncData?.processedSyncs ?? 0
  const syncFailed = syncData?.failedSyncs ?? 0
  const syncRemaining = Math.max(0, syncTotal - syncProcessed)
  const syncProgressPct = syncData?.progressPct ?? (syncTotal > 0 ? Math.round((syncProcessed / syncTotal) * 100) : 0)
  const syncStatus = syncData?.job?.status ?? "idle"
  const syncEtaMs = estimateSyncEtaMs(syncData)
  const allRows = syncData?.progress ?? []
  const txCached = allRows.reduce((sum, row) => sum + (row.transactionCount ?? 0), 0)
  const incrementalCount = allRows.filter((r) => r.syncMode === "incremental").length
  const anyIncremental = incrementalCount > 0
  const syncModeLabel = allRows.length === 0
    ? "—"
    : anyIncremental
      ? `Incremental (${incrementalCount}/${allRows.length} chains)`
      : "Historical"
  const maxHighWaterMark = allRows.reduce<number | null>((acc, r) => {
    if (r.highWaterMark === null || r.highWaterMark === undefined) return acc
    return acc === null ? r.highWaterMark : Math.max(acc, r.highWaterMark)
  }, null)
  const lastIncrementalComplete = allRows
    .filter((r) => r.syncMode === "incremental" && r.isComplete)
    .map((r) => Date.parse(r.updatedAt))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => b - a)[0] ?? null

  const nextAdvanceAtMs = typeof syncData?.nextAdvanceAt === "string"
    ? Date.parse(syncData.nextAdvanceAt)
    : Number.NaN
  const isActivelyThrottled = Boolean(syncData?.throttled)
    && Number.isFinite(nextAdvanceAtMs)
    && nextAdvanceAtMs > Date.now() + 1_000

  const rateLimitedCode = (syncData?.failedDetails ?? []).find((detail) => detail.code?.includes("rate_limited"))?.code ?? null
  const rateLimitedFromCode = rateLimitedCode?.startsWith("alchemy")
    ? "Alchemy"
    : rateLimitedCode?.startsWith("helius")
      ? "Helius"
      : rateLimitedCode
        ? "Provider"
        : null
  const blockedChains = (syncData?.progress ?? [])
    .filter((p) => !p.isComplete && p.retryAfter && Date.parse(p.retryAfter) > Date.now())
    .map((p) => p.chain.toLowerCase())
  const rateLimitedProvider = rateLimitedFromCode
    ?? (blockedChains.some((c) => c !== "solana") ? "Alchemy" : null)
    ?? (blockedChains.some((c) => c === "solana") ? "Helius" : null)
    ?? (syncData?.budgetState?.alchemy?.nextAllowedAt && Date.parse(syncData.budgetState.alchemy.nextAllowedAt) > Date.now() ? "Alchemy" : null)
    ?? (syncData?.budgetState?.helius?.nextAllowedAt && Date.parse(syncData.budgetState.helius.nextAllowedAt) > Date.now() ? "Helius" : null)

  return {
    syncTotal, syncProcessed, syncFailed, syncRemaining, syncProgressPct,
    syncStatus, syncEtaMs, txCached, allRows, anyIncremental, syncModeLabel,
    maxHighWaterMark, lastIncrementalComplete, nextAdvanceAtMs,
    isActivelyThrottled, rateLimitedProvider,
  }
}

export function SyncDiagnosticsSection() {
  const {
    data: syncData,
    isLoading: syncLoading,
    isFetching: syncFetching,
    refetch: refetchSync,
  } = useSyncProgress({ advance: true, reconstruct: true, autoStart: true })
  const {
    data: repairSummary,
    isLoading: repairSummaryLoading,
    isFetching: repairSummaryFetching,
    refetch: refetchRepairSummary,
  } = useHistoryRepairSummary(true)
  const processHistory = useProcessHistory()
  const resetSync = useResetSync()

  const m = deriveSyncMetrics(syncData)
  const hasCompleteCoverage = Boolean(repairSummary?.coverageStart?.iso)
  const syncQualityHealthy = Boolean(repairSummary)
    && (repairSummary?.sync?.incompleteSyncCount ?? 0) === 0
    && (repairSummary?.sync?.syncErrorCount ?? 0) === 0
  const missingKeyChains = [...new Set(
    (syncData?.progress ?? [])
      .filter((r) => r.phase === "needs_key" || r.lastErrorCode === "explorer_key_missing")
      .map((r) => r.chain)
  )]

  return (
    <CollapsibleSection
      title="History Sync Diagnostics"
      subtitle="Live progress, throttling source, and data-quality checks for on-chain history"
      actions={
        <SyncDiagnosticsActions
          syncStatus={m.syncStatus}
          isActivelyThrottled={m.isActivelyThrottled}
          syncFetching={syncFetching}
          repairSummaryFetching={repairSummaryFetching}
          processHistory={processHistory}
          resetSync={resetSync}
          refetchSync={refetchSync}
          refetchRepairSummary={refetchRepairSummary}
        />
      }
    >
      {(syncLoading || repairSummaryLoading) && !syncData && !repairSummary ? (
        <div className="p-5 space-y-4">
          <div className="h-4 w-40 bg-card-border animate-pulse rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="h-24 bg-card-border animate-pulse rounded-lg" />
            <div className="h-24 bg-card-border animate-pulse rounded-lg" />
            <div className="h-24 bg-card-border animate-pulse rounded-lg" />
          </div>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <SyncStatusBadges metrics={m} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SyncProgressCard metrics={m} missingKeyChains={missingKeyChains} repairSummary={repairSummary} />
            <RateLimitCard metrics={m} syncData={syncData} />
            <DbCacheCard metrics={m} repairSummary={repairSummary} hasCompleteCoverage={hasCompleteCoverage} />
            <KeyRotationCard syncData={syncData} />
          </div>
          <QualityChecklist
            syncRemaining={m.syncRemaining}
            repairSummary={repairSummary}
            hasCompleteCoverage={hasCompleteCoverage}
            syncQualityHealthy={syncQualityHealthy}
          />
        </div>
      )}
    </CollapsibleSection>
  )
}

function SyncDiagnosticsActions({
  syncStatus, isActivelyThrottled, syncFetching, repairSummaryFetching,
  processHistory, resetSync, refetchSync, refetchRepairSummary,
}: {
  syncStatus: string
  isActivelyThrottled: boolean
  syncFetching: boolean
  repairSummaryFetching: boolean
  processHistory: ReturnType<typeof useProcessHistory>
  resetSync: ReturnType<typeof useResetSync>
  refetchSync: () => void
  refetchRepairSummary: () => void
}) {
  return (
    <>
      {syncStatus === "failed" && (
        <button
          onClick={() => {
            processHistory.mutate(undefined, {
              onSuccess: () => { toast.success("Sync restarted"); void refetchSync() },
              onError: () => toast.error("Failed to restart sync"),
            })
          }}
          disabled={processHistory.isPending}
          className="px-3 py-1.5 btn-primary rounded-lg text-xs font-medium disabled:opacity-50"
        >
          {processHistory.isPending ? "Restarting..." : "Restart Sync"}
        </button>
      )}
      {(syncStatus === "running" || isActivelyThrottled) && (
        <button
          onClick={() => {
            resetSync.mutate(undefined, {
              onSuccess: (data) => {
                toast.success(`Reset ${data.syncRowsReset} sync rows and ${data.gatesReset} rate-limit gates`)
                void refetchSync()
              },
              onError: () => toast.error("Failed to reset sync state"),
            })
          }}
          disabled={resetSync.isPending}
          className="px-3 py-1.5 border border-warning/40 text-warning hover:bg-warning/10 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
        >
          {resetSync.isPending ? "Resetting..." : "Reset Throttle"}
        </button>
      )}
      <button
        onClick={() => { toast.info("Refreshing sync status..."); void refetchSync(); void refetchRepairSummary() }}
        disabled={syncFetching || repairSummaryFetching}
        className="px-3 py-1.5 border border-card-border rounded-lg text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-xs font-medium disabled:opacity-50"
      >
        {syncFetching || repairSummaryFetching ? "Refreshing..." : "Refresh Status"}
      </button>
    </>
  )
}
