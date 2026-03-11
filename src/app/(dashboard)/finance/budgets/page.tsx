"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  useFinanceBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget,
  useFinanceDeepInsights, useFinanceTransactions,
  useAutoCategorize, useUpdateTransactionCategory,
  useUpcomingBills, useFinanceSubscriptions,
  useBudgetSuggestions, useSpendingByMonth,
} from "@/hooks/use-finance"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { BudgetCategoryBreakdown } from "@/components/finance/budgets/budget-category-breakdown"
import { BudgetSpendingTable } from "@/components/finance/budgets/budget-spending-table"
import { BudgetAddModal } from "@/components/finance/budgets/budget-add-modal"
import { BudgetStatCards } from "@/components/finance/budgets/budget-stat-cards"
import { BudgetSuggestionsCard } from "@/components/finance/budgets/budget-suggestions-card"
import { BudgetUserCard } from "@/components/finance/budgets/budget-user-card"
import { BudgetUntrackedSection } from "@/components/finance/budgets/budget-untracked-section"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { BudgetSubscriptionsSection } from "@/components/finance/budgets/budget-subscriptions-section"
import { getBudgetableCategories } from "@/lib/finance/categories"
import { usePanelState } from "@/hooks/use-panel-state"
import { cn } from "@/lib/utils"

type BudgetView = "budgets" | "subscriptions"

