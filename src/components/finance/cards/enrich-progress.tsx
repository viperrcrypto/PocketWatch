import { cn } from "@/lib/utils"
import type { EnrichProgress } from "@/hooks/use-finance"

export function EnrichProgressBar({ progress }: { progress: EnrichProgress }) {
  const isDone = progress.current === progress.total
  const successCount = progress.results.filter((r) => r.status !== "failed").length
  const hasFailed = progress.results.some((r) => r.status === "failed")
  const failedResults = progress.results.filter((r) => r.status === "failed")

  return (
    <div className="bg-card border border-card-border/50 rounded-lg px-4 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-foreground-muted font-medium">
          {isDone
            ? `Done — ${successCount} of ${progress.total} updated`
            : `Enriching ${progress.current + 1} of ${progress.total}...`}
        </span>
        {progress.currentCardName && !isDone && (
          <span className="text-foreground-muted/60 truncate ml-2 max-w-[200px]">
            {progress.currentCardName}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-card-elevated rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            isDone ? (hasFailed ? "bg-warning" : "bg-success") : "bg-primary",
          )}
          style={{ width: `${(progress.current / progress.total) * 100}%` }}
        />
      </div>

      {/* Per-card status chips when done */}
      {isDone && (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex flex-wrap gap-1.5">
            {progress.results.map((r) => (
              <span
                key={r.cardId}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
                  r.status === "failed" ? "bg-error/10 text-error" : "bg-success/10 text-success",
                )}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 10 }}>
                  {r.status === "failed" ? "error" : "check_circle"}
                </span>
                {r.cardName ?? r.cardId.slice(0, 8)}
              </span>
            ))}
          </div>
          {/* Show error details for failed cards */}
          {failedResults.length > 0 && (
            <div className="text-[10px] text-error/70 space-y-0.5">
              {failedResults.map((r) => (
                <p key={r.cardId} className="truncate">
                  {r.cardName ?? r.cardId.slice(0, 8)}: {r.error ?? "Unknown error"}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
