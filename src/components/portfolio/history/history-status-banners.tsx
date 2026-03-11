"use client"

import type { AppliedFilters } from "./history-constants"

// ─── Sync Status Banner ───

export function SyncStatusBanner({
  syncData,
  syncIsRunning,
  syncProcessed,
  syncTotal,
  syncFailed,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  syncData: any
  syncIsRunning: boolean
  syncProcessed: number
  syncTotal: number
  syncFailed: number
}) {
  if (!syncData?.progress || syncData.progress.length === 0) return null

  return (
    <div className={`bg-card border px-4 py-2 mb-4 flex items-center gap-3 rounded-xl ${
      syncIsRunning ? "border-info/30" : "border-card-border"
    }`}>
      <span className={`material-symbols-rounded text-sm ${
        syncIsRunning ? "text-info animate-spin" : "text-foreground-muted"
      }`}>
        {syncIsRunning ? "progress_activity" : "cloud_done"}
      </span>
      <p className="text-xs text-foreground-muted flex-1">
        {syncIsRunning
          ? `Sync in progress: ${syncProcessed}/${syncTotal} wallet-chain syncs processed`
          : `Last synced: ${(() => {
              const latest = syncData.progress.reduce(
                (max: Date, p: { updatedAt: string }) => {
                  const d = new Date(p.updatedAt)
                  return d > max ? d : max
                },
                new Date(0)
              )
              if (latest.getTime() === 0) return "never"
              const ago = Date.now() - latest.getTime()
              if (ago < 60_000) return "just now"
              if (ago < 3600_000) return `${Math.floor(ago / 60_000)}m ago`
              if (ago < 86400_000) return `${Math.floor(ago / 3600_000)}h ago`
              return `${Math.floor(ago / 86400_000)}d ago`
            })()}`}
        <span className="ml-2 text-foreground-muted/60">
          {syncData.progress.reduce((sum: number, p: { transactionCount: number }) => sum + p.transactionCount, 0).toLocaleString()} txns cached
        </span>
        {syncFailed > 0 && (
          <span className="ml-2 text-warning">
            {syncFailed} failed
          </span>
        )}
      </p>
    </div>
  )
}

// ─── Soft Error Banner ───

export function SoftErrorBanner({
  data,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}) {
  if (!data?.error) return null

  return (
    <div className="bg-card border border-warning/30 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl">
      <span className="material-symbols-rounded text-warning text-lg">info</span>
      <p className="text-sm text-warning">
        {data.message ?? (data.error === "no_data"
          ? "No cached transactions found. Click \"Process Events\" to sync your history."
          : "An issue occurred loading events.")}
      </p>
    </div>
  )
}

// ─── Hard Error Banner ───

export function HardErrorBanner({ error }: { error: Error }) {
  const msg = error?.message?.toLowerCase() ?? ""
  const isAuthError = msg.includes("authentication") || msg.includes("unauthorized") || msg.includes("401")

  if (isAuthError) {
    return (
      <div className="bg-card border border-warning/25 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl" style={{ borderLeft: "2px solid var(--warning)" }}>
        <span className="material-symbols-rounded text-warning text-lg">key</span>
        <p className="text-sm text-foreground-muted">
          Add your <strong className="text-foreground">Zerion API key</strong> in{" "}
          <a href="/portfolio/settings" className="text-primary hover:underline">Settings</a> to view transaction history.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-error/30 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl">
      <span className="material-symbols-rounded text-error text-lg">error</span>
      <p className="text-sm text-error">
        {error?.message ?? "Failed to load events"}
      </p>
    </div>
  )
}

// ─── Process Result Banners ───

export function ProcessResultBanner({
  processStatus,
  processFailedSyncs,
  processTotalSyncs,
  processNewTransactions,
}: {
  processStatus: string | undefined
  processFailedSyncs: number
  processTotalSyncs: number
  processNewTransactions: number
}) {
  if (processStatus === "queued" || processStatus === "running") {
    return (
      <div className="bg-card border border-info/30 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl">
        <span className="material-symbols-rounded text-info text-lg">hourglass_top</span>
        <p className="text-sm text-info">
          History sync started. Recent transactions will appear first while full backfill continues in the background.
        </p>
      </div>
    )
  }

  if (processFailedSyncs > 0) {
    return (
      <div className="bg-card border border-warning/30 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl">
        <span className="material-symbols-rounded text-warning text-lg">warning</span>
        <p className="text-sm text-warning">
          History sync completed with warnings: {processFailedSyncs}/{processTotalSyncs || processFailedSyncs} wallet-chain syncs failed.
          Successful chains were still processed.
        </p>
      </div>
    )
  }

  if (processNewTransactions > 0) {
    return (
      <div className="bg-card border border-success/30 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl">
        <span className="material-symbols-rounded text-success text-lg">check_circle</span>
        <p className="text-sm text-success">
          History sync completed: {processNewTransactions.toLocaleString()} new transaction{processNewTransactions === 1 ? "" : "s"} cached.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-info/30 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl">
      <span className="material-symbols-rounded text-info text-lg">info</span>
      <p className="text-sm text-info">
        History sync completed, but no new transactions were found.
      </p>
    </div>
  )
}

// ─── Process Error Banner ───

export function ProcessErrorBanner({ error }: { error: Error }) {
  const msg = error?.message ?? ""
  let displayMsg: string
  if (msg.includes("sync_failed")) {
    displayMsg = "Transaction sync failed for all chains. Check your Alchemy key in Settings and try again."
  } else if (msg.includes("Alchemy") || msg.includes("API key") || msg.includes("E9093")) {
    displayMsg = "Alchemy API key is required to sync transactions. Add one in Settings → External Services, then try again."
  } else {
    displayMsg = msg || "Failed to process events. Please try again."
  }

  return (
    <div className="bg-card border border-error/30 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl">
      <span className="material-symbols-rounded text-error text-lg">error</span>
      <p className="text-sm text-error">{displayMsg}</p>
    </div>
  )
}

// ─── Active Filters Indicator ───

export function ActiveFiltersIndicator({
  appliedFilters,
}: {
  appliedFilters: AppliedFilters
}) {
  return (
    <div className="bg-card border border-card-border px-4 py-2 mb-4 flex items-center gap-3 rounded-xl">
      <span className="material-symbols-rounded text-foreground-muted text-sm">filter_list</span>
      <p className="text-xs text-foreground-muted">
        Filters active
        {appliedFilters.event_type && <span className="text-foreground ml-2">type: {appliedFilters.event_type}</span>}
        {appliedFilters.source && appliedFilters.source !== "all" && (
          <span className="text-foreground ml-2">source: {appliedFilters.source}</span>
        )}
        {appliedFilters.exchangeId && <span className="text-foreground ml-2">exchange: {appliedFilters.exchangeId}</span>}
        {appliedFilters.asset && <span className="text-foreground ml-2">asset: {appliedFilters.asset}</span>}
        {appliedFilters.search && <span className="text-foreground ml-2">search: &ldquo;{appliedFilters.search}&rdquo;</span>}
        {appliedFilters.from_timestamp && <span className="text-foreground ml-2">from: {new Date(appliedFilters.from_timestamp * 1000).toLocaleDateString()}</span>}
        {appliedFilters.to_timestamp && <span className="text-foreground ml-2">to: {new Date(appliedFilters.to_timestamp * 1000).toLocaleDateString()}</span>}
      </p>
    </div>
  )
}
