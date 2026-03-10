"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface SuggestionEntry {
  category: string
  avgMonthly: number
  suggested: number
  monthsOfData: number
}

interface BudgetSuggestionsCardProps {
  suggestions: SuggestionEntry[]
  totalAvgSpending: number
  monthsAnalyzed: number
  availableMonths: string[]
  selectedMonth: string | null
  onMonthChange: (month: string | null) => void
}

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export function BudgetSuggestionsCard({
  suggestions,
  totalAvgSpending,
  monthsAnalyzed,
  availableMonths,
  selectedMonth,
  onMonthChange,
}: BudgetSuggestionsCardProps) {
  const sorted = [...suggestions]
    .filter((s) => s.avgMonthly > 0)
    .sort((a, b) => b.avgMonthly - a.avgMonthly)

  const maxAmount = sorted[0]?.avgMonthly ?? 1

  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-card-border/50 bg-foreground/[0.02] flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>
            insights
          </span>
          Data-Driven Budget
        </h3>
        {availableMonths.length > 0 && (
          <div className="relative inline-flex items-center flex-shrink-0">
            <select
              value={selectedMonth ?? ""}
              onChange={(e) => onMonthChange(e.target.value || null)}
              className="text-[9px] font-bold uppercase tracking-widest bg-foreground/[0.06] text-foreground-muted pl-2 pr-5 py-0.5 rounded-full border-none outline-none cursor-pointer hover:bg-foreground/[0.1] transition-colors appearance-none"
            >
              <option value="">{monthsAnalyzed}-Mo Average</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
            <span
              className="material-symbols-rounded absolute right-1 pointer-events-none text-foreground-muted"
              style={{ fontSize: 12 }}
            >
              expand_more
            </span>
          </div>
        )}
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto max-h-[420px] p-4 space-y-1">
        {sorted.length === 0 ? (
          <div className="text-center py-8">
            <span
              className="material-symbols-rounded text-foreground-muted block mb-2"
              style={{ fontSize: 32 }}
            >
              bar_chart
            </span>
            <p className="text-xs text-foreground-muted">
              No spending data yet. Connect accounts to see suggestions.
            </p>
          </div>
        ) : (
          sorted.map((item) => {
            const meta = getCategoryMeta(item.category)
            const barPercent = (item.avgMonthly / maxAmount) * 100

            return (
              <div
                key={item.category}
                className="relative flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/[0.02] transition-colors"
              >
                {/* Percentage bar background */}
                <div
                  className="absolute inset-y-0 left-0 rounded-lg opacity-[0.04]"
                  style={{
                    width: `${Math.max(barPercent, 2)}%`,
                    backgroundColor: meta.hex,
                  }}
                />

                {/* Icon */}
                <div
                  className="size-8 rounded-lg flex items-center justify-center flex-shrink-0 relative z-[1]"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${meta.hex} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${meta.hex} 25%, transparent)`,
                  }}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: 16, color: meta.hex }}
                  >
                    {meta.icon}
                  </span>
                </div>

                {/* Name + amount */}
                <div className="flex-1 min-w-0 relative z-[1]">
                  <span className="text-xs font-semibold text-foreground truncate block">
                    {item.category}
                  </span>
                </div>
                <span className="text-xs font-black font-data tabular-nums text-foreground flex-shrink-0 relative z-[1]">
                  {formatCurrency(item.avgMonthly, "USD", 0)}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      {sorted.length > 0 && (
        <div className="px-5 py-3 border-t border-card-border/50 flex items-center justify-between">
          <span className="text-xs font-black text-foreground tabular-nums font-data">
            Total: {formatCurrency(totalAvgSpending, "USD", 0)}/mo
          </span>
          <span className="text-[10px] text-foreground-muted font-medium">
            Based on {monthsAnalyzed}-mo spending
          </span>
        </div>
      )}
    </div>
  )
}
