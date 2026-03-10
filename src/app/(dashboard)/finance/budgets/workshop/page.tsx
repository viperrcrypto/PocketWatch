"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  useFinanceBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget,
  useFinanceDeepInsights, useFinanceTrends,
  useFinanceIncome, useSetIncomeOverride,
  useBudgetSuggestions,
} from "@/hooks/use-finance"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { BudgetWorkshopCategory } from "@/components/finance/budget-workshop-category"
import { getBudgetableCategories } from "@/lib/finance/categories"
import { WorkshopStatsCards } from "@/components/finance/budget-workshop/workshop-stats-cards"
import { WorkshopCategoryPicker } from "@/components/finance/budget-workshop/workshop-category-picker"
import { WorkshopFooter } from "@/components/finance/budget-workshop/workshop-footer"

interface WorkshopEdit {
  budgetId: string | null
  category: string
  monthlyLimit: number
  originalLimit: number
  suggestedLimit: number
  isNew: boolean
  isRemoved: boolean
}

export default function BudgetWorkshopPage() {
  const router = useRouter()
  const { data: budgets, isLoading } = useFinanceBudgets()
  const { data: deep } = useFinanceDeepInsights()
  const { data: trends } = useFinanceTrends(6)
  const { data: incomeData } = useFinanceIncome()
  const { data: suggestionsData } = useBudgetSuggestions()
  const setIncomeOverride = useSetIncomeOverride()
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()

  const [edits, setEdits] = useState<WorkshopEdit[]>([])
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeInput, setIncomeInput] = useState("")

  // Initialize edits from budgets or suggestions
  useEffect(() => {
    if (initialized) return
    if (!budgets) return

    if (budgets.length > 0) {
      setEdits(
        budgets.map((b) => ({
          budgetId: b.id, category: b.category,
          monthlyLimit: b.monthlyLimit, originalLimit: b.monthlyLimit,
          suggestedLimit: b.monthlyLimit, isNew: false, isRemoved: false,
        }))
      )
      setInitialized(true)
    } else if (suggestionsData?.suggestions && suggestionsData.suggestions.length > 0) {
      setEdits(
        suggestionsData.suggestions.map((s) => ({
          budgetId: null, category: s.category,
          monthlyLimit: s.suggested, originalLimit: 0,
          suggestedLimit: s.suggested, isNew: true, isRemoved: false,
        }))
      )
      setInitialized(true)
    } else if (suggestionsData) {
      setInitialized(true)
    }
  }, [budgets, suggestionsData, initialized])

  // Last month spending by category
  const lastMonthByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    if (trends?.months && trends.months.length >= 2) {
      const lastMonth = trends.months[trends.months.length - 2]
      if (lastMonth?.categories) {
        for (const [cat, amount] of Object.entries(lastMonth.categories)) {
          map[cat] = amount
        }
      }
    }
    return map
  }, [trends])

  // AI tips from category comparison
  const aiTips = useMemo(() => {
    const map: Record<string, { tip: string; type: "saving" | "increase" | "steady" }> = {}
    if (deep?.categoryComparison) {
      for (const comp of deep.categoryComparison) {
        if (comp.changePercent != null) {
          if (comp.changePercent <= -15) {
            map[comp.category] = { tip: `Spending dropped ${Math.abs(comp.changePercent).toFixed(0)}% — Reduce budget?`, type: "saving" }
          } else if (comp.changePercent >= 15) {
            map[comp.category] = { tip: `Spending up ${comp.changePercent.toFixed(0)}% — Consider raising limit`, type: "increase" }
          } else {
            map[comp.category] = { tip: "Spending is steady. Consider a 5% buffer.", type: "steady" }
          }
        }
      }
    }
    return map
  }, [deep])

  // Computed values
  const activeEdits = edits.filter((e) => !e.isRemoved)
  const totalBudgeted = activeEdits.reduce((s, e) => s + e.monthlyLimit, 0)
  const income = incomeData?.effective ?? deep?.totalIncome ?? 0
  const hasIncomeOverride = incomeData?.override != null
  const estimatedIncome = incomeData?.estimated ?? deep?.totalIncome ?? 0
  const buffer = income - totalBudgeted
  const bufferPercent = income > 0 ? (buffer / income) * 100 : 0
  const hasChanges = edits.some((e) => e.isNew || e.isRemoved || e.monthlyLimit !== e.originalLimit)

  // Available categories for adding
  const availableCategories = useMemo(() => {
    const used = new Set(activeEdits.map((e) => e.category))
    return getBudgetableCategories().filter((c) => !used.has(c))
  }, [activeEdits])

  // Handlers
  const updateLimit = useCallback((category: string, value: number) => {
    setEdits((prev) => prev.map((e) => e.category === category ? { ...e, monthlyLimit: value } : e))
  }, [])

  const removeCategory = useCallback((category: string) => {
    setEdits((prev) => prev.map((e) => e.category === category ? { ...e, isRemoved: true } : e))
  }, [])

  const addCategory = useCallback((category: string) => {
    const lastSpent = lastMonthByCategory[category]
    const suggestedLimit = lastSpent ? Math.ceil(lastSpent * 1.1 / 10) * 10 : 500
    setEdits((prev) => [
      ...prev,
      { budgetId: null, category, monthlyLimit: suggestedLimit, originalLimit: 0, suggestedLimit, isNew: true, isRemoved: false },
    ])
    setShowCategoryPicker(false)
  }, [lastMonthByCategory])

  const resetToLastMonth = useCallback(() => {
    setEdits((prev) =>
      prev.map((e) => {
        const last = lastMonthByCategory[e.category]
        return (last != null && last > 0) ? { ...e, monthlyLimit: Math.ceil(last / 10) * 10 } : e
      })
    )
  }, [lastMonthByCategory])

  const handleFinalize = async () => {
    setIsSaving(true)
    setSaveError(null)
    try {
      for (const edit of edits) {
        if (edit.isRemoved && edit.budgetId) {
          await deleteBudget.mutateAsync(edit.budgetId)
        } else if (edit.isNew && !edit.isRemoved) {
          await createBudget.mutateAsync({ category: edit.category, monthlyLimit: edit.monthlyLimit })
        } else if (!edit.isRemoved && edit.budgetId && edit.monthlyLimit !== edit.originalLimit) {
          await updateBudget.mutateAsync({ budgetId: edit.budgetId, monthlyLimit: edit.monthlyLimit })
        }
      }
      router.push("/finance/budgets")
    } catch (err) {
      console.error("Budget save failed", err)
      setSaveError("Some budgets could not be saved. Please try again.")
      setIsSaving(false)
    }
  }

  const currentMonth = deep?.currentMonth
    ? (() => {
        const [y, m] = deep.currentMonth.split("-").map(Number)
        return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      })()
    : new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const handleIncomeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseFloat(incomeInput)
      if (val > 0) { setIncomeOverride.mutate(val) }
      else if (incomeInput === "" || incomeInput === "0") { setIncomeOverride.mutate(null) }
      setEditingIncome(false)
    }
    if (e.key === "Escape") setEditingIncome(false)
  }, [incomeInput, setIncomeOverride])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <FinancePageHeader title="Budget Workshop" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <FinanceCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Budget Workshop"
        subtitle={`Edit Mode — ${currentMonth}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance/budgets" className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors">
              Cancel
            </Link>
            <button
              onClick={resetToLastMonth}
              className="flex items-center gap-1.5 px-4 py-2 bg-card border border-card-border text-foreground-muted rounded-lg text-sm font-medium hover:border-card-border-hover hover:text-foreground transition-all"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>history</span>
              Reset to Last Month
            </button>
            <button
              onClick={handleFinalize}
              disabled={isSaving || !hasChanges}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>check</span>
              {isSaving ? "Saving..." : "Finalize Budget"}
            </button>
          </div>
        }
      />

      <WorkshopStatsCards
        totalBudgeted={totalBudgeted}
        hasChanges={hasChanges}
        income={income}
        hasIncomeOverride={hasIncomeOverride}
        estimatedIncome={estimatedIncome}
        editingIncome={editingIncome}
        incomeInput={incomeInput}
        buffer={buffer}
        bufferPercent={bufferPercent}
        onIncomeInputChange={setIncomeInput}
        onIncomeSave={() => {
          const val = parseFloat(incomeInput)
          if (val > 0) { setIncomeOverride.mutate(val) } else { setIncomeOverride.mutate(null) }
          setEditingIncome(false)
        }}
        onIncomeCancel={() => setEditingIncome(false)}
        onIncomeEdit={() => { setIncomeInput(income > 0 ? income.toFixed(0) : ""); setEditingIncome(true) }}
        onIncomeReset={() => { setIncomeOverride.mutate(null); setEditingIncome(false) }}
        onIncomeKeyDown={handleIncomeKeyDown}
      />

      {saveError && (
        <div className="bg-error/5 border border-error/20 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-rounded text-error" style={{ fontSize: 20 }}>error</span>
          <span className="text-sm font-medium text-error">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-auto text-error/60 hover:text-error">
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {/* Categories Grid */}
      <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-card-border/50">
          <h3 className="text-lg font-bold text-foreground">Spending Categories</h3>
          <div className="flex gap-2">
            {availableCategories.length > 0 && (
              <button
                onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card-elevated border border-card-border text-foreground-muted hover:text-primary hover:border-primary/30 transition-all text-xs font-semibold"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
                Add Category
              </button>
            )}
          </div>
        </div>

        {showCategoryPicker && (
          <WorkshopCategoryPicker categories={availableCategories} onAdd={addCategory} />
        )}

        <div className="divide-y divide-card-border/30">
          {activeEdits.map((edit) => {
            const tip = aiTips[edit.category]
            return (
              <BudgetWorkshopCategory
                key={edit.category}
                category={edit.category}
                monthlyLimit={edit.monthlyLimit}
                suggestedLimit={edit.suggestedLimit}
                lastMonthSpent={lastMonthByCategory[edit.category] ?? null}
                aiTip={tip?.tip ?? null}
                aiTipType={tip?.type ?? null}
                onChange={(value) => updateLimit(edit.category, value)}
                onRemove={() => removeCategory(edit.category)}
              />
            )
          })}
        </div>

        {availableCategories.length > 0 && (
          <div className="p-6">
            <button
              onClick={() => setShowCategoryPicker(true)}
              className="w-full flex items-center justify-center gap-3 py-6 rounded-2xl border-2 border-dashed border-card-border hover:border-primary/40 hover:bg-primary-subtle transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-rounded">add_circle</span>
              </div>
              <div className="text-left">
                <span className="text-sm font-semibold text-foreground block">Add New Category</span>
                <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-widest">
                  Create custom spending limit
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      <WorkshopFooter
        buffer={buffer}
        isSaving={isSaving}
        hasChanges={hasChanges}
        onFinalize={handleFinalize}
      />
    </div>
  )
}
