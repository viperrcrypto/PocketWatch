"use client"

import { useMemo } from "react"
import { getCategoryMeta } from "@/lib/finance/categories"
import { BudgetProgressBar } from "@/components/finance/budget-progress-bar"
import { formatCurrency, cn } from "@/lib/utils"
import { FadeIn } from "@/components/motion/fade-in"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"
import { BudgetSparkline } from "./budget-sparkline"

interface Suggestion {
  category: string
  avgMonthly: number
  lastMonth: number
  monthsOfData: number
  suggested: number
}

interface TrendMonth {
  month: string
  categories: Record<string, number>
}

interface TopCategory {
  category: string
  total: number
}

interface BudgetDataDrivenProps {
  suggestions: Suggestion[]
  topCategories: TopCategory[]
  trendsData: { months: TrendMonth[] } | undefined
  currentMonth: string
  hasBudgets: boolean
  onCreateBudget: () => void
}

export function BudgetDataDriven({
  suggestions,
  topCategories,
  trendsData,
  currentMonth,
  hasBudgets,
  onCreateBudget,
}: BudgetDataDrivenProps) {
  const categories = useMemo(() => {
    const map = new Map<string, {
      category: string
      thisMonth: number
      avgMonthly: number
      lastMonth: number
      suggested: number
      trendData: number[]
    }>()

    for (const s of suggestions) {
      const trendData = trendsData?.months.map((m) => m.categories[s.category] ?? 0) ?? []
      map.set(s.category, { category: s.category, thisMonth: 0, avgMonthly: s.avgMonthly, lastMonth: s.lastMonth, suggested: s.suggested, trendData })
    }

    for (const tc of topCategories) {
      const existing = map.get(tc.category)
      if (existing) {
        map.set(tc.category, { ...existing, thisMonth: tc.total })
      } else {
        map.set(tc.category, { category: tc.category, thisMonth: tc.total, avgMonthly: 0, lastMonth: 0, suggested: 0, trendData: [] })
      }
    }

    return [...map.values()].filter((c) => c.thisMonth > 0 || c.avgMonthly > 0).sort((a, b) => b.thisMonth - a.thisMonth)
  }, [suggestions, topCategories, trendsData])

  const totalThisMonth = categories.reduce((s, c) => s + c.thisMonth, 0)
  const totalAvg = categories.reduce((s, c) => s + c.avgMonthly, 0)
  const vsAvgPct = totalAvg > 0 ? Math.round(((totalThisMonth - totalAvg) / totalAvg) * 100) : 0
  const isAboveAvg = totalThisMonth > totalAvg

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <FadeIn>
        <StaggerChildren className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-card-border rounded-xl overflow-hidden" staggerMs={60}>
          <StaggerItem>
            <div className="bg-card px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-rounded text-primary" style={{ fontSize: 14 }}>calendar_month</span>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">This Month</p>
              </div>
              <p className="text-[11px] text-foreground leading-snug">
                <span className="font-data font-bold tabular-nums">{formatCurrency(totalThisMonth, "USD", 0)}</span>
                <span className="text-foreground-muted ml-1">{currentMonth}</span>
              </p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="bg-card px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 14 }}>avg_pace</span>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">6-Month Avg</p>
              </div>
              <p className="text-[11px] text-foreground leading-snug">
                <span className="font-data font-bold tabular-nums">{formatCurrency(totalAvg, "USD", 0)}</span>
                <span className="text-foreground-muted ml-1">per month</span>
              </p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="bg-card px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn("material-symbols-rounded", isAboveAvg ? "text-error" : "text-success")} style={{ fontSize: 14 }}>
                  {isAboveAvg ? "trending_up" : "trending_down"}
                </span>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">vs Average</p>
              </div>
              <p className="text-[11px] text-foreground leading-snug">
                <span className={cn("font-data font-bold tabular-nums", isAboveAvg ? "text-error" : "text-success")}>
                  {isAboveAvg ? "+" : ""}{vsAvgPct}%
                </span>
                <span className="text-foreground-muted ml-1">{isAboveAvg ? "above" : "below"} average</span>
              </p>
            </div>
          </StaggerItem>
        </StaggerChildren>
      </FadeIn>

      {/* Category cards — identical to BudgetCategoryCard layout */}
      <FadeIn delay={0.05}>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Spending by Category</h2>

          <StaggerChildren className="space-y-2" staggerMs={30}>
            {categories.map((cat) => {
              const meta = getCategoryMeta(cat.category)
              const effectiveLimit = cat.avgMonthly > 0 ? cat.avgMonthly : cat.thisMonth
              const percentUsed = effectiveLimit > 0 ? Math.round((cat.thisMonth / effectiveLimit) * 100) : 0
              const isOver = percentUsed > 100
              const isWarn = percentUsed >= 80 && !isOver
              const overAmount = cat.thisMonth - effectiveLimit

              return (
                <StaggerItem key={cat.category}>
                  <div className="bg-card border border-card-border rounded-xl px-4 py-3 hover:border-card-border-hover transition-colors" tabIndex={0} aria-label={`${cat.category}: ${percentUsed}% of average`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${meta.hex}18` }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 18, color: meta.hex }}>{meta.icon}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold text-foreground truncate">{cat.category}</span>
                            <span className={cn("material-symbols-rounded flex-shrink-0", isOver ? "text-error" : isWarn ? "text-warning" : "text-success")} style={{ fontSize: 14 }} aria-label={isOver ? "Above average" : isWarn ? "Approaching average" : "Below average"}>
                              {isOver ? "error" : isWarn ? "warning" : "check_circle"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-foreground-muted tabular-nums">
                              {formatCurrency(cat.thisMonth, "USD", 0)} spent{cat.avgMonthly > 0 && <><span className="mx-0.5">/</span>{formatCurrency(Math.round(cat.avgMonthly), "USD", 0)}</>}
                            </span>
                            <span className={cn("text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md", isOver ? "bg-error/12 text-error" : isWarn ? "bg-warning/12 text-warning" : "bg-success/12 text-success")}>
                              {percentUsed}%
                            </span>
                          </div>
                        </div>

                        <BudgetProgressBar spent={cat.thisMonth} limit={effectiveLimit} color={meta.hex} />

                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-3">
                            {cat.trendData.length > 0 && (
                              <div className="hidden sm:flex items-end gap-px">
                                <BudgetSparkline data={cat.trendData} color={meta.hex} />
                                {cat.avgMonthly > 0 && (
                                  <span className="text-[9px] text-foreground-muted ml-1.5 tabular-nums">avg {formatCurrency(cat.avgMonthly, "USD", 0)}</span>
                                )}
                              </div>
                            )}
                            {isOver && overAmount > 0 && (
                              <span className="text-[10px] text-error font-semibold tabular-nums flex items-center gap-0.5">
                                <span className="material-symbols-rounded" style={{ fontSize: 11 }}>arrow_upward</span>
                                {formatCurrency(overAmount, "USD", 0)} over avg
                              </span>
                            )}
                          </div>
                          {cat.lastMonth > 0 && (
                            <span className="text-[9px] text-foreground-muted tabular-nums">last month {formatCurrency(cat.lastMonth, "USD", 0)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              )
            })}
          </StaggerChildren>
        </div>
      </FadeIn>

      {!hasBudgets && (
        <FadeIn delay={0.15}>
          <div className="bg-card border border-dashed border-card-border rounded-2xl p-6 text-center">
            <span className="material-symbols-rounded text-primary mb-2 block" style={{ fontSize: 24 }}>tune</span>
            <p className="text-sm font-semibold text-foreground mb-1">Want to control your spending?</p>
            <p className="text-xs text-foreground-muted mb-3 max-w-sm mx-auto">
              Create a budget to set limits per category and track your progress against goals.
            </p>
            <button onClick={onCreateBudget} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover transition-colors">
              Create Your First Budget
            </button>
          </div>
        </FadeIn>
      )}
    </div>
  )
}
