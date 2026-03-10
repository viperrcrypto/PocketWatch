"use client"

export function HistoryEmptyState({
  showFlaggedOnly,
  hasActiveFilters,
  isProcessPending,
  onShowAll,
  onClearFilters,
  onProcessEvents,
}: {
  showFlaggedOnly: boolean
  hasActiveFilters: boolean
  isProcessPending: boolean
  onShowAll: () => void
  onClearFilters: () => void
  onProcessEvents: () => void
}) {
  return (
    <div className="bg-card border border-card-border flex flex-col items-center justify-center py-16 gap-4 rounded-xl">
      <span className="material-symbols-rounded text-4xl text-foreground-muted">
        {showFlaggedOnly ? "flag" : "history"}
      </span>
      <p className="text-foreground text-base font-semibold">
        {showFlaggedOnly
          ? "No Flagged Transactions"
          : hasActiveFilters ? "No Matching Events" : "No Events Found"}
      </p>
      <p className="text-foreground-muted text-center max-w-md text-sm">
        {showFlaggedOnly
          ? "You haven't flagged any transactions yet. Click the flag icon on a received transaction to mark it as suspicious."
          : hasActiveFilters
          ? "No events match the current filters. Try adjusting the date range or clearing filters."
          : "Click \"Process Events\" to sync your transaction history from the blockchain. This may take a minute for the first run."}
      </p>
      {showFlaggedOnly ? (
        <button
          onClick={onShowAll}
          className="flex items-center gap-2 px-5 py-2.5 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors rounded-xl text-xs font-semibold tracking-wide"
        >
          <span className="material-symbols-rounded text-sm">arrow_back</span>
          Show All Transactions
        </button>
      ) : hasActiveFilters ? (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-2 px-5 py-2.5 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors rounded-xl text-xs font-semibold tracking-wide"
        >
          <span className="material-symbols-rounded text-sm">filter_list_off</span>
          Clear Filters
        </button>
      ) : (
        <button
          onClick={onProcessEvents}
          disabled={isProcessPending}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl disabled:opacity-50 text-xs font-semibold tracking-wide"
        >
          <span className={`material-symbols-rounded text-sm ${isProcessPending ? "animate-spin" : ""}`}>
            {isProcessPending ? "progress_activity" : "sync"}
          </span>
          {isProcessPending ? "Processing..." : "Process Events"}
        </button>
      )}
    </div>
  )
}
