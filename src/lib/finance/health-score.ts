/**
 * Financial health score computation.
 */

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Compute a composite financial health score (0-100).
 */
export function computeHealthScore(params: {
  savingsRate: number
  budgetHealth: Array<{ percentUsed: number }>
  spendingChange: number
  recurringRatio: number
  uncategorizedRatio: number
}): { score: number; grade: string; breakdown: Array<{ factor: string; score: number; weight: number }> } {
  const savingsScore = Math.min(100, Math.max(0, params.savingsRate * 5))

  const budgetScore = params.budgetHealth.length > 0
    ? params.budgetHealth.reduce((s, b) => {
        const adherence = b.percentUsed <= 100 ? 100 : Math.max(0, 200 - b.percentUsed)
        return s + adherence
      }, 0) / params.budgetHealth.length
    : 75

  const trendScore = params.spendingChange <= 0
    ? Math.min(100, 75 + Math.abs(params.spendingChange) * 50)
    : Math.max(0, 75 - params.spendingChange * 50)

  const fixedScore = params.recurringRatio >= 30 && params.recurringRatio <= 60
    ? 100
    : params.recurringRatio < 30
      ? 60 + params.recurringRatio
      : Math.max(0, 160 - params.recurringRatio)

  const catScore = Math.max(0, (1 - params.uncategorizedRatio) * 100)

  const breakdown = [
    { factor: "Savings Rate", score: round(savingsScore), weight: 30 },
    { factor: "Budget Adherence", score: round(budgetScore), weight: 25 },
    { factor: "Spending Trend", score: round(trendScore), weight: 20 },
    { factor: "Cost Structure", score: round(fixedScore), weight: 15 },
    { factor: "Data Quality", score: round(catScore), weight: 10 },
  ]

  const score = round(breakdown.reduce((s, b) => s + b.score * (b.weight / 100), 0))

  const grade =
    score >= 90 ? "A+" :
    score >= 80 ? "A" :
    score >= 70 ? "B" :
    score >= 60 ? "C" :
    score >= 50 ? "D" : "F"

  return { score, grade, breakdown }
}
