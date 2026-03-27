"use client"

import { BudgetProgressRing } from "@/components/finance/budget-progress-ring"
import { formatCurrency, cn } from "@/lib/utils"
import type { BudgetSegment } from "./budget-types"

interface BudgetHeroSummaryProps {
  totalBudgeted: number
  totalSpent: number
  remaining: number
  percentUsed: number
  daysRemaining: number
  safeDailySpend: number
  isOnTrack: boolean
  budgetCount: number
  overBudgetCount: number
  segments: BudgetSegment[]
}

export function BudgetHeroSummary({
  totalBudgeted,
  totalSpent,
  remaining,
  percentUsed,
  daysRemaining,
  safeDailySpend,
  isOnTrack,
  budgetCount,
  overBudgetCount,
  segments,
}: BudgetHeroSummaryProps) {
  const isOver = remaining < 0
  const underBudgetCount = budgetCount - overBudgetCount

  return (
    <div className="bg-card rounded-2xl p-6 flex flex-col items-center gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
      <BudgetProgressRing spent={totalSpent} budget={totalBudgeted} size={192} segments={segments} />

      <div className="text-center space-y-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Left to Spend</p>
        <p
          className={cn("text-3xl font-data font-black tabular-nums leading-none", isOver ? "text-error" : "text-foreground")}
          style={{ letterSpacing: "-0.03em" }}
        >
          {isOver ? "-" : ""}{formatCurrency(Math.abs(remaining), "USD", 0)}
        </p>

        <div className="flex justify-center">
          <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold", isOver ? "bg-error/15 text-error" : "bg-success/15 text-success")}>
            <span className="material-symbols-rounded" style={{ fontSize: 12 }}>{isOver ? "error" : "check_circle"}</span>
            {isOver ? "Over Budget" : "On Track"}
          </span>
        </div>

        <p className="text-[10px] text-foreground-muted tabular-nums">
          {formatCurrency(safeDailySpend, "USD", 0)}/day safe to spend
          <span className="mx-1">&middot;</span>
          {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
        </p>

        <p className="text-[10px] text-foreground-muted">
          {isOver ? (
            <>
              <span className="text-error font-semibold">{overBudgetCount}</span> over
              <span className="mx-1">&middot;</span>
              <span className="text-success font-semibold">{underBudgetCount}</span> on track
            </>
          ) : (
            <><span className="text-success font-semibold">{underBudgetCount}</span> of {budgetCount} on track</>
          )}
        </p>
      </div>
    </div>
  )
}
