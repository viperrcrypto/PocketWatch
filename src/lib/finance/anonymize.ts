/**
 * Anonymization layer for AI financial analysis.
 * Strips all PII — only sends aggregate financial data to LLM providers.
 *
 * NEVER sent: user name, email, account numbers, bank names, account IDs,
 *             transaction IDs, exact dates.
 */

import type { DeepInsightsResult } from "./deep-insights-engine"

interface BudgetData {
  category: string
  monthlyLimit: number
  spent: number
  percentUsed: number
}

interface SubscriptionData {
  merchantName: string
  amount: number
  frequency: string
  category: string | null
  status: string
  isWanted: boolean
  billType: string | null
}

export interface AnonymizedFinancialContext {
  month: string // e.g. "March 2026"
  totalSpending: number
  totalIncome: number
  savingsRate: number
  healthScore: number
  healthGrade: string

  spendingVelocity: {
    dailyAvg: number
    projectedTotal: number
    daysRemaining: number
    momChangePercent: number
  }

  categoryBreakdown: Array<{
    category: string
    currentTotal: number
    previousTotal: number
    changePercent: number | null
    budgetLimit: number | null
    budgetUsedPercent: number | null
  }>

  topMerchants: Array<{
    name: string
    count: number
    total: number
    category: string | null
  }>

  anomalies: Array<{
    category: string
    currentAmount: number
    previousAmount: number
    multiplier: number
  }>

  subscriptions: Array<{
    name: string
    amount: number
    frequency: string
    category: string | null
    isWanted: boolean
    billType: string | null
  }>

  subscriptionSummary: {
    monthlyTotal: number
    monthlySubsOnly: number
    activeCount: number
    unwantedCount: number
    potentialSavings: number
  }

  recurringVsOneTime: {
    recurringTotal: number
    oneTimeTotal: number
    fixedCostRatio: number
  }

  cashFlow: {
    projectedNetCashFlow: number
    safeDailySpend: number
    remainingBudget: number
  }
}

/**
 * Build an anonymized financial context for AI analysis.
 * Merchant names are kept (business names, not PII).
 * All user identifiers, account details, and transaction IDs are stripped.
 */
export function buildAnonymizedFinancialContext(
  insights: DeepInsightsResult,
  budgets: BudgetData[],
  subscriptions: SubscriptionData[]
): AnonymizedFinancialContext {
  const [y, m] = insights.currentMonth.split("-").map(Number)
  const monthName = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const priorTotal = insights.spendingVelocity.priorPeriodTotal
  const currentTotal = insights.spendingVelocity.currentTotal
  const momChangePercent = priorTotal > 0
    ? Math.round(((currentTotal - priorTotal) / priorTotal) * 100)
    : 0

  const budgetMap = new Map(budgets.map((b) => [b.category, b]))

  const categoryBreakdown = insights.categoryComparison.map((cat) => {
    const budget = budgetMap.get(cat.category)
    return {
      category: cat.category,
      currentTotal: cat.currentTotal,
      previousTotal: cat.previousTotal,
      changePercent: cat.changePercent,
      budgetLimit: budget?.monthlyLimit ?? null,
      budgetUsedPercent: budget?.percentUsed ?? null,
    }
  })

  return {
    month: monthName,
    totalSpending: insights.totalSpending,
    totalIncome: insights.totalIncome,
    savingsRate: insights.savingsRate,
    healthScore: insights.healthScore.score,
    healthGrade: insights.healthScore.grade,

    spendingVelocity: {
      dailyAvg: insights.spendingVelocity.dailyAvg,
      projectedTotal: insights.spendingVelocity.projectedTotal,
      daysRemaining: insights.spendingVelocity.daysRemaining,
      momChangePercent,
    },

    categoryBreakdown,

    topMerchants: insights.frequentMerchants.slice(0, 8).map((m) => ({
      name: m.name,
      count: m.count,
      total: m.total,
      category: m.category,
    })),

    anomalies: insights.anomalies,

    subscriptions: subscriptions
      .filter((s) => s.status === "active")
      .map((s) => ({
        name: s.merchantName,
        amount: s.amount,
        frequency: s.frequency,
        category: s.category,
        isWanted: s.isWanted,
        billType: s.billType ?? null,
      })),

    subscriptionSummary: insights.subscriptionSummary,

    recurringVsOneTime: {
      recurringTotal: insights.recurringVsOneTime.recurring,
      oneTimeTotal: insights.recurringVsOneTime.oneTime,
      fixedCostRatio: insights.recurringVsOneTime.fixedCostRatio,
    },

    cashFlow: {
      projectedNetCashFlow: insights.cashFlowForecast.projectedNetCashFlow,
      safeDailySpend: insights.cashFlowForecast.safeDailySpend,
      remainingBudget: insights.cashFlowForecast.remainingBudget,
    },
  }
}
