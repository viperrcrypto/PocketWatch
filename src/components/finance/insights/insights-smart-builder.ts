import { formatCurrency } from "@/lib/utils"

interface SmartInsight {
  icon: string
  title: string
  description: string
  variant: "info" | "warning" | "success" | "danger"
  actionLink?: { label: string; href: string }
}

interface BuildInsightsParams {
  velocity: any
  prevSpending: number
  forecast: any
  savingsRate: number
  streaks: any
  overBudget: any[]
  subscriptionSummary: any
  dayOfWeekPatterns: any[] | undefined
  spending: number
  housingSpend: number
}

export function buildSmartInsights({
  velocity,
  prevSpending,
  forecast,
  savingsRate,
  streaks,
  overBudget,
  subscriptionSummary,
  dayOfWeekPatterns,
  spending,
  housingSpend,
}: BuildInsightsParams): SmartInsight[] {
  const insights: SmartInsight[] = []

  if (velocity) {
    insights.push({
      icon: "speed",
      title: `${formatCurrency(velocity.dailyAvg)}/day spending pace`,
      description: `At this rate, you'll spend ${formatCurrency(velocity.projectedTotal)} this month. ${velocity.daysRemaining} days remaining.`,
      variant: velocity.projectedTotal > prevSpending * 1.1 ? "warning" : "info",
    })
  }

  if (forecast && forecast.safeDailySpend > 0) {
    insights.push({
      icon: "account_balance_wallet",
      title: `${formatCurrency(forecast.safeDailySpend)}/day safe to spend`,
      description: `${formatCurrency(forecast.remainingBudget)} remaining budget across ${forecast.daysRemaining} days.`,
      variant: forecast.projectedNetCashFlow >= 0 ? "success" : "warning",
    })
  }

  if (savingsRate >= 20) {
    insights.push({
      icon: "savings",
      title: `${savingsRate.toFixed(1)}% savings rate`,
      description: "You're saving more than 20% of your income. Great financial discipline.",
      variant: "success",
    })
  } else if (savingsRate > 0 && savingsRate < 20) {
    insights.push({
      icon: "savings",
      title: `${savingsRate.toFixed(1)}% savings rate`,
      description: "Aim for 20%+ savings rate for long-term financial health.",
      variant: "warning",
    })
  }

  if (streaks && streaks.longestNoSpendStreak >= 3) {
    insights.push({
      icon: "local_fire_department",
      title: `${streaks.longestNoSpendStreak}-day no-spend streak`,
      description: `${streaks.noSpendDays} no-spend days out of ${streaks.totalDays} this month (${streaks.noSpendRate}%).`,
      variant: "success",
    })
  }

  if (overBudget.length > 0) {
    insights.push({
      icon: "warning",
      title: `${overBudget.length} budget${overBudget.length > 1 ? "s" : ""} exceeded`,
      description: overBudget.map((b) => `${b.category}: ${formatCurrency(b.spent)}/${formatCurrency(b.limit)}`).join(", "),
      variant: "danger",
      actionLink: { label: "View budgets", href: "/finance/budgets" },
    })
  }

  if (subscriptionSummary && subscriptionSummary.unwantedCount > 0) {
    insights.push({
      icon: "cancel",
      title: `${subscriptionSummary.unwantedCount} unwanted subscription${subscriptionSummary.unwantedCount > 1 ? "s" : ""}`,
      description: `Cancel them to save ${formatCurrency(subscriptionSummary.potentialSavings)}/month.`,
      variant: "warning",
      actionLink: { label: "Review subscriptions", href: "/finance/budgets" },
    })
  }

  if (dayOfWeekPatterns) {
    const weekend = (dayOfWeekPatterns[0].total + dayOfWeekPatterns[6].total) / 2
    const weekday = dayOfWeekPatterns.slice(1, 6).reduce((s, d) => s + d.total, 0) / 5
    if (weekend > weekday * 1.5) {
      insights.push({
        icon: "weekend",
        title: "Weekend spending is high",
        description: `You spend ${formatCurrency(weekend)}/day on weekends vs ${formatCurrency(weekday)}/day on weekdays.`,
        variant: "info",
      })
    }
  }

  if (spending > 0 && housingSpend / spending > 0.35) {
    insights.push({
      icon: "home",
      title: `Housing is ${((housingSpend / spending) * 100).toFixed(0)}% of spending`,
      description: "Financial advisors recommend keeping housing below 30-35% of expenses.",
      variant: "warning",
    })
  }

  return insights
}
