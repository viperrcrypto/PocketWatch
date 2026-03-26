"use client"

import { useState, useMemo } from "react"
import {
  useFinanceBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget,
  useFinanceDeepInsights, useFinanceTransactions,
  useUpdateTransactionCategory,
  useBudgetSuggestions, useSpendingByMonth,
} from "@/hooks/use-finance"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { BudgetCategoryBreakdown } from "@/components/finance/budgets/budget-category-breakdown"
import { BudgetAddModal } from "@/components/finance/budgets/budget-add-modal"
import { BudgetUntrackedSection } from "@/components/finance/budgets/budget-untracked-section"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { getBudgetableCategories } from "@/lib/finance/categories"
import { formatCurrency, cn } from "@/lib/utils"

export default function FinanceBudgetsPage() {
  const { data: budgets, isLoading, isError } = useFinanceBudgets()
  const { data: deep } = useFinanceDeepInsights()
  const { data: txData } = useFinanceTransactions({ limit: 100 })
  const { data: suggestions } = useBudgetSuggestions()
  const { data: monthlySpending } = useSpendingByMonth()
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-card-border rounded-lg hover:bg-background-secondary transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
          Add Budget
        </button>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4"><FinanceCardSkeleton /><FinanceCardSkeleton /><FinanceCardSkeleton /></div>
      ) : budgetCount > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="TOTAL BUDGET"
            value={formatCurrency(totalBudgeted, "USD", 0)}
            subtitle={`${budgetCount} categories`}
          />
          <SummaryCard
            label="SPENT"
            value={formatCurrency(totalSpent, "USD", 0)}
            badge={`${percentUsed}%`}
            badgeColor={percentUsed > 100 ? "error" : percentUsed > 80 ? "warning" : "success"}
            valueColor={percentUsed > 100 ? "text-error" : undefined}
            progress={Math.min(percentUsed, 100)}
            progressColor={percentUsed > 100 ? "bg-error" : percentUsed > 80 ? "bg-amber-500" : "bg-success"}
          />
          <SummaryCard
            label="REMAINING"
            value={formatCurrency(remaining, "USD", 0)}
            subtitle={remaining < 0 ? "Over budget" : `${overBudgetCount > 0 ? `${overBudgetCount} over` : "On track"}`}
            valueColor={remaining < 0 ? "text-error" : "text-success"}
            subtitleColor={remaining < 0 ? "text-error" : overBudgetCount > 0 ? "text-amber-500" : "text-success"}
          />
        </div>
      ) : null}

      {/* Budget Categories */}
      {isLoading ? (
        <FinanceCardSkeleton />
      ) : budgetCount === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 24 }}>savings</span>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1.5">No budgets yet</h3>
          <p className="text-sm text-foreground-muted mb-4 max-w-sm mx-auto">
            Set spending limits by category to track your budget.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Create Your First Budget
          </button>
        </div>
      ) : (
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

// ─── Summary Card ──────────────────────────────────────────

function SummaryCard({ label, value, subtitle, badge, badgeColor, valueColor, subtitleColor, progress, progressColor }: {
  label: string
  value: string
  subtitle?: string
  badge?: string
  badgeColor?: "error" | "warning" | "success"
  valueColor?: string
  subtitleColor?: string
  progress?: number
  progressColor?: string
}) {
  const badgeClasses = {
    error: "bg-error/10 text-error",
    warning: "bg-amber-500/10 text-amber-500",
    success: "bg-success/10 text-success",
  }

  return (
    <div className="bg-card rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
        {badge && (
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums", badgeClasses[badgeColor ?? "success"])}>
            {badge}
          </span>
        )}
      </div>
      <p className={cn("text-2xl font-bold tabular-nums tracking-tight", valueColor ?? "text-foreground")}>{value}</p>
      {subtitle && (
        <p className={cn("text-xs mt-1", subtitleColor ?? "text-foreground-muted")}>{subtitle}</p>
      )}
      {progress != null && (
        <div className="mt-3 h-[3px] bg-background-secondary rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-500", progressColor ?? "bg-primary")} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
