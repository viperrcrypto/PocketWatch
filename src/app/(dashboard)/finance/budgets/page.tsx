"use client"

import { useState, useMemo } from "react"
import {
  useFinanceBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget,
  useFinanceDeepInsights, useFinanceTransactions,
  useFinanceSubscriptions, useBudgetSuggestions, useGenerateBudgetAI,
  useFinanceTrends,
} from "@/hooks/use-finance"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { BudgetUntrackedSection } from "@/components/finance/budgets/budget-untracked-section"
import { BudgetHeroSummary } from "@/components/finance/budgets/budget-hero-summary"
import { BudgetPaceChart } from "@/components/finance/budgets/budget-pace-chart"
import { BudgetStatStrip } from "@/components/finance/budgets/budget-stat-strip"
import { BudgetCategoryList } from "@/components/finance/budgets/budget-category-list"
import { BudgetCreateModal } from "@/components/finance/budgets/budget-create-modal"
import { BudgetSubscriptionsImpact } from "@/components/finance/budgets/budget-subscriptions-impact"
import { BudgetInlineInsights } from "@/components/finance/budgets/budget-inline-insights"
import { computeBudgetSummary, computePaceMetrics, buildCategoryData, buildInsights } from "@/components/finance/budgets/budget-helpers"
import type { BudgetInsight } from "@/components/finance/budgets/budget-helpers"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { FadeIn } from "@/components/motion/fade-in"

