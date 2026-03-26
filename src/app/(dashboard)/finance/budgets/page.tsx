"use client"

import { useState, useMemo } from "react"
import {
  useFinanceBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget,
  useFinanceDeepInsights, useFinanceTransactions,
  useUpdateTransactionCategory, useFinanceSubscriptions,
  useBudgetSuggestions, useGenerateBudgetAI,
} from "@/hooks/use-finance"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { BudgetCategoryBreakdown } from "@/components/finance/budgets/budget-category-breakdown"
import { BudgetAddModal } from "@/components/finance/budgets/budget-add-modal"
import { BudgetUntrackedSection } from "@/components/finance/budgets/budget-untracked-section"
import { BudgetRingChart } from "@/components/finance/budgets/budget-ring-chart"
import { BudgetSpendingChart } from "@/components/finance/budgets/budget-spending-chart"
import { BudgetComparisonTable } from "@/components/finance/budgets/budget-comparison-table"
import { BudgetSavingsCard } from "@/components/finance/budgets/budget-savings-card"
import { BudgetSubscriptionsBurn } from "@/components/finance/budgets/budget-subscriptions-burn"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { getBudgetableCategories } from "@/lib/finance/categories"
import { formatCurrency, cn } from "@/lib/utils"
import { toast } from "sonner"

