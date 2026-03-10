"use client"

import { formatCurrency } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface UntrackedCategory {
  category: string
  avgMonthly: number
  suggested: number
}

interface UntrackedTransaction {
  amount: number
}

interface BudgetUntrackedSectionProps {
  untrackedCategories: UntrackedCategory[]
  txByCategory: Record<string, UntrackedTransaction[]>
  onAddBudget: (category: string, limit: number) => void
  onBudgetAll: () => void
}

export function BudgetUntrackedSection({
  untrackedCategories,
  txByCategory,
  onAddBudget,
  onBudgetAll,
}: BudgetUntrackedSectionProps) {
  if (untrackedCategories.length === 0) return null

  return (
    <div className="bg-card border border-dashed border-card-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-card-border/50 bg-foreground/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-rounded text-foreground-muted"
            style={{ fontSize: 16 }}
          >
            visibility_off
          </span>
          <h3 className="text-sm font-bold text-foreground">
            Untracked Spending
          </h3>
          <span className="text-[10px] font-bold text-foreground-muted bg-foreground/[0.06] px-2 py-0.5 rounded-full">
            {untrackedCategories.length} categories
          </span>
        </div>
        <button
          onClick={onBudgetAll}
          className="text-primary text-[11px] font-bold hover:underline transition-colors"
        >
          Budget All
        </button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-card-border/40">
        {untrackedCategories.map((cat) => {
          const meta = getCategoryMeta(cat.category)
          const currentMonthSpent = getCurrentMonthTotal(
            txByCategory[cat.category]
          )

          return (
            <div
              key={cat.category}
              className="flex items-center gap-3 px-5 py-3 hover:bg-foreground/[0.02] transition-colors"
            >
              {/* Dashed left accent */}
              <div
                className="w-1 h-8 rounded-full opacity-40"
                style={{
                  backgroundColor: meta.hex,
                  borderLeft: `2px dashed ${meta.hex}`,
                }}
              />

              {/* Category icon */}
              <div
                className="size-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `color-mix(in srgb, ${meta.hex} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${meta.hex} 20%, transparent)`,
                }}
              >
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: 15, color: meta.hex }}
                >
                  {meta.icon}
                </span>
              </div>

              {/* Name + amounts */}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-foreground-muted">
                  {cat.category}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-foreground-muted">
                  {currentMonthSpent > 0 && (
                    <span className="tabular-nums">
                      {formatCurrency(currentMonthSpent, "USD", 0)} this mo
                    </span>
                  )}
                  {currentMonthSpent > 0 && cat.avgMonthly > 0 && (
                    <span className="text-card-border">·</span>
                  )}
                  {cat.avgMonthly > 0 && (
                    <span className="tabular-nums">
                      avg {formatCurrency(cat.avgMonthly, "USD", 0)}
                    </span>
                  )}
                </div>
              </div>

              {/* Add button */}
              <button
                onClick={() => onAddBudget(cat.category, cat.suggested)}
                className="text-primary text-[11px] font-bold px-3 py-1.5 rounded-md border border-primary/20 hover:bg-primary hover:text-white transition-all flex items-center gap-1 flex-shrink-0"
              >
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: 12 }}
                >
                  add
                </span>
                Add
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Sum absolute amounts for current month transactions in a category */
function getCurrentMonthTotal(
  txs: UntrackedTransaction[] | undefined
): number {
  if (!txs?.length) return 0
  return txs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
}
