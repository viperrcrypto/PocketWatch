/**
 * Insights, trends, spending analysis, net worth, and bills hooks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"

// ─── Types ──────────────────────────────────────────────────────

interface InsightsData {
  totalSpending: number
  totalIncome: number
  lastMonthSpending: number
  lastMonthIncome: number
  savingsRate: number
  categoryComparison: Array<{
    category: string
    thisMonth: number
    lastMonth: number
    changePercent: number
  }>
  topMerchants: Array<{
    merchantName: string
    total: number
    count: number
  }>
}

interface NetWorthEntry {
  date: string
  fiatAssets: number
  fiatDebt: number
  fiatNetWorth: number
  totalNetWorth: number
  breakdown: Record<string, number>
}

interface TrendMonth {
  month: string
  income: number
  spending: number
  net: number
  savingsRate: number
  categories: Record<string, number>
}

interface DeepInsightsData {
  currentMonth: string
  previousMonth: string | null
  totalSpending: number
  totalIncome: number
  savingsRate: number
  healthScore: {
    score: number
    grade: string
    breakdown: Array<{ factor: string; score: number; weight: number }>
  }
  spendingVelocity: {
    dailyAvg: number
    projectedTotal: number
    currentTotal: number
    priorPeriodTotal: number
    daysElapsed: number
    daysRemaining: number
  }
  cashFlowForecast: {
    projectedIncome: number
    projectedSpending: number
    projectedNetCashFlow: number
    remainingBudget: number
    safeDailySpend: number
    daysRemaining: number
  }
  spendingStreaks: {
    noSpendDays: number
    totalDays: number
    longestNoSpendStreak: number
    noSpendRate: number
  }
  recurringVsOneTime: {
    recurring: number
    oneTime: number
    fixedCostRatio: number
  }
  dayOfWeekPatterns: Array<{ day: string; total: number }>
  topCategories: Array<{
    category: string
    total: number
    topMerchants: Array<{ name: string; amount: number }>
    subcategories: Array<{ name: string; amount: number }>
  }>
  categoryComparison: Array<{
    category: string
    currentTotal: number
    previousTotal: number
    changePercent: number | null
    direction: string
  }>
  incomeSources: Array<{ name: string; amount: number }>
  anomalies: Array<{
    category: string
    currentAmount: number
    previousAmount: number
    multiplier: number
  }>
  budgetHealth: Array<{
    category: string
    spent: number
    limit: number
    percentUsed: number
    remaining: number
    daysRemaining: number
    projectedOverage: number
  }>
  subscriptionSummary: {
    monthlyTotal: number
    activeCount: number
    unwantedCount: number
    potentialSavings: number
  }
  frequentMerchants: Array<{
    name: string
    count: number
    total: number
    category: string | null
    logoUrl: string | null
  }>
  largestPurchases: Array<{
    id: string
    name: string
    amount: number
    date: string
    category: string | null
    logoUrl: string | null
  }>
  uncategorizedCount: number
  uncategorizedPreview: Array<{ id: string; name: string; amount: number; date: string; logoUrl: string | null }>
}

interface BillItem {
  id: string
  merchantName: string
  amount: number
  frequency: string
  nextDueDate: string
  daysUntil: number
  category: string | null
  billType: string | null
}

interface BillsData {
  bills: BillItem[]
  monthTotal: number
  monthlyBurnRate: number
  groups: Record<string, BillItem[]>
  totalDueThisWeek: number
  countDueThisWeek: number
  targetMonth: string
}

export interface AIInsightsData {
  available: boolean
  hasProvider?: boolean
  providerLabel?: string | null
  insights?: {
    keyInsight: { title: string; description: string }
    savingsOpportunities: Array<{ area: string; estimatedSavings: number; description: string }>
    budgetRecommendations: Array<{ category: string; suggestedLimit: number; reason: string }>
    subscriptionReview: Array<{ name: string; verdict: "keep" | "review" | "cancel"; reason: string }>
    anomalyComments: Array<{ category: string; comment: string }>
    actionItems: Array<{ action: string; priority: "high" | "medium" | "low" }>
  }
  provider?: string
  providerLabel2?: string
  generatedAt?: string
}

// ─── Insights Hooks ──────────────────────────────────────────────

export function useFinanceInsights() {
  return useQuery({
    queryKey: financeKeys.insights(),
    queryFn: () => financeFetch<InsightsData>("/insights"),
  })
}

export function useFinanceDeepInsights() {
  return useQuery({
    queryKey: financeKeys.deepInsights(),
    queryFn: () => financeFetch<DeepInsightsData>("/insights/deep"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ─── Net Worth Hook ─────────────────────────────────────────────

export function useNetWorth(range = "1y", includeInvestments = true) {
  return useQuery({
    queryKey: financeKeys.netWorth(range, includeInvestments),
    queryFn: () =>
      financeFetch<NetWorthEntry[]>(
        `/snapshots?range=${range}&includeCrypto=false&includeInvestments=${includeInvestments}`
      ),
  })
}

// ─── Trends Hook ─────────────────────────────────────────────────

export function useFinanceTrends(months = 6) {
  return useQuery({
    queryKey: financeKeys.trends(months),
    queryFn: () =>
      financeFetch<{ months: TrendMonth[] }>(`/trends?months=${months}`),
  })
}

// ─── Bills / Upcoming Charges Hook ──────────────────────────────

export function useUpcomingBills(month?: string) {
  const params = month ? `?month=${month}` : ""
  return useQuery({
    queryKey: [...financeKeys.bills(), month ?? "current"],
    queryFn: () => financeFetch<BillsData>(`/bills${params}`),
  })
}

// ─── AI Insights Hooks ──────────────────────────────────────────

export function useAIInsights() {
  return useQuery({
    queryKey: financeKeys.aiInsights(),
    queryFn: () => financeFetch<AIInsightsData>("/insights/ai"),
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}

export function useGenerateAIInsights() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opts?: { force?: boolean }) =>
      financeFetch<AIInsightsData>(`/insights/ai${opts?.force ? "?force=true" : ""}`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.aiInsights() }),
  })
}

// ─── Monthly Spending Hook ─────────────────────────────────────

interface SpendingByMonthData {
  month: string | null
  categories: Array<{ category: string; total: number }>
  totalSpending: number
  availableMonths: string[]
}

export function useSpendingByMonth(month?: string) {
  return useQuery({
    queryKey: financeKeys.spendingByMonth(month),
    queryFn: () =>
      financeFetch<SpendingByMonthData>(
        `/spending/by-month${month ? `?month=${month}` : ""}`
      ),
  })
}