export default function FinanceBudgetsPage() {
  const { data: budgets, isLoading, isError } = useFinanceBudgets()
  const { data: deep } = useFinanceDeepInsights()
  const { data: txData } = useFinanceTransactions({ limit: 200 })
  const { data: suggestions } = useBudgetSuggestions()
  const { data: subsData } = useFinanceSubscriptions()
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()
  const updateCategory = useUpdateTransactionCategory()
  const generateAI = useGenerateBudgetAI()

  const [showModal, setShowModal] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState("")

  const totalBudgeted = budgets?.reduce((s, b) => s + b.monthlyLimit, 0) ?? 0
  const totalSpent = budgets?.reduce((s, b) => s + b.spent, 0) ?? 0
  const remaining = totalBudgeted - totalSpent
  const percentUsed = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0
  const budgetCount = budgets?.length ?? 0
  const overBudgetCount = budgets?.filter((b) => b.percentUsed > 100).length ?? 0
  const isOverBudget = percentUsed > 100

  const sortedBudgets = useMemo(() => [...(budgets ?? [])].sort((a, b) => b.percentUsed - a.percentUsed), [budgets])

  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0
  const projectedTotal = Math.round(dailyAvg * daysInMonth)

  // Daily spending for chart
  const dailySpending = useMemo(() => {
    const map = new Map<string, number>()
    for (const tx of txData?.transactions ?? []) {
      if (tx.amount <= 0 || ["Transfer", "Income", "Investment"].includes(tx.category ?? "")) continue
      const day = tx.date.includes("T") ? tx.date.slice(0, 10) : tx.date
      map.set(day, (map.get(day) ?? 0) + tx.amount)
    }
    const days = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    return days.map(([date, amount]) => ({ date, amount }))
  }, [txData])

  // Subscriptions for burn rate
  const activeSubs = useMemo(
    () => (subsData?.subscriptions ?? []).filter((s: { status: string }) => s.status === "active"),
    [subsData]
  )

  // Savings tips (computed from data)
  const savingsTips = useMemo(() => {
    const tips: Array<{ type: "cancel" | "reduce" | "adjust"; title: string; amount: number; frequency: string; actionLabel: string }> = []
    // Unwanted subscriptions
    for (const sub of activeSubs) {
      if (!(sub as { isWanted?: boolean }).isWanted) {
        tips.push({ type: "cancel", title: `Cancel ${(sub as { merchantName: string }).merchantName}`, amount: (sub as { amount: number }).amount, frequency: "monthly", actionLabel: "Cancel" })
      }
    }
    // Categories way over budget
    for (const b of sortedBudgets) {
      if (b.percentUsed > 150 && tips.length < 4) {
        const over = b.spent - b.monthlyLimit
        tips.push({ type: "adjust", title: `${b.category} is ${Math.round(b.percentUsed)}% of budget — increase to ${formatCurrency(Math.round(b.spent * 1.1), "USD", 0)}?`, amount: over, frequency: "monthly", actionLabel: "Adjust" })
      }
    }
    return tips.slice(0, 4)
  }, [activeSubs, sortedBudgets])

  const defaultCategories = suggestions?.suggestions ?? []
  const budgetedCategories = useMemo(() => new Set(budgets?.map((b) => b.category) ?? []), [budgets])
  const untrackedCategories = useMemo(() => defaultCategories.filter((c) => !budgetedCategories.has(c.category)), [defaultCategories, budgetedCategories])

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

  const worstCategory = sortedBudgets[0]
  const worstOver = worstCategory ? worstCategory.spent - worstCategory.monthlyLimit : 0
  const underBudget = sortedBudgets.filter((b) => b.percentUsed < 100)
  const deletingBudget = budgets?.find((b) => b.id === deletingId)

  const handleCreate = () => {
    if (!newCategory) { setFormError("Select a category"); return }
    const amt = parseFloat(newAmount)
    if (!amt || amt <= 0) { setFormError("Enter a valid amount"); return }
    setFormError("")
    createBudget.mutate({ category: newCategory, monthlyLimit: amt }, { onSuccess: () => { setNewCategory(""); setNewAmount(""); setShowModal(false) } })
  }

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
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Budgets / {currentMonth}</h1>
          <p className={cn("text-xs font-medium mt-0.5", isOverBudget ? "text-error" : "text-success")}>
            {budgetCount > 0 ? (isOverBudget ? `Over Budget · ${overBudgetCount} of ${budgetCount} categories` : "On Track") : ""}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
          Add Budget
        </button>
      </div>

      {isLoading ? <FinanceCardSkeleton /> : budgetCount === 0 ? (
        /* ── Empty State ── */
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
          {/* ── 1. Hero: Ring Chart + Spending Trend ── */}
          <div className="bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0">
                <BudgetRingChart spent={totalSpent} limit={totalBudgeted} size={200} strokeWidth={16} />
              </div>
              <div className="flex-1 w-full">
                <BudgetSpendingChart dailySpending={dailySpending} budgetLimit={totalBudgeted} projectedTotal={projectedTotal} />
              </div>
            </div>
          </div>

          {/* ── 2. Insight Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InsightCard icon="speed" iconColor="text-primary" label="Pace Check">
              You&apos;re spending <b className="tabular-nums">{formatCurrency(dailyAvg, "USD", 0)}/day</b>.
              {projectedTotal > totalBudgeted ? (
                <> Projected <b className="tabular-nums">{formatCurrency(projectedTotal, "USD", 0)}</b> — <span className="text-error font-semibold">{formatCurrency(projectedTotal - totalBudgeted, "USD", 0)} over.</span></>
              ) : (
                <> Projected <b className="tabular-nums">{formatCurrency(projectedTotal, "USD", 0)}</b> — <span className="text-success font-semibold">{formatCurrency(totalBudgeted - projectedTotal, "USD", 0)} under.</span></>
              )}
            </InsightCard>
            <InsightCard icon="warning" iconColor="text-error" label="Biggest Overspend">
              {worstCategory && worstOver > 0 ? (
                <><b>{worstCategory.category}</b> is <span className="text-error font-semibold tabular-nums">{formatCurrency(worstOver, "USD", 0)} over</span> ({Math.round(worstCategory.percentUsed)}%).
                {daysInMonth - dayOfMonth > 0 && <span className="text-foreground-muted"> Reduce {formatCurrency(worstOver / Math.max(1, daysInMonth - dayOfMonth) * 7, "USD", 0)}/week.</span>}</>
              ) : <span className="text-success font-medium">All categories within budget!</span>}
            </InsightCard>
            <InsightCard icon="check_circle" iconColor="text-success" label="On Track">
              {underBudget.length > 0 ? (
                <><span className="text-success font-semibold">{underBudget.length} {underBudget.length === 1 ? "category" : "categories"}</span> under budget:
                {" "}{underBudget.slice(0, 2).map((b) => `${b.category} (${formatCurrency(b.monthlyLimit - b.spent, "USD", 0)} left)`).join(" and ")}.</>
              ) : <span className="text-error font-medium">All categories over budget.</span>}
            </InsightCard>
          </div>

          {/* ── 3. Budget vs Actual ── */}
          <BudgetComparisonTable
            budgets={budgets!.map((b) => ({ category: b.category, budget: b.monthlyLimit, actual: b.spent }))}
            suggestions={defaultCategories}
            onAISuggest={() => generateAI.mutate(undefined, { onSuccess: () => toast.success("AI budget suggestions generated"), onError: (e) => toast.error(e.message) })}
          />

          {/* ── 4. Category Breakdown ── */}
          <BudgetCategoryBreakdown
            budgets={budgets!}
            txByCategory={txByCategory}
            onEditBudget={(id, limit) => updateBudget.mutate({ budgetId: id, monthlyLimit: limit })}
            onDeleteBudget={(id) => setDeletingId(id)}
            onCategoryChange={(txId, cat, rule) => updateCategory.mutate({ transactionId: txId, category: cat, createRule: rule })}
            onAddBudget={() => setShowModal(true)}
          />

          {/* ── 5. Savings + Subscriptions (side by side) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BudgetSavingsCard tips={savingsTips} />
            <BudgetSubscriptionsBurn
              subscriptions={activeSubs.slice(0, 8).map((s: { merchantName: string; amount: number; logoUrl?: string | null }) => ({ merchantName: s.merchantName, amount: s.amount, logoUrl: s.logoUrl }))}
              monthlyTotal={subsData?.monthlyTotal ?? 0}
            />
          </div>

          {/* ── 6. Untracked ── */}
          {untrackedCategories.length > 0 && (
            <BudgetUntrackedSection
              untrackedCategories={untrackedCategories}
              txByCategory={txByCategory}
              onAddBudget={(cat, limit) => createBudget.mutate({ category: cat, monthlyLimit: limit })}
              onBudgetAll={() => { for (const c of untrackedCategories) createBudget.mutate({ category: c.category, monthlyLimit: c.suggested }) }}
            />
          )}
        </>
      )}

      {/* Modals */}
      {showModal && (
        <BudgetAddModal budgetableCategories={getBudgetableCategories()} existingBudgets={budgets} newCategory={newCategory} newAmount={newAmount} formError={formError} isPending={createBudget.isPending} onCategoryChange={setNewCategory} onAmountChange={setNewAmount} onCreate={handleCreate} onClose={() => setShowModal(false)} />
      )}
      <ConfirmDialog open={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={() => { if (deletingId) deleteBudget.mutate(deletingId, { onSuccess: () => setDeletingId(null) }) }} title={`Delete ${deletingBudget?.category ?? ""} budget?`} description="This will permanently delete this budget." confirmLabel="Delete" variant="danger" isLoading={deleteBudget.isPending} />
    </div>
  )
}

function InsightCard({ icon, iconColor, label, children }: { icon: string; iconColor: string; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("material-symbols-rounded", iconColor)} style={{ fontSize: 16 }}>{icon}</span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
      </div>
      <p className="text-xs text-foreground leading-relaxed">{children}</p>
    </div>
  )
}
