"use client"

import { useState, useRef, useEffect } from "react"
import { BudgetProgressBar } from "@/components/finance/budget-progress-bar"
import { BudgetSparkline } from "./budget-sparkline"
import { getCategoryMeta } from "@/lib/finance/categories"
import { formatCurrency, cn } from "@/lib/utils"
import type { BudgetCategoryData } from "./budget-types"

interface TxEntry { name: string; merchantName: string | null; amount: number; date: string | Date }

interface BudgetCategoryCardProps {
  budget: BudgetCategoryData
  transactions?: TxEntry[]
  isEditing: boolean
  onStartEdit: () => void
  onSaveEdit: (id: string, newLimit: number) => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
  onToggleRollover: (id: string, rollover: boolean) => void
  showSixMonthAvg: boolean
}

export function BudgetCategoryCard({ budget, transactions, isEditing, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onToggleRollover, showSixMonthAvg }: BudgetCategoryCardProps) {
  const meta = getCategoryMeta(budget.category)
  const isOver = budget.percentUsed > 100
  const isWarn = budget.percentUsed >= 80 && !isOver
  const overAmount = budget.spent - budget.monthlyLimit

  const [editValue, setEditValue] = useState(String(budget.monthlyLimit))
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rolloverPending = useRef(false)

  useEffect(() => { rolloverPending.current = false }, [budget.rollover])

  useEffect(() => {
    if (isEditing) {
      setEditValue(String(budget.monthlyLimit))
      requestAnimationFrame(() => inputRef.current?.select())
    }
  }, [isEditing, budget.monthlyLimit])

  const handleSave = () => {
    const val = parseFloat(editValue)
    if (val > 0) onSaveEdit(budget.id, val)
    else onCancelEdit()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave()
    if (e.key === "Escape") onCancelEdit()
  }

  const displaySpent = showSixMonthAvg && budget.sixMonthAvg !== null ? budget.sixMonthAvg : budget.spent
  const displayLabel = showSixMonthAvg ? "6-mo avg" : "spent"

  return (
    <div className="bg-card border border-card-border rounded-xl px-4 py-3 group hover:border-card-border-hover transition-colors" tabIndex={0} aria-label={`${budget.category}: ${Math.round(budget.percentUsed)}% used`}>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${meta.hex}18` }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: meta.hex }}>{meta.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-foreground truncate">{budget.category}</span>
              <span className={cn("material-symbols-rounded flex-shrink-0", isOver ? "text-error" : isWarn ? "text-warning" : "text-success")} style={{ fontSize: 14 }} aria-label={isOver ? "Over budget" : isWarn ? "Approaching limit" : "On track"}>
                {isOver ? "error" : isWarn ? "warning" : "check_circle"}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-foreground-muted">$</span>
                  <input ref={inputRef} type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave} className="w-20 text-sm font-data tabular-nums bg-background border border-card-border rounded-md px-2 py-0.5 text-right text-foreground focus:border-primary focus:outline-none" min={1} step={10} />
                </div>
              ) : (
                <span className="text-xs text-foreground-muted tabular-nums">
                  {formatCurrency(displaySpent, "USD", 0)} {displayLabel}
                  <span className="mx-0.5">/</span>
                  <span>{formatCurrency(budget.monthlyLimit, "USD", 0)}</span>
                </span>
              )}
              <span className={cn("text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md", isOver ? "bg-error/12 text-error" : isWarn ? "bg-warning/12 text-warning" : "bg-success/12 text-success")}>
                {Math.round(budget.percentUsed)}%
              </span>
            </div>
          </div>

          <BudgetProgressBar spent={budget.spent} limit={budget.monthlyLimit} color={meta.hex} />

          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-3">
              {budget.trendData.length > 0 && (
                <div className="hidden sm:flex items-end gap-px" aria-hidden="true">
                  <BudgetSparkline data={budget.trendData} color={meta.hex} />
                  {budget.sixMonthAvg !== null && (
                    <span className="text-[9px] text-foreground-muted ml-1.5 tabular-nums">avg {formatCurrency(budget.sixMonthAvg, "USD", 0)}</span>
                  )}
                </div>
              )}
              {isOver && overAmount > 0 && (
                <span className="text-[10px] text-error font-semibold tabular-nums flex items-center gap-0.5">
                  <span className="material-symbols-rounded" style={{ fontSize: 11 }}>arrow_upward</span>
                  {formatCurrency(overAmount, "USD", 0)} over
                </span>
              )}
              {budget.subscriptions.length > 0 && (
                <div className="hidden md:flex items-center gap-1">
                  {budget.subscriptions.slice(0, 2).map((sub, idx) => (
                    <span key={`${sub.merchantName}-${idx}`} className="text-[9px] text-foreground-muted" title={`${sub.merchantName}: ${formatCurrency(sub.amount, "USD", 2)}/mo`}>
                      {sub.merchantName.slice(0, 8)}
                    </span>
                  ))}
                  {budget.subscriptions.length > 2 && <span className="text-[9px] text-foreground-muted">+{budget.subscriptions.length - 2}</span>}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {isEditing ? (
                <>
                  {budget.sixMonthAvg !== null && <QuickChip label={`Avg ${formatCurrency(budget.sixMonthAvg, "USD", 0)}`} onClick={() => setEditValue(String(Math.round(budget.sixMonthAvg!)))} />}
                  <QuickChip label="+10%" onClick={() => setEditValue(String(Math.round(budget.monthlyLimit * 1.1)))} />
                  <button onClick={() => { if (rolloverPending.current) return; rolloverPending.current = true; onToggleRollover(budget.id, !budget.rollover) }} className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors", budget.rollover ? "bg-success/15 text-success" : "bg-foreground/5 text-foreground-muted hover:text-foreground")} title="Carry unused budget to next month">
                    Rollover {budget.rollover ? "on" : "off"}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={onStartEdit} className="p-1 rounded-md hover:bg-foreground/5 transition-colors" title="Edit limit" aria-label={`Edit ${budget.category}`}>
                    <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 15 }}>edit</span>
                  </button>
                  <button onClick={() => onDelete(budget.id)} className="p-1 rounded-md hover:bg-error/10 transition-colors" title="Delete budget" aria-label={`Delete ${budget.category}`}>
                    <span className="material-symbols-rounded text-foreground-muted hover:text-error" style={{ fontSize: 15 }}>delete</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expand/collapse transactions toggle */}
      {transactions && transactions.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium text-foreground-muted hover:text-foreground hover:bg-background-secondary/50 transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            {expanded ? "expand_less" : "expand_more"}
          </span>
          {expanded ? "Hide transactions" : `View ${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}`}
        </button>
      )}

      {/* Expandable transaction list */}
      {expanded && transactions && transactions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-card-border/30 space-y-1.5">
          {[...transactions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 15).map((tx, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-foreground truncate">{tx.merchantName ?? tx.name}</span>
                <span className="text-foreground-muted/40 flex-shrink-0">
                  {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
              <span className="text-foreground font-semibold tabular-nums ml-2 flex-shrink-0">
                {formatCurrency(Math.abs(tx.amount))}
              </span>
            </div>
          ))}
          {transactions.length > 15 && (
            <p className="text-[10px] text-foreground-muted">+{transactions.length - 15} more</p>
          )}
        </div>
      )}
    </div>
  )
}

function QuickChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">{label}</button>
  )
}
