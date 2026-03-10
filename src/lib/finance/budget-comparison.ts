import type { ComparisonItem } from "@/components/finance/budget-insights/insights-types"

interface BudgetInput {
  category: string
  monthlyLimit: number
  spent: number
}

interface SuggestionInput {
  category: string
  suggested: number
  avgMonthly: number
  monthsOfData: number
}

interface TopCategoryInput {
  category: string
  total: number
}

export function buildBudgetComparison(
  budgets: BudgetInput[],
  suggestions: SuggestionInput[],
  topCategories: TopCategoryInput[],
): ComparisonItem[] {
  const budgetMap = new Map(budgets.map((b) => [b.category, b]))
  const spentMap = new Map<string, number>()
  for (const cat of topCategories) spentMap.set(cat.category, cat.total)
  for (const b of budgets) spentMap.set(b.category, b.spent)

  const items: ComparisonItem[] = suggestions.map((s) => {
    const budget = budgetMap.get(s.category)
    const yourBudget = budget?.monthlyLimit ?? null
    const currentSpent = spentMap.get(s.category) ?? 0

    let verdict: ComparisonItem["verdict"]
    let gap: number
    let gapPercent: number

    if (yourBudget == null) {
      verdict = "missing"; gap = 0; gapPercent = 0
    } else {
      gap = yourBudget - s.suggested
      gapPercent = s.suggested > 0 ? (gap / s.suggested) * 100 : 0
      if (Math.abs(gapPercent) <= 15) verdict = "well-aligned"
      else if (gap < 0) verdict = "under-budgeted"
      else verdict = "over-budgeted"
    }

    return {
      category: s.category, dataDriven: s.suggested, avgMonthly: s.avgMonthly,
      yourBudget, currentSpent, monthsOfData: s.monthsOfData, gap, gapPercent, verdict,
    }
  })

  for (const b of budgets) {
    if (!items.find((i) => i.category === b.category)) {
      items.push({
        category: b.category, dataDriven: 0, avgMonthly: 0, yourBudget: b.monthlyLimit,
        currentSpent: b.spent, monthsOfData: 0, gap: b.monthlyLimit, gapPercent: 100, verdict: "over-budgeted",
      })
    }
  }

  return items
}
