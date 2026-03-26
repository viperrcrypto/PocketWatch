/**
 * Deep financial insights computation engine.
 * Extracted from the deep insights API route for reuse by the AI system.
 */

import { db } from "@/lib/db"
import { computeHealthScore } from "./health-score"
import { uncategorizedWhere } from "./categorize"

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export interface DeepInsightsResult {
  currentMonth: string
  previousMonth: string | null
  totalSpending: number
  totalIncome: number
  savingsRate: number
  healthScore: { score: number; grade: string; breakdown: Array<{ factor: string; score: number; weight: number }> }
  spendingVelocity: {
    dailyAvg: number; projectedTotal: number; currentTotal: number
    priorPeriodTotal: number; daysElapsed: number; daysRemaining: number
  }
  cashFlowForecast: {
    projectedIncome: number; projectedSpending: number; projectedNetCashFlow: number
    remainingBudget: number; safeDailySpend: number; daysRemaining: number
  }
  spendingStreaks: { noSpendDays: number; totalDays: number; longestNoSpendStreak: number; noSpendRate: number }
  recurringVsOneTime: { recurring: number; oneTime: number; fixedCostRatio: number }
  dayOfWeekPatterns: Array<{ day: string; total: number }>
  topCategories: Array<{
    category: string; total: number
    topMerchants: Array<{ name: string; amount: number }>
    subcategories: Array<{ name: string; amount: number }>
  }>
  categoryComparison: Array<{
    category: string; currentTotal: number; previousTotal: number
    changePercent: number | null; direction: string
  }>
  incomeSources: Array<{ name: string; amount: number }>
  anomalies: Array<{ category: string; currentAmount: number; previousAmount: number; multiplier: number }>
  budgetHealth: Array<{
    category: string; spent: number; limit: number; percentUsed: number
    remaining: number; daysRemaining: number; projectedOverage: number
  }>
  subscriptionSummary: { monthlyTotal: number; monthlySubsOnly: number; activeCount: number; unwantedCount: number; potentialSavings: number }
  frequentMerchants: Array<{ name: string; count: number; total: number; category: string | null; logoUrl: string | null }>
  largestPurchases: Array<{ id: string; name: string; amount: number; date: string; category: string | null; logoUrl: string | null }>
  dailySpending: Array<{ date: string; amount: number }>
  uncategorizedCount: number
  uncategorizedPreview: Array<{ id: string; name: string; amount: number; date: string; logoUrl: string | null }>
}

/**
 * Compute deep financial insights for a user.
 * Returns null if no transaction data exists.
 */
