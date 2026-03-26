"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { BudgetProgressRing } from "@/components/finance/budget-progress-ring"

interface BudgetEntry {
  id: string
  category: string
  monthlyLimit: number
  spent: number
  percentUsed: number
}

interface BudgetUserCardProps {
  budgetState: "zero" | "partial" | "full"
  budgets: BudgetEntry[]
  totalSpent: number
  totalBudgeted: number
  untrackedCount: number
  onOpenWorkshop: () => void
  onAddSingle: () => void
}

const MAX_VISIBLE = 6

export function BudgetUserCard({
  budgetState,
  budgets,
  totalSpent,
  totalBudgeted,
  untrackedCount,
  onOpenWorkshop,
  onAddSingle,
}: BudgetUserCardProps) {
  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-card-border/50 bg-foreground/[0.02]">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>
            savings
          </span>
          Your Budget
        </h3>
      </div>

      {/* Body */}
      {budgetState === "zero" ? (
        <ZeroState onOpenWorkshop={onOpenWorkshop} onAddSingle={onAddSingle} />
      ) : (
        <PopulatedState
          budgets={budgets}
          totalSpent={totalSpent}
          totalBudgeted={totalBudgeted}
          untrackedCount={untrackedCount}
          budgetState={budgetState}
        />
      )}
    </div>
  )
}

function ZeroState({
  onOpenWorkshop,
  onAddSingle,
}: {
  onOpenWorkshop: () => void
  onAddSingle: () => void
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
      <div className="size-14 rounded-2xl bg-primary-muted flex items-center justify-center">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 28 }}>
          savings
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-bold text-foreground">No budgets set yet</h3>
        <p className="text-xs text-foreground-muted leading-relaxed max-w-[260px]">
          Your budget will appear here. Set spending limits based on your actual patterns.
        </p>
      </div>

      <button
        onClick={onOpenWorkshop}
        className="bg-primary text-white text-sm font-bold px-6 py-2.5 rounded-lg flex items-center gap-2 hover:bg-primary-hover transition-colors shadow-sm"
      >
        Set Up Budgets
        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_forward</span>
      </button>

      <button
        onClick={onAddSingle}
        className="text-xs text-primary font-semibold hover:underline transition-colors"
      >
        or add a single category
      </button>
    </div>
  )
}

function PopulatedState({
  budgets,
  totalSpent,
  totalBudgeted,
  untrackedCount,
  budgetState,
}: {
  budgets: BudgetEntry[]
  totalSpent: number
  totalBudgeted: number
  untrackedCount: number
  budgetState: "partial" | "full"
}) {
  const sorted = [...budgets].sort((a, b) => b.percentUsed - a.percentUsed)
  const visible = sorted.slice(0, MAX_VISIBLE)
  const remaining = sorted.length - visible.length

  return (
    <div className="flex-1 flex flex-col">
      {/* Progress ring */}
      <div className="flex justify-center py-2 sm:py-4">
        <BudgetProgressRing
          spent={totalSpent}
          budget={totalBudgeted}
          size={120}
          segments={budgets.map((b) => ({ category: b.category, spent: b.spent, monthlyLimit: b.monthlyLimit }))}
        />
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto max-h-[300px] sm:max-h-[420px] px-3 sm:px-4 pb-2 space-y-1">
        {visible.map((b) => {
          const meta = getCategoryMeta(b.category)
          const barPercent = Math.min(b.percentUsed, 100)
          const isOver = b.percentUsed >= 100
          const isWarn = b.percentUsed >= 80 && !isOver
          const barColor = isOver ? "var(--error)" : isWarn ? "var(--warning)" : meta.hex

          return (
            <div
              key={b.id}
              className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-foreground/[0.025] transition-colors"
            >
              {/* Category icon */}
              <div
                className="size-7 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${meta.hex}, color-mix(in srgb, ${meta.hex} 80%, #000))`,
                }}
              >
                <span
                  className="material-symbols-rounded text-white drop-shadow-sm"
                  style={{ fontSize: 13 }}
                  aria-hidden="true"
                >
                  {meta.icon}
                </span>
              </div>

              {/* Bar + label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-foreground truncate">
                    {b.category}
                  </span>
                  <span className="text-[10px] font-data tabular-nums text-foreground-muted ml-2 flex-shrink-0">
                    {formatCurrency(b.spent, "USD", 0)}<span className="opacity-50">/{formatCurrency(b.monthlyLimit, "USD", 0)}</span>
                  </span>
                </div>
                {/* Premium progress bar — rounded track, gradient fill */}
                <div className="h-[5px] rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--foreground) 12%, var(--background-secondary))" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.max(barPercent, 1.5)}%`,
                      background: isOver
                        ? `linear-gradient(90deg, color-mix(in srgb, var(--error) 80%, transparent), var(--error))`
                        : isWarn
                        ? `linear-gradient(90deg, color-mix(in srgb, var(--warning) 80%, transparent), var(--warning))`
                        : `linear-gradient(90deg, color-mix(in srgb, ${barColor} 70%, transparent), ${barColor})`,
                    }}
                  />
                </div>
              </div>

              {/* Percent badge */}
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums flex-shrink-0 w-8 text-right",
                  isOver ? "text-error" : isWarn ? "text-warning" : "text-foreground-muted",
                )}
              >
                {Math.round(b.percentUsed)}%
              </span>
            </div>
          )
        })}

        {remaining > 0 && (
          <a
            href="#category-breakdown"
            className="block text-[11px] text-primary font-bold px-3 py-1.5 hover:underline"
          >
            +{remaining} more
          </a>
        )}
      </div>

      {/* Untracked banner */}
      {budgetState === "partial" && untrackedCount > 0 && (
        <div className="px-5 py-2.5 border-t border-card-border/50 bg-foreground/[0.02]">
          <p className="text-[11px] text-foreground-muted font-medium text-center">
            {untrackedCount} {untrackedCount === 1 ? "category" : "categories"} unbudgeted
          </p>
        </div>
      )}
    </div>
  )
}
