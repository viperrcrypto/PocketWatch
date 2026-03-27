"use client"

import { useState } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface ComparisonRow {
  category: string
  budget: number
  actual: number
}

interface BudgetComparisonTableProps {
  budgets: ComparisonRow[]
  suggestions?: Array<{ category: string; avgMonthly: number }>
  onAISuggest?: () => void
}

export function BudgetComparisonTable({ budgets, suggestions, onAISuggest }: BudgetComparisonTableProps) {
  const [view, setView] = useState<"this" | "avg">("this")

  const rows = [...budgets].sort((a, b) => {
    const aDiff = a.actual - a.budget
    const bDiff = b.actual - b.budget
    return bDiff - aDiff // worst first
  })

  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden h-full flex flex-col" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="px-5 py-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Your Budget vs Your Spending</h3>
        <div className="flex items-center gap-0.5 bg-background-secondary rounded-lg p-0.5">
          <button
            onClick={() => setView("avg")}
            className={cn("text-[10px] font-medium px-2.5 py-1 rounded-md transition-colors", view === "avg" ? "bg-card text-foreground shadow-sm" : "text-foreground-muted")}
          >
            6mo avg
          </button>
          <button
            onClick={() => setView("this")}
            className={cn("text-[10px] font-medium px-2.5 py-1 rounded-md transition-colors", view === "this" ? "bg-card text-foreground shadow-sm" : "text-foreground-muted")}
          >
            This Month
          </button>
        </div>
      </div>

      <div className="px-5 flex-1">
        {/* Header */}
        <div className="flex items-center py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground-muted border-b border-card-border/30">
          <span className="flex-1">Category</span>
          <span className="w-20 text-right">Budget</span>
          <span className="w-20 text-right">{view === "avg" ? "6mo Avg" : "Actual"}</span>
          <span className="w-20 text-right">Diff</span>
        </div>

        {/* Rows */}
        {rows.map((row) => {
          const actual = view === "avg"
            ? (suggestions?.find((s) => s.category === row.category)?.avgMonthly ?? row.actual)
            : row.actual
          const diff = actual - row.budget
          const isOver = diff > 0
          const meta = getCategoryMeta(row.category)

          return (
            <div key={row.category} className="flex items-center py-2 hover:bg-background-secondary/50 transition-colors -mx-2 px-2 rounded-lg">
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.hex }} />
                <span className="text-xs font-medium text-foreground truncate">{row.category}</span>
              </div>
              <span className="w-20 text-right text-xs tabular-nums text-foreground-muted">{formatCurrency(row.budget, "USD", 0)}</span>
              <span className="w-20 text-right text-xs tabular-nums font-medium text-foreground">{formatCurrency(actual, "USD", 0)}</span>
              <span className={cn("w-20 text-right text-xs tabular-nums font-semibold", isOver ? "text-error" : "text-success")}>
                {isOver ? `-${formatCurrency(diff, "USD", 0)}` : `+${formatCurrency(Math.abs(diff), "USD", 0)}`}
              </span>
            </div>
          )
        })}
      </div>

      {/* AI Suggest footer */}
      {onAISuggest && (
        <div className="mx-5 my-4">
          <button
            onClick={onAISuggest}
            className="w-full py-2.5 text-xs font-medium text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>auto_awesome</span>
            Let AI optimize your budget based on spending history
          </button>
        </div>
      )}
    </div>
  )
}
