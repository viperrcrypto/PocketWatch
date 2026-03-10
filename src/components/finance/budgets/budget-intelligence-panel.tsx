"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  useFinanceBudgets, useBudgetSuggestions, useBudgetAI,
  useFinanceDeepInsights, useFinanceIncome,
} from "@/hooks/use-finance"
import { buildBudgetComparison } from "@/lib/finance/budget-comparison"
import { InsightsIncomeBanner } from "@/components/finance/budget-insights/insights-income-banner"
import { VERDICT_STYLES } from "@/components/finance/budget-insights/insights-constants"
import { getCategoryMeta } from "@/lib/finance/categories"
import { formatCurrency, cn } from "@/lib/utils"

const VERDICT_PRIORITY: Record<string, number> = {
  "under-budgeted": 0,
  "missing": 1,
  "over-budgeted": 2,
  "well-aligned": 3,
}

const MAX_CATEGORIES = 8

export function BudgetIntelligencePanel({ onClose }: { onClose: () => void }) {
  const { data: budgets } = useFinanceBudgets()
  const { data: suggestions } = useBudgetSuggestions()
  const { data: aiData } = useBudgetAI()
  const { data: deep } = useFinanceDeepInsights()
  const { data: incomeData } = useFinanceIncome()

  const comparison = useMemo(
    () => buildBudgetComparison(
      budgets ?? [],
      suggestions?.suggestions ?? [],
      deep?.topCategories ?? [],
    ),
    [budgets, suggestions, deep],
  )

  const hasBudgets = (budgets ?? []).length > 0
  const totalDataDriven = comparison.reduce((s, c) => s + c.dataDriven, 0)
  const totalYourBudget = comparison.reduce((s, c) => s + (c.yourBudget ?? 0), 0)
  const income = incomeData?.effective ?? deep?.totalIncome ?? 0

  const alignedCount = comparison.filter((c) => c.verdict === "well-aligned").length
  const totalWithBudget = comparison.filter((c) => c.yourBudget != null).length
  const optimizationScore = totalWithBudget > 0 ? Math.round((alignedCount / totalWithBudget) * 100) : 0
  const displayScore = aiData?.analysis?.overallScore ?? optimizationScore

  const sortedComparison = useMemo(
    () => [...comparison].sort((a, b) => (VERDICT_PRIORITY[a.verdict] ?? 9) - (VERDICT_PRIORITY[b.verdict] ?? 9)),
    [comparison],
  )

  const visible = sortedComparison.slice(0, MAX_CATEGORIES)
  const remaining = sortedComparison.length - visible.length

  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-card-border/50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 20 }}>insights</span>
          <h3 className="text-sm font-bold text-foreground">Intelligence</h3>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>

      {/* Score Card */}
      <div className="p-4 border-b border-card-border/30">
        <div className={cn(
          "p-4 rounded-xl",
          displayScore >= 70 ? "bg-success/5 border border-success/20"
            : displayScore >= 40 ? "bg-warning/5 border border-warning/20"
            : "bg-error/5 border border-error/20"
        )}>
          <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-widest mb-1">Optimization Score</p>
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "text-2xl font-bold font-data tabular-nums",
              displayScore >= 70 ? "text-success" : displayScore >= 40 ? "text-warning" : "text-error"
            )}>
              {displayScore}
            </span>
            <span className="text-xs text-foreground-muted font-medium">/100</span>
          </div>
          <p className="text-[10px] text-foreground-muted mt-1">
            {displayScore >= 80 ? "Excellent alignment" :
             displayScore >= 60 ? "Good, room to improve" :
             displayScore >= 40 ? "Needs attention" :
             hasBudgets ? "Significant gaps" : "Set budgets to improve"}
          </p>
        </div>
      </div>

      {/* Income Banner */}
      <div className="px-4 pt-3">
        <InsightsIncomeBanner
          income={income}
          totalDataDriven={totalDataDriven}
          totalYourBudget={totalYourBudget}
          hasBudgets={hasBudgets}
        />
      </div>

      {/* Category Verdicts */}
      {visible.length > 0 && (
        <div className="p-4">
          <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-widest mb-3">Category Health</p>
          <div className="space-y-2">
            {visible.map((item) => {
              const meta = getCategoryMeta(item.category)
              const style = VERDICT_STYLES[item.verdict]
              return (
                <div key={item.category} className="flex items-center gap-2.5 py-1.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${meta.hex} 12%, var(--background-secondary))` }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: 14, color: meta.hex }}>{meta.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{item.category}</p>
                    <p className="text-[10px] text-foreground-muted tabular-nums font-data">
                      {item.yourBudget != null
                        ? `${formatCurrency(item.yourBudget, "USD", 0)} / ${formatCurrency(item.dataDriven, "USD", 0)} suggested`
                        : `${formatCurrency(item.dataDriven, "USD", 0)} suggested`}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0",
                    style.bg, style.text,
                  )}>
                    {style.label}
                  </span>
                </div>
              )
            })}
          </div>
          {remaining > 0 && (
            <Link
              href="/finance/budgets/insights"
              className="text-[10px] text-primary font-semibold hover:underline mt-2 inline-block"
            >
              +{remaining} more categories
            </Link>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-card-border/30">
        <Link
          href="/finance/budgets/insights"
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 bg-background-secondary hover:bg-background-secondary/80 text-foreground text-xs font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>analytics</span>
          Full Analysis
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>arrow_forward</span>
        </Link>
      </div>
    </div>
  )
}
