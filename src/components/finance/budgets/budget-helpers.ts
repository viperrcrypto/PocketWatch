/**
 * Pure computation helpers for budget components.
 * No React, no side effects — just data transforms.
 */

import type {
  BudgetWithSpending,
  BudgetCategoryData,
  BudgetSummary,
  BudgetInsight,
  PaceMetrics,
  PaceChartPoint,
  DailySpendingPoint,
  SubImpactItem,
} from "./budget-types"

export type { BudgetInsight }

// ─── Summary ────────────────────────────────────────────────────

export function computeBudgetSummary(
  budgets: BudgetWithSpending[] | undefined,
): BudgetSummary {
  if (!budgets || budgets.length === 0) {
    return { totalBudgeted: 0, totalSpent: 0, remaining: 0, percentUsed: 0, budgetCount: 0, overBudgetCount: 0 }
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.monthlyLimit, 0)
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0)
  const remaining = totalBudgeted - totalSpent
  const percentUsed = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0
  const overBudgetCount = budgets.filter((b) => b.percentUsed > 100).length

  return { totalBudgeted, totalSpent, remaining, percentUsed, budgetCount: budgets.length, overBudgetCount }
}

// ─── Pace Metrics ───────────────────────────────────────────────

export function computePaceMetrics(
  totalSpent: number,
  totalBudgeted: number,
  dayOfMonth: number,
  daysInMonth: number,
): PaceMetrics {
  const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0
  const projectedTotal = Math.round(dailyAvg * daysInMonth)
  const daysRemaining = daysInMonth - dayOfMonth
  const safeDailySpend = daysRemaining > 0
    ? Math.max(0, (totalBudgeted - totalSpent) / daysRemaining)
    : 0
  const isOnTrack = projectedTotal <= totalBudgeted

  return { dailyAvg, projectedTotal, safeDailySpend, isOnTrack, daysRemaining, daysInMonth, dayOfMonth }
}

// ─── Pace Chart Data ────────────────────────────────────────────

export function buildPaceChartData(
  dailySpending: DailySpendingPoint[] | undefined,
  totalBudgeted: number,
  daysInMonth: number,
  dayOfMonth: number,
  projectedTotal: number,
): PaceChartPoint[] {
  // Sort defensively before accumulating
  const sorted = [...(dailySpending ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  let cumulative = 0
  const cumulativeByDay = new Map<number, number>()
  for (const d of sorted) {
    cumulative += d.amount
    const dayNum = new Date(d.date).getDate()
    cumulativeByDay.set(dayNum, cumulative)
  }

  // Forward-fill any gaps in the cumulative map
  let lastKnown = 0
  for (let d = 1; d <= dayOfMonth; d++) {
    if (cumulativeByDay.has(d)) {
      lastKnown = cumulativeByDay.get(d)!
    } else {
      cumulativeByDay.set(d, lastKnown)
    }
  }

  const currentSpent = cumulativeByDay.get(dayOfMonth) ?? 0

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const ideal = (day / daysInMonth) * totalBudgeted

    const actual = day <= dayOfMonth ? (cumulativeByDay.get(day) ?? 0) : null

    let projected: number | null = null
    if (day >= dayOfMonth && dayOfMonth < daysInMonth) {
      const fraction = (day - dayOfMonth) / (daysInMonth - dayOfMonth)
      projected = currentSpent + fraction * (projectedTotal - currentSpent)
    }

    return { day, ideal, actual, projected }
  })
}

// ─── Category Data Builder ──────────────────────────────────────

interface TrendMonth {
  month: string
  categories: Record<string, number>
}

interface SubscriptionItem {
  merchantName: string
  amount: number
  logoUrl?: string | null
  category?: string | null
  status: string
}

export function buildCategoryData(
  budgets: BudgetWithSpending[] | undefined,
  trendsData: { months: TrendMonth[] } | undefined,
  subsData: { subscriptions: SubscriptionItem[]; monthlyTotal: number } | undefined,
): BudgetCategoryData[] {
  if (!budgets) return []

  const months = trendsData?.months ?? []
  const activeSubs = (subsData?.subscriptions ?? []).filter((s) => s.status === "active")

  return budgets.map((budget) => {
    const trendData = months.map((m) => m.categories[budget.category] ?? 0)

    const nonZeroMonths = trendData.filter((v) => v > 0)
    const sixMonthAvg = nonZeroMonths.length > 0
      ? nonZeroMonths.reduce((s, v) => s + v, 0) / nonZeroMonths.length
      : null

    const lastMonth = trendData.length >= 2 ? trendData[trendData.length - 2] ?? null : null

    const subscriptions: SubImpactItem[] = activeSubs
      .filter((s) => s.category === budget.category)
      .map((s) => ({ merchantName: s.merchantName, amount: s.amount, logoUrl: s.logoUrl ?? null }))

    return { ...budget, sixMonthAvg, trendData, lastMonth, subscriptions }
  })
}

// ─── Sorting ────────────────────────────────────────────────────

export type SortMode = "status" | "amount" | "name"

export function sortCategories(categories: BudgetCategoryData[], sortBy: SortMode): BudgetCategoryData[] {
  const sorted = [...categories]
  switch (sortBy) {
    case "status":
      sorted.sort((a, b) => b.percentUsed - a.percentUsed)
      break
    case "amount":
      sorted.sort((a, b) => b.spent - a.spent)
      break
    case "name":
      sorted.sort((a, b) => a.category.localeCompare(b.category))
      break
  }
  return sorted
}

// ─── Insights Builder ───────────────────────────────────────────

export function buildInsights(
  categories: BudgetCategoryData[],
  summary: BudgetSummary,
): Omit<BudgetInsight, "action">[] {
  const insights: Omit<BudgetInsight, "action">[] = []

  for (const cat of categories) {
    if (cat.sixMonthAvg && cat.spent > 0 && cat.sixMonthAvg > 0) {
      const pctAboveAvg = ((cat.spent - cat.sixMonthAvg) / cat.sixMonthAvg) * 100
      if (pctAboveAvg > 20) {
        insights.push({
          type: "warning",
          icon: "trending_up",
          message: `${cat.category} is ${Math.round(pctAboveAvg)}% higher than your 6-month average`,
        })
      }
    }
  }

  const zeroSpend = categories.filter((c) => c.spent === 0 && c.monthlyLimit > 0)
  if (zeroSpend.length > 0) {
    const total = zeroSpend.reduce((s, c) => s + c.monthlyLimit, 0)
    insights.push({
      type: "info",
      icon: "swap_horiz",
      message: `${zeroSpend.length} categories have no spending — ${formatCurrencyShort(total)} could be reallocated`,
    })
  }

  if (summary.overBudgetCount > 0) {
    insights.push({
      type: "danger",
      icon: "warning",
      message: `${summary.overBudgetCount} of ${summary.budgetCount} categories are over budget`,
    })
  }

  const underCount = summary.budgetCount - summary.overBudgetCount
  if (underCount > 0 && summary.overBudgetCount > 0) {
    insights.push({
      type: "success",
      icon: "check_circle",
      message: `${underCount} categories are on track — keep it up`,
    })
  }

  return insights.slice(0, 5)
}

function formatCurrencyShort(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
}
