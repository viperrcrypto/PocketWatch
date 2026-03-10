"use client"

import { useState } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { BudgetProgressBar } from "./budget-progress-bar"
import { TransactionRow } from "./transaction-row"

interface BudgetCategoryRowProps {
  budget: {
    id: string
    category: string
    spent: number
    monthlyLimit: number
    percentUsed: number
    remaining: number
  }
  transactions?: Array<{
    id: string
    date: string
    merchantName: string | null
    name: string
    amount: number
    category: string | null
    account?: { name: string; mask: string | null } | null
    isPending?: boolean
  }>
  lastMonthSpent?: number
  onEditBudget?: (id: string, newLimit: number) => void
  onDeleteBudget?: (id: string) => void
  onCategoryChange?: (txId: string, category: string, createRule?: boolean) => void
}

export function BudgetCategoryRow({
  budget,
  transactions = [],
  lastMonthSpent,
  onEditBudget,
  onDeleteBudget,
  onCategoryChange,
}: BudgetCategoryRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(budget.monthlyLimit.toString())
  const meta = getCategoryMeta(budget.category)

  const handleSave = () => {
    const val = parseFloat(editValue)
    if (val > 0 && val !== budget.monthlyLimit) {
      onEditBudget?.(budget.id, val)
    }
    setEditing(false)
  }

  return (
    <div className="border-b border-card-border/30 last:border-b-0">
      {/* Main row */}
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-foreground/[0.02] transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded) } }}
        aria-expanded={expanded}
      >
        {/* Category icon */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.hex} 15%, var(--background-secondary))` }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: meta.hex }}>{meta.icon}</span>
        </div>

        {/* Category name + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-foreground">{budget.category}</span>
            <span className="font-data text-xs font-black text-foreground tabular-nums">
              {formatCurrency(budget.spent)} <span className="font-medium text-foreground-muted">/ {formatCurrency(budget.monthlyLimit)}</span>
            </span>
          </div>
          <BudgetProgressBar spent={budget.spent} limit={budget.monthlyLimit} className="[&_.progress-track]:h-1.5" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true) }}
            className="p-1 rounded text-foreground-muted hover:text-foreground"
            title="Edit budget"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>edit</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteBudget?.(budget.id) }}
            className="p-1 rounded text-foreground-muted hover:text-error"
            title="Remove budget"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        <span className={cn(
          "material-symbols-rounded text-foreground-muted transition-transform flex-shrink-0",
          expanded && "rotate-180"
        )} style={{ fontSize: 18 }}>
          expand_more
        </span>
      </div>

      {/* Inline budget editor */}
      {editing && (
        <div className="px-5 py-3 bg-gray-50 dark:bg-white/[0.02] border-t border-card-border/30">
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-32 px-3 py-1.5 text-sm rounded-lg border border-card-border bg-white dark:bg-background-secondary text-foreground"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false) }}
            />
            {/* Suggestion chips */}
            {lastMonthSpent != null && lastMonthSpent > 0 && (
              <button
                onClick={() => setEditValue(Math.ceil(lastMonthSpent).toString())}
                className="px-2 py-1 text-[10px] font-medium rounded bg-blue-50 dark:bg-primary/10 text-primary hover:bg-blue-100 dark:hover:bg-primary/20 transition-colors"
              >
                Last month: {formatCurrency(lastMonthSpent)}
              </button>
            )}
            <button
              onClick={() => setEditValue(Math.ceil(budget.spent * 1.1).toString())}
              className="px-2 py-1 text-[10px] font-medium rounded bg-gray-100 dark:bg-background-secondary text-foreground-muted hover:text-foreground transition-colors"
            >
              +10%: {formatCurrency(Math.ceil(budget.spent * 1.1))}
            </button>
            <div className="ml-auto flex gap-1">
              <button onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-foreground-muted hover:text-foreground">Cancel</button>
              <button onClick={handleSave} className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded: transaction list */}
      {expanded && !editing && (
        <div className="bg-gray-50/50 dark:bg-white/[0.01] border-t border-card-border/30">
          {transactions.length > 0 ? (
            <div className="divide-y divide-card-border/20">
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  id={tx.id}
                  date={tx.date}
                  merchantName={tx.merchantName}
                  name={tx.name}
                  amount={tx.amount}
                  category={tx.category}
                  isPending={tx.isPending ?? false}
                  accountName={tx.account?.name ?? ""}
                  accountMask={tx.account?.mask ?? null}
                  onCategoryChange={onCategoryChange
                    ? (cat, rule) => onCategoryChange(tx.id, cat, rule)
                    : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted text-center py-6">No transactions this month</p>
          )}
        </div>
      )}
    </div>
  )
}
