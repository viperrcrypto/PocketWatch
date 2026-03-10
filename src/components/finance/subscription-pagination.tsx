"use client"

interface SubscriptionPaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function SubscriptionPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: SubscriptionPaginationProps) {
  if (total === 0 || totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-foreground-muted tabular-nums">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="px-2 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30"
          title="First page"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>first_page</span>
        </button>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-xs font-data tabular-nums text-foreground-muted">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30"
        >
          Next
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="px-2 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30"
          title="Last page"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>last_page</span>
        </button>
      </div>
    </div>
  )
}
