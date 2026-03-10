"use client"

function getSkeletonCellWidth(row: number, col: number) {
  return 60 + ((row * 19 + col * 13) % 41)
}

export function PortfolioCardSkeleton() {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="h-3 w-20 bg-card-elevated rounded animate-pulse mb-3" />
      <div className="h-7 w-32 bg-card-elevated rounded animate-pulse mb-2" />
      <div className="h-3 w-16 bg-card-elevated rounded animate-pulse" />
    </div>
  )
}

export function PortfolioTableSkeleton() {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3 border-b border-card-border bg-card-elevated">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3 bg-card-border rounded animate-pulse" style={{ width: `${80 + i * 10}px` }} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 px-4 py-3 border-b border-card-border last:border-b-0"
        >
          {Array.from({ length: 5 }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="h-4 bg-card-elevated rounded animate-pulse"
              style={{ width: `${getSkeletonCellWidth(rowIdx, colIdx)}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PortfolioPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div>
        <div className="h-8 w-48 bg-card-elevated rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-card-elevated rounded animate-pulse" />
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PortfolioCardSkeleton />
        <PortfolioCardSkeleton />
        <PortfolioCardSkeleton />
        <PortfolioCardSkeleton />
      </div>

      {/* Chart skeleton */}
      <div className="bg-card border border-card-border rounded-xl">
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <div className="h-4 w-32 bg-card-elevated rounded animate-pulse" />
          <div className="flex gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-6 w-8 bg-card-elevated rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="p-4">
          <div className="h-64 bg-card-elevated rounded animate-pulse opacity-30" />
        </div>
      </div>

      {/* Table skeleton */}
      <PortfolioTableSkeleton />
    </div>
  )
}
