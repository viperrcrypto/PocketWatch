import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { VERDICT_STYLES } from "./insights-constants"
import type { ComparisonItem } from "./insights-types"

export function InsightsCategoryComparison({
  comparison,
  hasBudgets,
  maxValue,
}: {
  comparison: ComparisonItem[]
  hasBudgets: boolean
  maxValue: number
}) {
  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-card-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-background-secondary flex items-center justify-center text-foreground-muted">
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>compare_arrows</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Category Comparison</h3>
            <p className="text-xs text-foreground-muted">Data-driven suggestions vs your budget limits</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-primary/60" />
            Data-Driven
          </div>
          {hasBudgets && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-success/60" />
              Your Budget
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-foreground-muted/30" />
            Current Spend
          </div>
        </div>
      </div>

      <div className="divide-y divide-card-border/30">
        {comparison.map((item) => {
          const meta = getCategoryMeta(item.category)
          const style = VERDICT_STYLES[item.verdict]
          const dataDrivenWidth = maxValue > 0 ? (item.dataDriven / maxValue) * 100 : 0
          const budgetWidth = item.yourBudget != null && maxValue > 0 ? (item.yourBudget / maxValue) * 100 : 0
          const spentWidth = maxValue > 0 ? (item.currentSpent / maxValue) * 100 : 0

          return (
            <div key={item.category} className="p-5 hover:bg-background-secondary/30 transition-colors">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${meta.hex} 12%, var(--background-secondary))` }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: meta.hex }}>{meta.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.category}</p>
                    <p className="text-[10px] text-foreground-muted">
                      avg {formatCurrency(item.avgMonthly)}/mo
                      <span className="mx-1 opacity-30">|</span>
                      {item.monthsOfData}mo data
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {item.yourBudget != null && item.gap !== 0 && (
                    <span className={cn("text-xs font-bold font-data tabular-nums", item.gap > 0 ? "text-warning" : "text-error")}>
                      {item.gap > 0 ? "+" : ""}{formatCurrency(item.gap)}
                    </span>
                  )}
                  <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1", style.bg, style.text)}>
                    <span className="material-symbols-rounded" style={{ fontSize: 12 }}>{style.icon}</span>
                    {style.label}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-medium text-foreground-muted w-16 text-right uppercase tracking-wider">Suggested</span>
                  <div className="flex-1 h-2 bg-background-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60 transition-all duration-700" style={{ width: `${dataDrivenWidth}%` }} />
                  </div>
                  <span className="text-xs font-semibold font-data tabular-nums text-foreground w-16 text-right">{formatCurrency(item.dataDriven, "USD", 0)}</span>
                </div>
                {item.yourBudget != null && (
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-medium text-foreground-muted w-16 text-right uppercase tracking-wider">Budget</span>
                    <div className="flex-1 h-2 bg-background-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-success/60 transition-all duration-700" style={{ width: `${budgetWidth}%` }} />
                    </div>
                    <span className="text-xs font-semibold font-data tabular-nums text-foreground w-16 text-right">{formatCurrency(item.yourBudget, "USD", 0)}</span>
                  </div>
                )}
                {item.currentSpent > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-medium text-foreground-muted w-16 text-right uppercase tracking-wider">Spent</span>
                    <div className="flex-1 h-2 bg-background-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-foreground-muted/30 transition-all duration-700" style={{ width: `${spentWidth}%` }} />
                    </div>
                    <span className="text-xs font-semibold font-data tabular-nums text-foreground-muted w-16 text-right">{formatCurrency(item.currentSpent, "USD", 0)}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {comparison.length === 0 && (
        <div className="p-12 text-center">
          <span className="material-symbols-rounded text-foreground-muted block mb-2" style={{ fontSize: 36 }}>query_stats</span>
          <p className="text-sm text-foreground-muted">No spending data available yet. Start tracking transactions to see insights.</p>
        </div>
      )}
    </div>
  )
}
