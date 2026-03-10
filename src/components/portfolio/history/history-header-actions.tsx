"use client"

export function HistoryHeaderActions({
  showFlaggedOnly,
  setShowFlaggedOnly,
  flaggedCount,
  hideSpam,
  setHideSpam,
  spamCount,
  isProcessPending,
  onProcess,
  setOffset,
}: {
  showFlaggedOnly: boolean
  setShowFlaggedOnly: (fn: (v: boolean) => boolean) => void
  flaggedCount: number
  hideSpam: boolean
  setHideSpam: (fn: (v: boolean) => boolean) => void
  spamCount: number
  isProcessPending: boolean
  onProcess: () => void
  setOffset: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowFlaggedOnly((v) => !v)}
        title={showFlaggedOnly ? "Showing flagged only — click to show all" : "Filter: show only flagged transactions"}
        className={`flex items-center justify-center gap-1.5 min-w-[52px] px-3 py-2 border transition-colors rounded-xl text-xs font-medium tracking-wide ${
          showFlaggedOnly
            ? "border-error/40 text-error hover:border-error/60"
            : "border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover"
        }`}
      >
        <span className="material-symbols-rounded text-sm"
          style={{ fontVariationSettings: showFlaggedOnly ? "'FILL' 1" : "'FILL' 0" }}>
          flag
        </span>
        {flaggedCount > 0 && <span className="font-data">{flaggedCount}</span>}
      </button>
      <button
        onClick={() => { setHideSpam((v) => !v); setOffset(0) }}
        title={hideSpam ? `Spam filter ON — ${spamCount} hidden` : "Spam filter OFF — showing all"}
        className={`flex items-center justify-center gap-1.5 min-w-[52px] px-3 py-2 border transition-colors rounded-xl text-xs font-medium tracking-wide ${
          hideSpam
            ? "border-success/40 text-success hover:border-success/60"
            : "border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover"
        }`}
      >
        <span className="material-symbols-rounded text-sm">
          {hideSpam ? "shield" : "remove_moderator"}
        </span>
        {hideSpam && spamCount > 0 && <span className="font-data">{spamCount}</span>}
      </button>
      <button
        onClick={onProcess}
        disabled={isProcessPending}
        className="flex items-center gap-2 px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors disabled:opacity-50 rounded-xl text-xs font-medium tracking-wide"
      >
        <span className={`material-symbols-rounded text-sm ${isProcessPending ? "animate-spin" : ""}`}>
          {isProcessPending ? "progress_activity" : "sync"}
        </span>
        {isProcessPending ? "Processing..." : "Process Events"}
      </button>
    </div>
  )
}
