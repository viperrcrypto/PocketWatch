"use client"

import { useFinanceDeepInsights, useFinanceTrends, useRecurringStreams, useInvestmentHoldings } from "@/hooks/use-finance"
import { formatCurrency } from "@/lib/utils"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { FinanceChartWrapper } from "@/components/finance/finance-chart-wrapper"
import { CategoryTrendChart } from "@/components/finance/category-trend-chart"
import { InsightCard } from "@/components/finance/insight-card"

import { formatMonthLabel } from "@/components/finance/insights/insights-helpers"
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
import Link from "next/link"

export default function FinanceInsightsPage() {
  const { data: deep, isLoading, isError } = useFinanceDeepInsights()
  const { data: trends } = useFinanceTrends(6)
  const { data: recurringData } = useRecurringStreams()
  const { data: holdingsData } = useInvestmentHoldings()

  if (!isLoading && (!deep || "empty" in deep)) {
    return (
      <div className="space-y-6">
        <FinancePageHeader title="Insights" />
        <FinanceEmpty
          icon="insights"
          title="No spending data yet"
          description="Connect accounts and sync transactions to see spending insights."
          linkTo={{ label: "Connect accounts", href: "/finance/accounts" }}
        />
      </div>
    )
  }

  const spending = deep?.totalSpending ?? 0
  const income = deep?.totalIncome ?? 0
  const savingsRate = deep?.savingsRate ?? 0
  const velocity = deep?.spendingVelocity
  const prevSpending = velocity?.priorPeriodTotal ?? 0
  const spendingChange = prevSpending > 0 ? ((spending - prevSpending) / prevSpending * 100) : 0
  const health = deep?.healthScore
  const forecast = deep?.cashFlowForecast
  const streaks = deep?.spendingStreaks

  const donutData = deep?.topCategories?.map((c) => ({ category: c.category, amount: c.total })) ?? []

  const trendChartData = trends?.months?.map((m) => ({ month: m.month, ...m.categories })) ?? []
  const trendCategories = trends?.months?.length ? Object.keys(trends.months[0].categories) : []

  const overBudget = deep?.budgetHealth?.filter((b) => b.percentUsed > 100) ?? []
  const housingSpend = deep?.topCategories?.find((c) => c.category === "Housing")?.total ?? 0

  const smartInsights = buildSmartInsights({
    velocity, prevSpending, forecast, savingsRate, streaks,
    overBudget, subscriptionSummary: deep?.subscriptionSummary,
    dayOfWeekPatterns: deep?.dayOfWeekPatterns, spending, housingSpend,
  })

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Insights"
        subtitle={deep?.currentMonth ? `Period: ${formatMonthLabel(deep.currentMonth)}` : undefined}
      />

      <InsightsHeroStats
        isLoading={isLoading} health={health} spending={spending} income={income}
        savingsRate={savingsRate} velocity={velocity} prevSpending={prevSpending} spendingChange={spendingChange}
      />

      {isError && (
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load insights.</p>
        </div>
      )}

      <InsightsHealthBreakdown health={health} />

      {/* Uncategorized Alert */}
      {deep && deep.uncategorizedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center">
              <span className="material-symbols-rounded text-amber-600 dark:text-amber-500" style={{ fontSize: 20 }}>label_off</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {deep.uncategorizedCount} transaction{deep.uncategorizedCount > 1 ? "s" : ""} need categorization
              </p>
              <p className="text-xs text-foreground-muted">Categorize them for more accurate insights</p>
            </div>
          </div>
          <Link
            href="/finance/transactions?category=Uncategorized"
            className="px-3 py-1.5 text-xs font-medium text-amber-500 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors"
          >
            Review
          </Link>
        </div>
      )}

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
