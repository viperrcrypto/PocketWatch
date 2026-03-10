/**
 * Shared logic for computing data-driven budget suggestions from spending history.
 * Used by both the suggest API and the budget insights API.
 */

import { db } from "@/lib/db"
import { getBudgetableCategories } from "@/lib/finance/categories"

export interface BudgetSuggestion {
  category: string
  avgMonthly: number
  lastMonth: number
  monthsOfData: number
  suggested: number
}

export interface SuggestionsResult {
  suggestions: BudgetSuggestion[]
  monthsAnalyzed: number
  totalAvgSpending: number
}

export async function computeBudgetSuggestions(userId: string): Promise<SuggestionsResult> {
  const months = 6

  const distinctMonths = await db.$queryRaw<Array<{ month: string }>>`
    SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') AS month
    FROM "FinanceTransaction"
    WHERE "userId" = ${userId}
      AND "isDuplicate" = false
      AND "isExcluded" = false
    ORDER BY month DESC
    LIMIT ${months}
  `

  if (distinctMonths.length === 0) {
    return { suggestions: [], monthsAnalyzed: 0, totalAvgSpending: 0 }
  }

  const monthStrings = distinctMonths.map((m) => m.month)
  const oldestMonth = monthStrings[monthStrings.length - 1]
  const newestMonth = monthStrings[0]
  const startDate = new Date(`${oldestMonth}-01`)
  const endParts = newestMonth.split("-")
  const endDate = new Date(Number(endParts[0]), Number(endParts[1]), 1)

  const transactions = await db.financeTransaction.findMany({
    where: {
      userId,
      isDuplicate: false,
      isExcluded: false,
      date: { gte: startDate, lt: endDate },
      amount: { gt: 0 },
    },
    select: { date: true, amount: true, category: true },
  })

  const budgetable = new Set(getBudgetableCategories())
  const categoryMonths = new Map<string, Map<string, number>>()

  for (const tx of transactions) {
    const cat = tx.category ?? "Uncategorized"
    if (!budgetable.has(cat)) continue
    const monthKey = tx.date.toISOString().slice(0, 7)
    if (!monthStrings.includes(monthKey)) continue
    if (!categoryMonths.has(cat)) categoryMonths.set(cat, new Map())
    const catMonths = categoryMonths.get(cat)!
    catMonths.set(monthKey, (catMonths.get(monthKey) ?? 0) + tx.amount)
  }

  const monthCount = monthStrings.length
  const lastMonthKey = monthStrings[0]
  const suggestions: BudgetSuggestion[] = []

  for (const [category, monthMap] of categoryMonths) {
    const total = Array.from(monthMap.values()).reduce((s, v) => s + v, 0)
    const avgMonthly = Math.round((total / monthCount) * 100) / 100
    const lastMonth = Math.round((monthMap.get(lastMonthKey) ?? 0) * 100) / 100
    const suggested = Math.ceil((avgMonthly * 1.1) / 10) * 10

    suggestions.push({ category, avgMonthly, lastMonth, monthsOfData: monthMap.size, suggested })
  }

  suggestions.sort((a, b) => b.avgMonthly - a.avgMonthly)

  const totalAvgSpending = Math.round(
    suggestions.reduce((s, c) => s + c.avgMonthly, 0) * 100
  ) / 100

  return { suggestions, monthsAnalyzed: monthCount, totalAvgSpending }
}