export default function FinanceBudgetsPage() {
  const { data: budgets, isLoading, isError } = useFinanceBudgets()
  const { data: deep } = useFinanceDeepInsights()
  const { data: suggestions } = useBudgetSuggestions()
  const { data: subsData } = useFinanceSubscriptions()
  const { data: trendsData } = useFinanceTrends(6)

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const { data: txData } = useFinanceTransactions({ limit: 200, startDate: monthStart })

  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()
  const generateAI = useGenerateBudgetAI()

  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const summary = computeBudgetSummary(budgets)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const pace = computePaceMetrics(summary.totalSpent, summary.totalBudgeted, dayOfMonth, daysInMonth)

  const categoryData = useMemo(() => buildCategoryData(budgets, trendsData, subsData), [budgets, trendsData, subsData])
  const segments = useMemo(() => (budgets ?? []).map((b) => ({ category: b.category, spent: b.spent, monthlyLimit: b.monthlyLimit })), [budgets])

  const worstCategory = useMemo(() => {
    const sorted = [...categoryData].sort((a, b) => (b.spent - b.monthlyLimit) - (a.spent - a.monthlyLimit))
    const worst = sorted[0]
    if (!worst || worst.spent <= worst.monthlyLimit) return null
    return { category: worst.category, overAmount: worst.spent - worst.monthlyLimit }
  }, [categoryData])

  const activeSubs = useMemo(
    () => (subsData?.subscriptions ?? []).filter((s) => s.status === "active").slice(0, 8).map((s) => ({ merchantName: s.merchantName, amount: s.amount, logoUrl: s.logoUrl ?? null, category: s.category ?? null })),
    [subsData],
  )

  const insights = useMemo(() => {
    const raw = buildInsights(categoryData, summary)
    return raw.map((r): BudgetInsight => ({ ...r, action: undefined }))
  }, [categoryData, summary])

  const defaultSuggestions = suggestions?.suggestions ?? []
  const budgetedSet = useMemo(() => new Set(budgets?.map((b) => b.category) ?? []), [budgets])
  const untrackedCategories = useMemo(() => defaultSuggestions.filter((c) => !budgetedSet.has(c.category)), [defaultSuggestions, budgetedSet])

  const txByCategory = useMemo(() => {
    const map: Record<string, NonNullable<typeof txData>["transactions"]> = {}
    for (const tx of txData?.transactions ?? []) {
      const cat = tx.category ?? "Uncategorized"
      if (!map[cat]) map[cat] = []
      map[cat].push(tx)
    }
    return map
  }, [txData])

  const currentMonth = deep?.currentMonth
    ? (() => { const [y, m] = deep.currentMonth.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }) })()
    : now.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const isOverBudget = summary.percentUsed > 100
  const deletingBudget = budgets?.find((b) => b.id === deletingId)

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Budgets</h1>
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load budgets.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Budgets / {currentMonth}</h1>
          <p className={cn("text-xs font-medium mt-0.5", isOverBudget ? "text-error" : "text-success")}>
            {summary.budgetCount > 0 ? (isOverBudget ? `Over Budget · ${summary.overBudgetCount} of ${summary.budgetCount} categories` : "On Track") : ""}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
          Create Budget
        </button>
      </div>

      {isLoading ? <FinanceCardSkeleton /> : summary.budgetCount === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 24 }}>savings</span>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1.5">No budgets yet</h3>
          <p className="text-sm text-foreground-muted mb-4 max-w-sm mx-auto">Set spending limits by category to track and control your spending.</p>
          <button onClick={() => setShowModal(true)} className="px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">Create Your First Budget</button>
        </div>
      ) : (
        <>
          <FadeIn>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="md:w-[280px] flex-shrink-0">
                <BudgetHeroSummary totalBudgeted={summary.totalBudgeted} totalSpent={summary.totalSpent} remaining={summary.remaining} percentUsed={summary.percentUsed} daysRemaining={pace.daysRemaining} safeDailySpend={pace.safeDailySpend} isOnTrack={pace.isOnTrack} budgetCount={summary.budgetCount} overBudgetCount={summary.overBudgetCount} segments={segments} />
              </div>
              <BudgetPaceChart dailySpending={deep?.dailySpending ?? []} totalBudgeted={summary.totalBudgeted} projectedTotal={pace.projectedTotal} daysInMonth={daysInMonth} dayOfMonth={dayOfMonth} />
            </div>
          </FadeIn>

          <BudgetStatStrip dailyAvg={pace.dailyAvg} projectedTotal={pace.projectedTotal} totalBudgeted={summary.totalBudgeted} worstCategory={worstCategory} onTrackCount={summary.budgetCount - summary.overBudgetCount} totalCount={summary.budgetCount} />

          <FadeIn delay={0.1}>
            <BudgetCategoryList categories={categoryData} onEditBudget={(id, limit) => updateBudget.mutate({ budgetId: id, monthlyLimit: limit })} onDeleteBudget={(id) => setDeletingId(id)} onAddBudget={() => setShowModal(true)} />
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BudgetSubscriptionsImpact subscriptions={activeSubs} monthlyTotal={subsData?.monthlyTotal ?? 0} totalBudgeted={summary.totalBudgeted} />
              <BudgetInlineInsights insights={insights} isGenerating={generateAI.isPending} onGenerate={() => generateAI.mutate(undefined, { onSuccess: () => toast.success("AI analysis generated"), onError: (e) => toast.error(e.message) })} />
            </div>
          </FadeIn>

          {untrackedCategories.length > 0 && (
            <FadeIn delay={0.2}>
              <BudgetUntrackedSection untrackedCategories={untrackedCategories} txByCategory={txByCategory} onAddBudget={(cat, limit) => createBudget.mutate({ category: cat, monthlyLimit: limit })} onBudgetAll={() => { for (const c of untrackedCategories) createBudget.mutate({ category: c.category, monthlyLimit: c.suggested }) }} />
            </FadeIn>
          )}
        </>
      )}

      <BudgetCreateModal isOpen={showModal} onClose={() => setShowModal(false)} existingBudgets={budgets} suggestions={defaultSuggestions} trendsData={trendsData} onCreate={(category, monthlyLimit) => { createBudget.mutate({ category, monthlyLimit }, { onSuccess: () => setShowModal(false) }) }} isPending={createBudget.isPending} />
      <ConfirmDialog open={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={() => { if (deletingId) deleteBudget.mutate(deletingId, { onSuccess: () => setDeletingId(null) }) }} title={`Delete ${deletingBudget?.category ?? ""} budget?`} description="This will permanently delete this budget." confirmLabel="Delete" variant="danger" isLoading={deleteBudget.isPending} />
    </div>
  )
}
