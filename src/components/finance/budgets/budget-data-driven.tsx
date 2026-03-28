"use client"

import { useMemo } from "react"
import { getCategoryMeta } from "@/lib/finance/categories"
import { BudgetProgressBar } from "@/components/finance/budget-progress-bar"
import { formatCurrency, cn } from "@/lib/utils"
import { FadeIn } from "@/components/motion/fade-in"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"

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
  totalSpending: number
  currentMonth: string
  hasBudgets: boolean
  onCreateBudget: () => void
}

export function BudgetDataDriven({
  suggestions,
  topCategories,
  trendsData,
  totalSpending,
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
        existing.thisMonth = tc.total
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
      {/* Summary strip — same style as BudgetStatStrip */}
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

      {/* Category breakdown — same card style as BudgetCategoryCard */}
      <FadeIn delay={0.05}>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Spending by Category</h2>

          <StaggerChildren className="space-y-2" staggerMs={30}>
            {categories.map((cat) => {
              const meta = getCategoryMeta(cat.category)
              const vsAvg = cat.avgMonthly > 0 ? ((cat.thisMonth - cat.avgMonthly) / cat.avgMonthly) * 100 : null
              const isUp = vsAvg !== null && vsAvg > 10
              const isDown = vsAvg !== null && vsAvg < -10

              return (
                <StaggerItem key={cat.category}>
                  <div className="bg-card border border-card-border rounded-xl px-4 py-3 hover:border-card-border-hover transition-colors" tabIndex={0} aria-label={`${cat.category}: ${formatCurrency(cat.thisMonth, "USD", 0)} this month`}>
                    <div className="flex items-center gap-3">
                      {/* Icon — same as BudgetCategoryCard */}
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${meta.hex}18` }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 18, color: meta.hex }}>{meta.icon}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold text-foreground truncate">{cat.category}</span>
                            {/* Status icon — same pattern as BudgetCategoryCard */}
                            {vsAvg !== null && (
                              <span className={cn("material-symbols-rounded flex-shrink-0", isUp ? "text-error" : isDown ? "text-success" : "text-foreground-muted")} style={{ fontSize: 14 }} aria-label={isUp ? "Above average" : isDown ? "Below average" : "Near average"}>
                                {isUp ? "trending_up" : isDown ? "trending_down" : "drag_handle"}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-foreground-muted tabular-nums">
                              {formatCurrency(cat.thisMonth, "USD", 0)} spent
                            </span>
                            {cat.avgMonthly > 0 && (
                              <span className={cn("text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md", isUp ? "bg-error/12 text-error" : isDown ? "bg-success/12 text-success" : "bg-foreground/5 text-foreground-muted")}>
                                {vsAvg !== null ? `${vsAvg > 0 ? "+" : ""}${Math.round(vsAvg)}%` : "—"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress bar — reuse BudgetProgressBar, treat avg as "limit" */}
                        <BudgetProgressBar spent={cat.thisMonth} limit={cat.avgMonthly > 0 ? cat.avgMonthly : cat.thisMonth} color={meta.hex} />

                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-3">
                            {/* Sparkline — same as BudgetCategoryCard */}
                            {cat.trendData.length > 0 && (
                              <div className="hidden sm:flex items-end gap-px" aria-hidden="true">
                                <Sparkline data={cat.trendData} color={meta.hex} />
                                <span className="text-[9px] text-foreground-muted ml-1.5 tabular-nums">
                                  avg {formatCurrency(cat.avgMonthly, "USD", 0)}
                                </span>
                              </div>
                            )}

                            {/* vs Average alert — same style as "over" alert in BudgetCategoryCard */}
                            {isUp && vsAvg !== null && (
                              <span className="text-[10px] text-error font-semibold tabular-nums flex items-center gap-0.5">
                                <span className="material-symbols-rounded" style={{ fontSize: 11 }}>arrow_upward</span>
                                {formatCurrency(cat.thisMonth - cat.avgMonthly, "USD", 0)} above avg
                              </span>
                            )}
                          </div>

                          {cat.lastMonth > 0 && (
                            <span className="text-[9px] text-foreground-muted tabular-nums">
                              last month {formatCurrency(cat.lastMonth, "USD", 0)}
                            </span>
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

      {/* CTA — only show if no budgets exist */}
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

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const last6 = data.slice(-6)
  if (last6.length === 0) return null
  const max = Math.max(...last6, 1)
  const barW = 4, gap = 2, h = 20, w = last6.length * (barW + gap) - gap
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      {last6.map((val, i) => {
        const barH = Math.max((val / max) * h, 1)
        return <rect key={i} x={i * (barW + gap)} y={h - barH} width={barW} height={barH} rx={1} fill={color} opacity={i === last6.length - 1 ? 1 : 0.4} />
      })}
    </svg>
  )
}
