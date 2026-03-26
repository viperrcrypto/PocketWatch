"use client"

import { useState, useMemo } from "react"
import {
  useFinanceBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget,
  useFinanceDeepInsights, useFinanceTransactions,
  useUpdateTransactionCategory,
  useBudgetSuggestions,
} from "@/hooks/use-finance"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { BudgetCategoryBreakdown } from "@/components/finance/budgets/budget-category-breakdown"
import { BudgetAddModal } from "@/components/finance/budgets/budget-add-modal"
import { BudgetUntrackedSection } from "@/components/finance/budgets/budget-untracked-section"
import { BudgetRingChart } from "@/components/finance/budgets/budget-ring-chart"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { BudgetProgressBar } from "@/components/finance/budget-progress-bar"
import { getCategoryMeta, getBudgetableCategories } from "@/lib/finance/categories"
import { formatCurrency, cn } from "@/lib/utils"

export default function FinanceBudgetsPage() {
  const { data: budgets, isLoading, isError } = useFinanceBudgets()
  const { data: deep } = useFinanceDeepInsights()
  const { data: txData } = useFinanceTransactions({ limit: 100 })
  const { data: suggestions } = useBudgetSuggestions()
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()
  const updateCategory = useUpdateTransactionCategory()

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

  const sortedBudgets = useMemo(
    () => [...(budgets ?? [])].sort((a, b) => b.percentUsed - a.percentUsed),
    [budgets]
  )

  const defaultCategories = suggestions?.suggestions ?? []
  const budgetedCategories = useMemo(() => new Set(budgets?.map((b) => b.category) ?? []), [budgets])
  const untrackedCategories = useMemo(
    () => defaultCategories.filter((c) => !budgetedCategories.has(c.category)),
    [defaultCategories, budgetedCategories]
  )

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
    : new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0

  const deletingBudget = budgets?.find((b) => b.id === deletingId)

  const handleCreate = () => {
    if (!newCategory) { setFormError("Select a category"); return }
    const amt = parseFloat(newAmount)
    if (!amt || amt <= 0) { setFormError("Enter a valid amount"); return }
    setFormError("")
    createBudget.mutate(
      { category: newCategory, monthlyLimit: amt },
      { onSuccess: () => { setNewCategory(""); setNewAmount(""); setShowModal(false) } }
    )
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Budgets</h1>
          <p className="text-sm text-foreground-muted mt-0.5">{currentMonth}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
          Add Budget
        </button>
      </div>

      {/* Hero Section: Ring Chart + Top Categories */}
      {isLoading ? (
        <FinanceCardSkeleton />
      ) : budgetCount > 0 ? (
        <div className="bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Ring Chart */}
            <div className="flex-shrink-0">
              <BudgetRingChart spent={totalSpent} limit={totalBudgeted} />
            </div>

            {/* Top Categories Mini Bars */}
            <div className="flex-1 w-full space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                Highest Usage Categories
              </p>
              {sortedBudgets.slice(0, 5).map((b) => {
                const meta = getCategoryMeta(b.category)
                const isOver = b.percentUsed > 100
                const isWarn = b.percentUsed >= 80 && !isOver
                return (
                  <div key={b.id} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.hex }} />
                    <span className="text-xs font-medium text-foreground w-28 truncate">{b.category}</span>
                    <div className="flex-1">
                      <BudgetProgressBar spent={b.spent} limit={b.monthlyLimit} />
                    </div>
                    <span className="text-[10px] tabular-nums text-foreground-muted flex-shrink-0 w-24 text-right">
                      <span className="font-semibold text-foreground">{formatCurrency(b.spent, "USD", 0)}</span>
                      <span className="text-foreground-muted"> / {formatCurrency(b.monthlyLimit, "USD", 0)}</span>
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold tabular-nums w-10 text-right flex-shrink-0",
                      isOver ? "text-error" : isWarn ? "text-amber-500" : "text-success"
                    )}>
                      {Math.round(b.percentUsed)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Stat Cards */}
      {budgetCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted mb-2">Monthly Spend</p>
            <p className={cn("text-2xl font-bold tabular-nums tracking-tight", percentUsed > 100 ? "text-error" : "text-foreground")}>
              {formatCurrency(totalSpent, "USD", 0)}
            </p>
            <p className="text-xs text-foreground-muted mt-1">
              {remaining >= 0 ? `${formatCurrency(remaining, "USD", 0)} remaining` : `${formatCurrency(Math.abs(remaining), "USD", 0)} over budget`}
            </p>
          </div>
          <div className="bg-card rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted mb-2">Daily Average</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {formatCurrency(dailyAvg, "USD", 0)}
            </p>
            <p className="text-xs text-foreground-muted mt-1">{dayOfMonth} days tracked</p>
          </div>
          <div className="bg-card rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted mb-2">Categories Over</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {overBudgetCount} <span className="text-sm font-medium text-foreground-muted">of {budgetCount}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              {sortedBudgets.map((b) => (
                <div
                  key={b.id}
                  className={cn("h-2 flex-1 rounded-full", b.percentUsed > 100 ? "bg-error" : b.percentUsed > 80 ? "bg-amber-500" : "bg-success")}
                  title={`${b.category}: ${Math.round(b.percentUsed)}%`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && budgetCount === 0 && (
        <div className="bg-card rounded-2xl p-12 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 24 }}>savings</span>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1.5">No budgets yet</h3>
          <p className="text-sm text-foreground-muted mb-4 max-w-sm mx-auto">
            Set spending limits by category to track your budget and control your spending.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Create Your First Budget
          </button>
        </div>
      )}

      {/* Detailed Budget List */}
      {budgetCount > 0 && (
        <BudgetCategoryBreakdown
          budgets={budgets!}
          txByCategory={txByCategory}
          onEditBudget={(id, limit) => updateBudget.mutate({ budgetId: id, monthlyLimit: limit })}
          onDeleteBudget={(id) => setDeletingId(id)}
          onCategoryChange={(txId, cat, rule) => updateCategory.mutate({ transactionId: txId, category: cat, createRule: rule })}
          onAddBudget={() => setShowModal(true)}
        />
      )}

      {/* Untracked Spending */}
      {budgetCount > 0 && untrackedCategories.length > 0 && (
        <BudgetUntrackedSection
          untrackedCategories={untrackedCategories}
          txByCategory={txByCategory}
          onAddBudget={(cat, limit) => createBudget.mutate({ category: cat, monthlyLimit: limit })}
          onBudgetAll={() => {
            for (const cat of untrackedCategories) {
              createBudget.mutate({ category: cat.category, monthlyLimit: cat.suggested })
            }
          }}
        />
      )}

      {/* Modals */}
      {showModal && (
        <BudgetAddModal
          budgetableCategories={getBudgetableCategories()}
          existingBudgets={budgets}
          newCategory={newCategory}
          newAmount={newAmount}
          formError={formError}
          isPending={createBudget.isPending}
          onCategoryChange={setNewCategory}
          onAmountChange={setNewAmount}
          onCreate={handleCreate}
          onClose={() => setShowModal(false)}
        />
      )}
      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => { if (deletingId) deleteBudget.mutate(deletingId, { onSuccess: () => setDeletingId(null) }) }}
        title={`Delete ${deletingBudget?.category ?? ""} budget?`}
        description="This will permanently delete this budget. Your transaction data is not affected."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteBudget.isPending}
      />
    </div>
  )
}
