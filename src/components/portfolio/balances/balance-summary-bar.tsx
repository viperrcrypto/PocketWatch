import { formatFiatValue } from "@/lib/portfolio/utils"

export function BalanceSummaryBar({
  hasActiveFilters,
  filteredTotal,
  totalValue,
  displayCount,
  totalCount,
}: {
  hasActiveFilters: boolean
  filteredTotal: number
  totalValue: number
  displayCount: number
  totalCount: number
}) {
  return (
    <div className="mb-4 bg-card border border-card-border p-4 flex items-center justify-between rounded-xl">
      <div>
        <span className="text-foreground-muted block text-[10px] font-semibold tracking-widest">
          {hasActiveFilters ? "Filtered Value" : "Total Blockchain Value"}
        </span>
        <span className="text-foreground font-data" style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {formatFiatValue(hasActiveFilters ? filteredTotal : totalValue)}
        </span>
      </div>
      <div className="flex items-center gap-4 text-foreground-muted">
        {hasActiveFilters && (
          <span className="text-xs">
            {displayCount} of {totalCount} assets
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-sm">token</span>
          <span className="text-sm">
            {displayCount} asset{displayCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  )
}
