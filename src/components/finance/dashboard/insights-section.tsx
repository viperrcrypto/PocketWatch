"use client"

import { formatCurrency } from "@/lib/utils"
import { FinanceChartWrapper } from "@/components/finance/finance-chart-wrapper"
import { CategoryTrendChart } from "@/components/finance/category-trend-chart"
import { InsightCard } from "@/components/finance/insight-card"
import { buildSmartInsights } from "@/components/finance/insights/insights-smart-builder"
import { InsightsHeroStats } from "@/components/finance/insights/insights-hero-stats"
import { InsightsHealthBreakdown } from "@/components/finance/insights/insights-health-breakdown"
import { InsightsForecastStreaks } from "@/components/finance/insights/insights-forecast-streaks"
import { InsightsRecurringAllocation } from "@/components/finance/insights/insights-recurring-allocation"
import {
  InsightsCategoryComparison,
  InsightsIncomeSources,
  InsightsBudgetHealth,
  InsightsTopCategories,
  InsightsMerchantsPurchases,
  InsightsDayOfWeek,
  InsightsAnomalies,
} from "@/components/finance/insights/insights-category-sections"
import { formatMonthLabel } from "@/components/finance/insights/insights-helpers"

interface InsightsSectionProps {
  deep: any
  trends: any
  recurringData: any
  holdingsData: any
}

export function InsightsSection({ deep, trends, recurringData, holdingsData }: InsightsSectionProps) {
  const spending = deep?.totalSpending ?? 0
  const income = deep?.totalIncome ?? 0
  const savingsRate = deep?.savingsRate ?? 0
  const velocity = deep?.spendingVelocity
  const prevSpending = velocity?.priorPeriodTotal ?? 0
  const spendingChange = prevSpending > 0 ? ((spending - prevSpending) / prevSpending * 100) : 0
  const health = deep?.healthScore
  const forecast = deep?.cashFlowForecast
  const streaks = deep?.spendingStreaks

  const donutData = deep?.topCategories?.map((c: any) => ({ category: c.category, amount: c.total })) ?? []
  const trendChartData = trends?.months?.map((m: any) => ({ month: m.month, ...m.categories })) ?? []
  const trendCategories = trends?.months?.length ? Object.keys(trends.months[0].categories) : []

  const overBudget = deep?.budgetHealth?.filter((b: any) => b.percentUsed > 100) ?? []
  const housingSpend = deep?.topCategories?.find((c: any) => c.category === "Housing")?.total ?? 0

  const smartInsights = buildSmartInsights({
    velocity, prevSpending, forecast, savingsRate, streaks,
    overBudget, subscriptionSummary: deep?.subscriptionSummary,
    dayOfWeekPatterns: deep?.dayOfWeekPatterns, spending, housingSpend,
  })

  return (
    <div className="space-y-6">
      {deep?.currentMonth && (
        <p className="text-[10px] text-foreground-muted">Period: {formatMonthLabel(deep.currentMonth)}</p>
      )}

      <InsightsHeroStats
        isLoading={false} health={health} spending={spending} income={income}
        savingsRate={savingsRate} velocity={velocity} prevSpending={prevSpending} spendingChange={spendingChange}
      />

      <InsightsHealthBreakdown health={health} />
      <InsightsForecastStreaks forecast={forecast} streaks={streaks} />
      <InsightsRecurringAllocation deep={deep} donutData={donutData} recurringData={recurringData} holdingsData={holdingsData} />

      {/* Category Trends */}
      <FinanceChartWrapper title="Category Trends (6 Months)">
        {trendChartData.length > 0 ? (
          <CategoryTrendChart data={trendChartData} categories={trendCategories} />
        ) : (
          <p className="text-sm text-foreground-muted text-center py-16">Not enough data</p>
        )}
      </FinanceChartWrapper>

      {/* Smart Insight Cards */}
      {smartInsights.length > 0 && (
        <div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-3 block">
            Smart Insights
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {smartInsights.map((insight, i) => (
              <InsightCard key={i} {...insight} />
            ))}
          </div>
        </div>
      )}

      <InsightsCategoryComparison data={deep?.categoryComparison} />
      <InsightsIncomeSources sources={deep?.incomeSources} />
      <InsightsBudgetHealth budgetHealth={deep?.budgetHealth} />
      <InsightsTopCategories categories={deep?.topCategories} />
      <InsightsMerchantsPurchases deep={deep} />
      <InsightsDayOfWeek patterns={deep?.dayOfWeekPatterns} />
      <InsightsAnomalies anomalies={deep?.anomalies} />
    </div>
  )
}
