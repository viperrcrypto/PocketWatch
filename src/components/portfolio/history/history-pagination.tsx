"use client"

export function HistoryPagination({
  currentPage,
  totalPages,
  totalFound,
  offset,
  isPlaceholderData,
  dataSource,
  onPrev,
  onNext,
}: {
  currentPage: number
  totalPages: number
  totalFound: number
  offset: number
  isPlaceholderData: boolean
  dataSource?: string
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-foreground-muted text-sm">
        Page {currentPage} of {totalPages}
        {totalFound > 0 && (
          <span className="ml-2 text-foreground-muted">
            ({totalFound.toLocaleString()} event{totalFound !== 1 ? "s" : ""})
          </span>
        )}
        {dataSource && (
          <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide uppercase ${
            dataSource === "onchain"
              ? "bg-info/10 text-info"
              : dataSource === "exchange"
                ? "bg-primary/10 text-primary"
                : "bg-success/10 text-success"
          }`}>
            {dataSource === "all" ? "all sources" : dataSource}
          </span>
        )}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={offset === 0}
          className="flex items-center gap-1 px-3 py-1.5 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs tracking-wide"
        >
          <span className="material-symbols-rounded text-sm">chevron_left</span>
          Prev
        </button>
        <button
          onClick={onNext}
          disabled={isPlaceholderData || currentPage >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs tracking-wide"
        >
          Next
          <span className="material-symbols-rounded text-sm">chevron_right</span>
        </button>
      </div>
    </div>
  )
}
