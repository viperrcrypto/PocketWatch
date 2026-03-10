export function ClassifyPagination({
  page,
  totalPages,
  totalCount,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalCount: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-foreground-muted text-sm">
        Page {page} of {totalPages}
        {totalCount > 0 && (
          <span className="ml-2 text-foreground-muted">
            ({totalCount.toLocaleString()} transaction{totalCount !== 1 ? "s" : ""})
          </span>
        )}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs tracking-wide"
        >
          <span className="material-symbols-rounded text-sm">chevron_left</span>
          Prev
        </button>
        <button
          onClick={() => { if (page < totalPages) onPageChange(page + 1) }}
          disabled={page >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs tracking-wide"
        >
          Next
          <span className="material-symbols-rounded text-sm">chevron_right</span>
        </button>
      </div>
    </div>
  )
}
