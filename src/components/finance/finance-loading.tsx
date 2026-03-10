"use client"

function getSkeletonCellWidth(row: number, col: number) {
  return 60 + ((row * 19 + col * 13) % 41)
}

export function FinanceCardSkeleton() {
  return (
    <div className="bg-card rounded-xl p-5 min-h-[126px] border border-transparent" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="h-3 w-20 animate-shimmer rounded mb-3" />
      <div className="h-7 w-32 animate-shimmer rounded mb-2" />
      <div className="h-3 w-16 animate-shimmer rounded" />
    </div>
  )
}

export function FinanceTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-transparent" style={{ boxShadow: "var(--shadow-sm)" }}>
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3 border-b border-card-border/30 bg-card-elevated">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3 animate-shimmer rounded" style={{ width: `${80 + i * 10}px` }} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 px-4 py-3 border-b border-card-border/20 last:border-b-0"
        >
          {Array.from({ length: 5 }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="h-4 animate-shimmer rounded"
              style={{ width: `${getSkeletonCellWidth(rowIdx, colIdx)}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function FinanceChartSkeleton() {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-transparent" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between p-4 border-b border-card-border/30">
        <div className="h-4 w-32 animate-shimmer rounded" />
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-8 animate-shimmer rounded" />
          ))}
        </div>
      </div>
      <div className="p-4">
        <div className="h-64 animate-shimmer rounded opacity-30" />
      </div>
    </div>
  )
}

export function FinancePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div>
        <div className="h-8 w-48 animate-shimmer rounded mb-2" />
        <div className="h-4 w-72 animate-shimmer rounded" />
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FinanceCardSkeleton />
        <FinanceCardSkeleton />
        <FinanceCardSkeleton />
        <FinanceCardSkeleton />
      </div>

      {/* Chart skeleton */}
      <FinanceChartSkeleton />

      {/* Table skeleton */}
      <FinanceTableSkeleton />
    </div>
  )
}