export default function FinanceBudgetsPage() {
  const router = useRouter()
  const { data: budgets, isLoading, isError } = useFinanceBudgets()
  const { data: deep } = useFinanceDeepInsights()
  const { data: txData } = useFinanceTransactions({ limit: 100 })
  const { data: billsData } = useUpcomingBills()
  const { data: subsData } = useFinanceSubscriptions()
  const { data: suggestions } = useBudgetSuggestions()
  const [spendingMonth, setSpendingMonth] = useState<string | null>(null)
  const { data: monthIndex } = useSpendingByMonth() // get availableMonths list
  const { data: monthlySpending } = useSpendingByMonth(spendingMonth ?? undefined)
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()
  const autoCategorize = useAutoCategorize()
  const updateCategory = useUpdateTransactionCategory()

  const [activeView, setActiveView] = useState<BudgetView>("budgets")
  const { isOpen: isDualView, toggle: toggleDualView } = usePanelState("budgetDualView", true)

  const [showModal, setShowModal] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState("")
  const [catResult, setCatResult] = useState<{ categorized: number; remaining: number } | null>(null)

  const hasBudgets = (budgets?.length ?? 0) > 0
  const totalBudgeted = budgets?.reduce((s, b) => s + b.monthlyLimit, 0) ?? 0
  const totalSpent = budgets?.reduce((s, b) => s + b.spent, 0) ?? 0
  const bills = billsData?.bills ?? []
  const subscriptions = subsData?.subscriptions ?? []
  const uncategorizedCount = deep?.uncategorizedCount ?? 0
  const defaultCategories = suggestions?.suggestions ?? []
  const defaultTotal = suggestions?.totalAvgSpending ?? 0
  const monthsAnalyzed = suggestions?.monthsAnalyzed ?? 0
  const availableMonths = monthIndex?.availableMonths ?? []

  // When a specific month is selected, use that month's data; otherwise 6-mo avg
  const spendingCategories = spendingMonth && monthlySpending
    ? monthlySpending.categories.map((c) => ({ category: c.category, avgMonthly: c.total, suggested: 0, lastMonth: 0, monthsOfData: 1 }))
    : defaultCategories
  const totalAvgSpending = spendingMonth && monthlySpending
    ? monthlySpending.totalSpending
    : defaultTotal
  const deletingBudget = budgets?.find((b) => b.id === deletingId)
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0)

  // Three-state logic
  const budgetedCategories = useMemo(
    () => new Set(budgets?.map((b) => b.category) ?? []),
    [budgets]
  )
  const untrackedCategories = useMemo(
    () => spendingCategories.filter((c) => !budgetedCategories.has(c.category)),
    [spendingCategories, budgetedCategories]
  )
  const budgetState: "zero" | "partial" | "full" =
    (budgets?.length ?? 0) === 0
      ? "zero"
      : untrackedCategories.length > 0
      ? "partial"
      : "full"

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
  const daysRemaining = useMemo(() => {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return lastDay - now.getDate()
  }, [now.getFullYear(), now.getMonth(), now.getDate()])

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

  const handleBudgetAll = () => {
    for (const cat of untrackedCategories) {
      createBudget.mutate({ category: cat.category, monthlyLimit: cat.suggested })
    }
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Budgets</h1>
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load budgets.</p>
        </div>
      </div>
    )
  }

  // Top 3 subscriptions sorted by amount for stat card
  const topSubscriptions = [...subscriptions]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map((s) => ({ merchantName: s.merchantName, nickname: s.nickname, amount: s.amount }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {activeView === "budgets" ? "Budgets" : "Subscriptions & Bills"}
          </h1>
          <p className="text-foreground-muted text-sm mt-0.5">{currentMonth}</p>
        </div>
        <span className="text-[11px] font-bold text-foreground-muted tabular-nums">
          {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      {/* View Toggle: Budgets vs Subscriptions */}
      <div className="flex items-center gap-0.5 bg-foreground/[0.04] rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setActiveView("budgets")}
          className={cn(
            "text-[11px] font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5",
            activeView === "budgets"
              ? "bg-card text-foreground shadow-sm"
              : "text-foreground-muted hover:text-foreground",
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>savings</span>
          Budgets
        </button>
        <button
          onClick={() => setActiveView("subscriptions")}
          className={cn(
            "text-[11px] font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5",
            activeView === "subscriptions"
              ? "bg-card text-foreground shadow-sm"
              : "text-foreground-muted hover:text-foreground",
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>autorenew</span>
          Subscriptions
        </button>
      </div>

      {activeView === "subscriptions" ? (
        <BudgetSubscriptionsSection />
      ) : (
      <>
      {/* Stat Cards */}
      <BudgetStatCards
        hasBudgets={hasBudgets}
        totalBudgeted={totalBudgeted}
        totalSpent={totalSpent}
        budgetCount={budgets?.length ?? 0}
        daysRemaining={daysRemaining}
        totalAvgSpending={totalAvgSpending}
        monthsAnalyzed={monthsAnalyzed}
        subscriptionTotal={subsData?.monthlyTotal ?? 0}
        subscriptionCount={subscriptions.length}
        billsCount={bills.length}
        billsTotal={billsTotal}
        nextBillDays={bills.length > 0 ? bills[0].daysUntil : null}
        subscriptions={topSubscriptions}
      />

      {/* Two-Card Layout */}
      {isLoading ? (
        <FinanceCardSkeleton />
      ) : (
        <>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-foreground/[0.04] rounded-lg p-0.5 w-fit">
            <button
              onClick={() => { if (!isDualView) toggleDualView() }}
              className={cn(
                "text-[11px] font-bold px-3 py-1.5 rounded-md transition-all",
                isDualView
                  ? "bg-card text-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground",
              )}
            >
              Compare
            </button>
            <button
              onClick={() => { if (isDualView) toggleDualView() }}
              className={cn(
                "text-[11px] font-bold px-3 py-1.5 rounded-md transition-all",
                !isDualView
                  ? "bg-card text-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground",
              )}
            >
              Budget
            </button>
          </div>

          <div className={cn("grid grid-cols-1 gap-5", isDualView && "lg:grid-cols-2")}>
            {isDualView && (
              <BudgetSuggestionsCard
                suggestions={spendingCategories}
                totalAvgSpending={totalAvgSpending}
                monthsAnalyzed={monthsAnalyzed}
                availableMonths={availableMonths}
                selectedMonth={spendingMonth}
                onMonthChange={setSpendingMonth}
              />
            )}
            <BudgetUserCard
              budgetState={budgetState}
              budgets={budgets?.map((b) => ({
                id: b.id,
                category: b.category,
                monthlyLimit: b.monthlyLimit,
                spent: b.spent,
                percentUsed: b.percentUsed,
              })) ?? []}
              totalSpent={totalSpent}
              totalBudgeted={totalBudgeted}
              untrackedCount={untrackedCategories.length}
              onOpenWorkshop={() => router.push("/finance/budgets/workshop")}
              onAddSingle={() => setShowModal(true)}
            />
          </div>
        </>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-card-border rounded-xl p-3">
        <div className="flex flex-wrap gap-2 items-center">
          {uncategorizedCount > 0 && (
            <button
              onClick={() => { setCatResult(null); autoCategorize.mutate(undefined, { onSuccess: (data) => setCatResult(data) }) }}
              disabled={autoCategorize.isPending}
              className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-primary-hover transition-colors disabled:opacity-50 shadow-sm"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>auto_awesome</span>
              Auto-categorize
            </button>
          )}
          {catResult && (
            <span className="text-[10px] text-foreground-muted">{catResult.categorized > 0 ? `${catResult.categorized} done` : "No matches"}</span>
          )}
          <Link href="/finance/budgets/workshop" className="text-foreground-muted text-xs font-bold px-3 py-2 rounded-lg hover:text-foreground hover:bg-background-secondary transition-all border border-card-border">
            Workshop
          </Link>
          <Link href="/finance/budgets/insights" className="text-foreground-muted text-xs font-bold px-3 py-2 rounded-lg hover:text-foreground hover:bg-background-secondary transition-all border border-card-border flex items-center gap-1.5">
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>analytics</span>
            Full Analysis
          </Link>
        </div>
        <button onClick={() => setShowModal(true)} className="text-primary text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 border border-primary/30 hover:bg-primary hover:text-white transition-all">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
          Add Budget
        </button>
      </div>

      {/* Category Detail */}
      {isLoading ? (
        <FinanceCardSkeleton />
      ) : budgetState === "zero" ? (
        <BudgetSpendingTable categories={spendingCategories} monthsAnalyzed={monthsAnalyzed} totalAvgSpending={totalAvgSpending} />
      ) : (
        <>
          <BudgetCategoryBreakdown
            budgets={budgets!}
            txByCategory={txByCategory}
            onEditBudget={(id, limit) => updateBudget.mutate({ budgetId: id, monthlyLimit: limit })}
            onDeleteBudget={(id) => setDeletingId(id)}
            onCategoryChange={(txId, cat, rule) => updateCategory.mutate({ transactionId: txId, category: cat, createRule: rule })}
            onAddBudget={() => setShowModal(true)}
          />
          {budgetState === "partial" && (
            <BudgetUntrackedSection
              untrackedCategories={untrackedCategories}
              txByCategory={txByCategory}
              onAddBudget={(cat, limit) => createBudget.mutate({ category: cat, monthlyLimit: limit })}
              onBudgetAll={handleBudgetAll}
            />
          )}
        </>
      )}
      </>
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
