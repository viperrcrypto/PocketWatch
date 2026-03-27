/**
 * Shared types for all budget components.
 */

export interface BudgetWithSpending {
  id: string
  userId: string
  category: string
  monthlyLimit: number
  rollover: boolean
  isActive: boolean
  spent: number
  remaining: number
  percentUsed: number
}

export interface BudgetCategoryData extends BudgetWithSpending {
  /** 6-month average spending for this category (null if no data) */
  sixMonthAvg: number | null
  /** Last 6 months of spending values for sparkline rendering */
  trendData: number[]
  /** Last month's spending in this category */
  lastMonth: number | null
  /** Recurring subscriptions that fall under this category */
  subscriptions: SubImpactItem[]
}

export interface SubImpactItem {
  merchantName: string
  amount: number
  logoUrl: string | null
}

export interface DailySpendingPoint {
  date: string
  amount: number
}

export interface PaceChartPoint {
  day: number
  ideal: number
  actual: number | null
  projected: number | null
}

export interface BudgetSummary {
  totalBudgeted: number
  totalSpent: number
  remaining: number
  percentUsed: number
  budgetCount: number
  overBudgetCount: number
}

export interface PaceMetrics {
  dailyAvg: number
  projectedTotal: number
  safeDailySpend: number
  isOnTrack: boolean
  daysRemaining: number
  daysInMonth: number
  dayOfMonth: number
}

export interface BudgetSegment {
  category: string
  spent: number
  monthlyLimit: number
}
