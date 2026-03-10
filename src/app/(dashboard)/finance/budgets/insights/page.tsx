"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  useFinanceBudgets, useBudgetSuggestions, useBudgetAI, useGenerateBudgetAI,
  useFinanceDeepInsights, useFinanceIncome,
} from "@/hooks/use-finance"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { InsightsSummaryCards } from "@/components/finance/budget-insights/insights-summary-cards"
import { InsightsIncomeBanner } from "@/components/finance/budget-insights/insights-income-banner"
import { InsightsCategoryComparison } from "@/components/finance/budget-insights/insights-category-comparison"
import { InsightsAIAnalysis } from "@/components/finance/budget-insights/insights-ai-analysis"
import { InsightsQuickActions } from "@/components/finance/budget-insights/insights-quick-actions"
import { buildBudgetComparison } from "@/lib/finance/budget-comparison"

export default function BudgetInsightsPage() {
  const { data: budgets, isLoading: loadingBudgets } = useFinanceBudgets()
  const { data: suggestions, isLoading: loadingSuggestions } = useBudgetSuggestions()
  const { data: aiData, isLoading: loadingAI } = useBudgetAI()
  const generateAI = useGenerateBudgetAI()
  const { data: deep } = useFinanceDeepInsights()
  const { data: incomeData } = useFinanceIncome()

  const isLoading = loadingBudgets || loadingSuggestions

  const comparison = useMemo(
    () => buildBudgetComparison(
      budgets ?? [],
      suggestions?.suggestions ?? [],
      deep?.topCategories ?? [],
    ),
    [budgets, suggestions, deep],
  )

  // Summary stats
  const totalDataDriven = comparison.reduce((s, c) => s + c.dataDriven, 0)
  const totalYourBudget = comparison.reduce((s, c) => s + (c.yourBudget ?? 0), 0)
  const hasBudgets = (budgets ?? []).length > 0
  const income = incomeData?.effective ?? deep?.totalIncome ?? 0

  const alignedCount = comparison.filter((c) => c.verdict === "well-aligned").length
  const totalWithBudget = comparison.filter((c) => c.yourBudget != null).length
  const optimizationScore = totalWithBudget > 0 ? Math.round((alignedCount / totalWithBudget) * 100) : 0
  const displayScore = aiData?.analysis?.overallScore ?? optimizationScore

  const maxValue = Math.max(...comparison.map((c) => Math.max(c.dataDriven, c.yourBudget ?? 0, c.currentSpent)), 1)

  const aiAvailable = !!(aiData?.available && aiData.analysis)
  const hasProvider = !!(aiData?.hasProvider || aiData?.available)
  const generatedAt = aiData?.generatedAt
    ? new Date(aiData.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null

  if (isLoading) {
    return (
      <div className="space-y-6">
        <FinancePageHeader title="Budget Intelligence" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <FinanceCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Budget Intelligence"
        subtitle="Data-driven analysis of your spending vs budgets"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance/budgets" className="flex items-center gap-1.5 px-4 py-2 bg-card border border-card-border text-foreground-muted rounded-lg text-sm font-medium hover:border-card-border-hover hover:text-foreground transition-all">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_back</span>
              Budgets
            </Link>
            {hasBudgets && (
              <Link href="/finance/budgets/workshop" className="flex items-center gap-1.5 px-4 py-2 bg-card border border-card-border text-foreground-muted rounded-lg text-sm font-medium hover:border-card-border-hover hover:text-foreground transition-all">
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>tune</span>
                Workshop
              </Link>
            )}
          </div>
        }
      />

      <InsightsSummaryCards
        totalDataDriven={totalDataDriven} totalYourBudget={totalYourBudget}
        totalWithBudget={totalWithBudget} hasBudgets={hasBudgets}
        displayScore={displayScore} monthsAnalyzed={suggestions?.monthsAnalyzed ?? 0}
      />

      <InsightsIncomeBanner income={income} totalDataDriven={totalDataDriven} totalYourBudget={totalYourBudget} hasBudgets={hasBudgets} />

      <InsightsCategoryComparison comparison={comparison} hasBudgets={hasBudgets} maxValue={maxValue} />

      <InsightsAIAnalysis
        aiAvailable={aiAvailable} aiData={aiData} hasProvider={hasProvider}
        loadingAI={loadingAI} generatePending={generateAI.isPending}
        generatedAt={generatedAt}
        onGenerate={(force) => generateAI.mutate(force ? { force: true } : {})}
      />

      <InsightsQuickActions hasBudgets={hasBudgets} />
    </div>
  )
}