export async function computeDeepInsights(userId: string): Promise<DeepInsightsResult | null> {
  const recentMonths = await db.$queryRaw<Array<{ month: string }>>`
    SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') AS month
    FROM "FinanceTransaction"
    WHERE "userId" = ${userId} AND "isDuplicate" = false AND "isExcluded" = false
    ORDER BY month DESC LIMIT 2
  `

  const currentMonth = recentMonths[0]?.month
  if (!currentMonth) return null

  const currentStart = new Date(`${currentMonth}-01`)
  const cmParts = currentMonth.split("-")
  const currentEnd = new Date(Number(cmParts[0]), Number(cmParts[1]), 1)

  const prevMonth = recentMonths[1]?.month
  const prevStart = prevMonth ? new Date(`${prevMonth}-01`) : null
  const pmParts = prevMonth?.split("-")
  const prevEnd = pmParts ? new Date(Number(pmParts[0]), Number(pmParts[1]), 1) : null

  const baseWhere = { userId, isDuplicate: false, isExcluded: false }
  const [txs, prevTxs, budgets, subs, uncategorizedCount, uncategorizedPreviewRaw] = await Promise.all([
    db.financeTransaction.findMany({
      where: { ...baseWhere, date: { gte: currentStart, lt: currentEnd } },
      select: { id: true, date: true, amount: true, category: true, subcategory: true, plaidCategoryPrimary: true, merchantName: true, name: true, isRecurring: true, logoUrl: true },
    }),
    prevStart && prevEnd
      ? db.financeTransaction.findMany({ where: { ...baseWhere, date: { gte: prevStart, lt: prevEnd } }, select: { amount: true, category: true, plaidCategoryPrimary: true } })
      : Promise.resolve([]),
    db.financeBudget.findMany({ where: { userId, isActive: true } }),
    db.financeSubscription.findMany({ where: { userId } }),
    db.financeTransaction.count({ where: { ...uncategorizedWhere(userId), date: { gte: currentStart, lt: currentEnd } } }),
    db.financeTransaction.findMany({
      where: { ...uncategorizedWhere(userId), date: { gte: currentStart, lt: currentEnd } },
      select: { id: true, merchantName: true, name: true, amount: true, date: true, logoUrl: true },
      orderBy: { amount: "desc" },
      take: 5,
    }),
  ])

  // FIX Bug 15: Use data month's day-of-month, not wall clock (they may differ
  // when the latest data month isn't the current calendar month)
  const now = new Date()
  const isCurrentCalendarMonth = Number(cmParts[0]) === now.getFullYear() && Number(cmParts[1]) === (now.getMonth() + 1)
  const dayOfMonth = isCurrentCalendarMonth ? Math.max(1, now.getDate()) : new Date(Number(cmParts[0]), Number(cmParts[1]), 0).getDate()
  const daysInMonth = new Date(Number(cmParts[0]), Number(cmParts[1]), 0).getDate()
  // Exclude transfers, payments, and investments from spending calculations
  const EXCLUDED_CATEGORIES = new Set(["transfer", "payment", "credit card payment", "internal transfer", "loan payment", "investment"])
  const EXCLUDED_PLAID = new Set(["TRANSFER_OUT", "TRANSFER_IN", "LOAN_PAYMENTS", "INCOME"])
  const isRealSpend = (t: { amount: number; category: string | null; plaidCategoryPrimary?: string | null }) =>
    t.amount > 0 &&
    !EXCLUDED_CATEGORIES.has((t.category ?? "").toLowerCase()) &&
    !EXCLUDED_PLAID.has(t.plaidCategoryPrimary ?? "")

  const realSpendTxs = txs.filter(isRealSpend)
  const spending = realSpendTxs.reduce((s, t) => s + t.amount, 0)
  // Only count "Income" category as income (not refunds, transfer credits, etc.)
  const income = txs.filter((t) => t.amount < 0 && (t.category ?? "").toLowerCase() === "income").reduce((s, t) => s + Math.abs(t.amount), 0)

  // Use median daily spend for burn rate (resistant to outlier days like a $3K one-off)
  const dailyTotals = new Map<string, number>()
  for (const t of realSpendTxs) {
    const day = t.date.toISOString().slice(0, 10)
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + t.amount)
  }
  // Fill in zero-spend days so they count in the median
  for (let d = 1; d <= dayOfMonth; d++) {
    const key = `${cmParts[0]}-${cmParts[1].padStart(2, "0")}-${String(d).padStart(2, "0")}`
    if (!dailyTotals.has(key)) dailyTotals.set(key, 0)
  }
  const sortedDays = [...dailyTotals.values()].sort((a, b) => a - b)
  const mid = Math.floor(sortedDays.length / 2)
  const medianDaily = sortedDays.length % 2 === 0
    ? (sortedDays[mid - 1] + sortedDays[mid]) / 2
    : sortedDays[mid]
  const dailyAvg = round(medianDaily)

  // Use average for projections (should account for big purchases)
  const avgDaily = spending / Math.max(1, dayOfMonth)
  const projectedTotal = avgDaily * daysInMonth
  const prevSpending = prevTxs.filter(isRealSpend).reduce((s, t) => s + t.amount, 0)

  const spendingVelocity = { dailyAvg: round(dailyAvg), projectedTotal: round(projectedTotal), currentTotal: round(spending), priorPeriodTotal: round(prevSpending), daysElapsed: dayOfMonth, daysRemaining: daysInMonth - dayOfMonth }

  // Match recurring transactions: either flagged isRecurring or merchant matches a detected subscription
  const subMerchants = new Set(subs.map((s) => (s.merchantName ?? "").toLowerCase()).filter(Boolean))
  const recurringSpend = txs.filter((t) => t.amount > 0 && (t.isRecurring || subMerchants.has((t.merchantName ?? "").toLowerCase()))).reduce((s, t) => s + t.amount, 0)
  const recurringVsOneTime = { recurring: round(recurringSpend), oneTime: round(spending - recurringSpend), fixedCostRatio: spending > 0 ? round((recurringSpend / spending) * 100) : 0 }

  const dayTotals = [0, 0, 0, 0, 0, 0, 0]
  for (const tx of realSpendTxs) { dayTotals[tx.date.getDay()] += tx.amount }
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const dayOfWeekPatterns = dayLabels.map((label, i) => ({ day: label, total: round(dayTotals[i]) }))

  // FIX Bug 14: Use realSpendTxs (filtered) instead of raw txs for category drilldown
  // This prevents transfers and CC payments from appearing in topCategories
  const categoryMap = new Map<string, { total: number; merchants: Map<string, number>; subcats: Map<string, number> }>()
  for (const tx of realSpendTxs) {
    const cat = tx.category ?? "Uncategorized"
    const entry = categoryMap.get(cat) ?? { total: 0, merchants: new Map(), subcats: new Map() }
    entry.total += tx.amount
    const merchant = tx.merchantName ?? tx.name
    entry.merchants.set(merchant, (entry.merchants.get(merchant) ?? 0) + tx.amount)
    if (tx.subcategory) entry.subcats.set(tx.subcategory, (entry.subcats.get(tx.subcategory) ?? 0) + tx.amount)
    categoryMap.set(cat, entry)
  }

  const topCategories = [...categoryMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 3).map(([category, data]) => ({
    category, total: round(data.total),
    topMerchants: [...data.merchants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount: round(amount) })),
    subcategories: [...data.subcats.entries()].sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount: round(amount) })),
  }))

  // Anomaly flags
  const prevCatMap = new Map<string, number>()
  const prevRealSpend = prevTxs.filter(isRealSpend)
  for (const tx of prevRealSpend) { prevCatMap.set(tx.category ?? "Uncategorized", (prevCatMap.get(tx.category ?? "Uncategorized") ?? 0) + tx.amount) }

  const anomalies = [...categoryMap.entries()].filter(([cat, data]) => { const prev = prevCatMap.get(cat) ?? 0; return prev > 0 && data.total > prev * 2 })
    .map(([category, data]) => ({ category, currentAmount: round(data.total), previousAmount: round(prevCatMap.get(category) ?? 0), multiplier: round(data.total / (prevCatMap.get(category) ?? 1)) }))

  // Budget health
  const budgetHealth = budgets.map((b) => {
    const spent = categoryMap.get(b.category)?.total ?? 0
    const percentUsed = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0
    const projectedOverage = dailyAvg > 0 && b.monthlyLimit > 0 ? Math.max(0, (spent / dayOfMonth) * daysInMonth - b.monthlyLimit) : 0
    return { category: b.category, spent: round(spent), limit: b.monthlyLimit, percentUsed: round(percentUsed), remaining: round(Math.max(0, b.monthlyLimit - spent)), daysRemaining: daysInMonth - dayOfMonth, projectedOverage: round(projectedOverage) }
  })

  // Subscriptions
  const activeSubs = subs.filter((s) => s.status === "active")
  const unwantedSubs = activeSubs.filter((s) => !s.isWanted)
  const toMonthly = (sub: { amount: number; frequency: string }) => {
    switch (sub.frequency) {
      case "weekly": return sub.amount * 4.33
      case "biweekly": return sub.amount * 2.17
      case "semi_monthly": return sub.amount * 2
      case "monthly": return sub.amount
      case "quarterly": return sub.amount / 3
      case "semi_annual": return sub.amount / 6
      case "yearly": return sub.amount / 12
      default: return sub.amount
    }
  }
  const monthlySubTotal = activeSubs.reduce((s, sub) => s + toMonthly(sub), 0)
  const trueSubs = activeSubs.filter((s) => s.billType === "subscription" || !s.billType)
  const monthlySubsOnly = trueSubs.reduce((s, sub) => s + toMonthly(sub), 0)
  const subscriptionSummary = { monthlyTotal: round(monthlySubTotal), monthlySubsOnly: round(monthlySubsOnly), activeCount: activeSubs.length, unwantedCount: unwantedSubs.length, potentialSavings: round(unwantedSubs.reduce((s, sub) => s + sub.amount, 0)) }

  // Frequent merchants — use realSpendTxs to exclude transfers/investments
  const merchantFreq = new Map<string, { count: number; total: number; category: string | null; logoUrl: string | null }>()
  for (const tx of realSpendTxs) {
    const name = tx.merchantName ?? tx.name
    const entry = merchantFreq.get(name) ?? { count: 0, total: 0, category: null, logoUrl: null }
    entry.count++; entry.total += tx.amount; entry.category = tx.category
    if (!entry.logoUrl && tx.logoUrl) entry.logoUrl = tx.logoUrl
    merchantFreq.set(name, entry)
  }
  const frequentMerchants = [...merchantFreq.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    .map(([name, data]) => ({ name, count: data.count, total: round(data.total), category: data.category, logoUrl: data.logoUrl }))

  // Largest purchases — only real spending, not transfers
  const largestPurchases = [...realSpendTxs].sort((a, b) => b.amount - a.amount).slice(0, 5)
    .map((tx) => ({ id: tx.id, name: tx.merchantName ?? tx.name, amount: round(tx.amount), date: tx.date.toISOString().slice(0, 10), category: tx.category, logoUrl: tx.logoUrl }))

  const uncategorizedPreview = uncategorizedPreviewRaw.map((t) => ({
    id: t.id, name: t.merchantName || t.name, amount: t.amount,
    date: t.date.toISOString().slice(0, 10), logoUrl: t.logoUrl,
  }))

  const savingsRate = income > 0 ? Math.max(-100, round(((income - spending) / income) * 100)) : 0

  const healthScore = computeHealthScore({ savingsRate, budgetHealth, spendingChange: prevSpending > 0 ? (spending - prevSpending) / prevSpending : 0, recurringRatio: recurringVsOneTime.fixedCostRatio, uncategorizedRatio: txs.length > 0 ? uncategorizedCount / txs.length : 0 })

  // Spending streaks
  const spendingDates = new Set(realSpendTxs.map((t) => t.date.toISOString().slice(0, 10)))
  const allDays: string[] = []
  for (let d = new Date(currentStart); d < currentEnd && d <= new Date(); d.setDate(d.getDate() + 1)) { allDays.push(d.toISOString().slice(0, 10)) }
  const noSpendDays = allDays.filter((d) => !spendingDates.has(d)).length
  let longestNoSpendStreak = 0; let currentStreak = 0
  for (const day of allDays) { if (!spendingDates.has(day)) { currentStreak++; longestNoSpendStreak = Math.max(longestNoSpendStreak, currentStreak) } else { currentStreak = 0 } }
  const spendingStreaks = { noSpendDays, totalDays: allDays.length, longestNoSpendStreak, noSpendRate: allDays.length > 0 ? round((noSpendDays / allDays.length) * 100) : 0 }

  const daysRemaining = daysInMonth - dayOfMonth
  const remainingBudget = round(budgetHealth.reduce((s, b) => s + Math.max(0, b.remaining), 0))
  const cashFlowForecast = { projectedIncome: round(income), projectedSpending: round(projectedTotal), projectedNetCashFlow: round(income - projectedTotal), remainingBudget, safeDailySpend: daysRemaining > 0 ? round(remainingBudget / daysRemaining) : 0, daysRemaining }

  const categoryComparison = [...categoryMap.entries()].map(([category, data]) => {
    const prevTotal = prevCatMap.get(category) ?? 0
    const change = prevTotal > 0 ? round(((data.total - prevTotal) / prevTotal) * 100) : null
    return { category, currentTotal: round(data.total), previousTotal: round(prevTotal), changePercent: change, direction: change === null ? "new" : change > 5 ? "up" : change < -5 ? "down" : "flat" }
  }).sort((a, b) => b.currentTotal - a.currentTotal)

  // Income sources — only count "Income" category, not all negative amounts
  const incomeBySource = new Map<string, number>()
  for (const tx of txs) {
    if (tx.amount >= 0 || (tx.category ?? "").toLowerCase() !== "income") continue
    const name = tx.merchantName ?? tx.name ?? "Unknown"
    incomeBySource.set(name, (incomeBySource.get(name) ?? 0) + Math.abs(tx.amount))
  }
  const incomeSources = [...incomeBySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount: round(amount) }))

  // Daily spending array for charts (sorted by date, from the server-computed dailyTotals)
  const dailySpending = [...dailyTotals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, amount]) => ({ date, amount: round(amount) }))

  return {
    currentMonth, previousMonth: prevMonth ?? null, totalSpending: round(spending), totalIncome: round(income), savingsRate, healthScore, spendingVelocity, cashFlowForecast, spendingStreaks, recurringVsOneTime, dayOfWeekPatterns, topCategories, categoryComparison, incomeSources, anomalies, budgetHealth, subscriptionSummary, frequentMerchants, largestPurchases, dailySpending, uncategorizedCount, uncategorizedPreview,
  }
}
