"use client"

import { useState } from "react"
import { cn, formatCurrency } from "@/lib/utils"

interface PerkProgressRowProps {
  id: string
  name: string
  maxValue: number
  usedValue: number
  percentUsed: number
  period: string
  periodLabel: string
  daysRemaining: number | null
  cardId: string
  onUpdate: (cardId: string, perkId: string, data: { addAmount?: number; setUsedValue?: number }) => void
}

function urgencyColor(days: number | null): string {
  if (days === null) return "text-foreground-muted"
  if (days <= 5) return "text-error"
  if (days <= 14) return "text-amber-500"
  return "text-foreground-muted"
}

function barColor(pct: number, days: number | null): string {
  if (pct >= 100) return "bg-success"
  if (days !== null && days <= 5 && pct < 50) return "bg-error"
  if (days !== null && days <= 14 && pct < 50) return "bg-amber-500"
  return "bg-primary"
}

export function PerkProgressRow({ id, name, maxValue, usedValue, percentUsed, period, periodLabel, daysRemaining, cardId, onUpdate }: PerkProgressRowProps) {
  const [showInput, setShowInput] = useState(false)
  const [inputVal, setInputVal] = useState("")
  const remaining = Math.max(0, maxValue - usedValue)
  const isComplete = usedValue >= maxValue

  const handleSubmit = () => {
    const amount = parseFloat(inputVal)
    if (!amount || amount <= 0) return
    onUpdate(cardId, id, { addAmount: Math.min(amount, remaining) })
    setInputVal("")
    setShowInput(false)
  }

  return (
    <div className={cn(
      "rounded-lg px-3 py-2.5 transition-colors",
      isComplete ? "bg-success/5" : "bg-background-secondary/30"
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        {/* Status icon */}
        {isComplete ? (
          <span className="material-symbols-rounded text-success flex-shrink-0" style={{ fontSize: 16 }}>check_circle</span>
        ) : (
          <span className="material-symbols-rounded text-foreground-muted/50 flex-shrink-0" style={{ fontSize: 16 }}>radio_button_unchecked</span>
        )}

        {/* Name */}
        <span className={cn("text-sm flex-1 min-w-0 truncate", isComplete ? "text-foreground" : "text-foreground-muted")}>
          {shortLabel(name)}
        </span>

        {/* Period badge */}
        {period !== "annual" && (
          <span className="text-[9px] font-medium uppercase tracking-wider text-foreground-muted/60 bg-foreground/[0.04] px-1.5 py-0.5 rounded flex-shrink-0">
            {periodLabel}
          </span>
        )}

        {/* Days remaining */}
        {daysRemaining !== null && !isComplete && (
          <span className={cn("text-[10px] font-data tabular-nums flex-shrink-0", urgencyColor(daysRemaining))}>
            {daysRemaining}d left
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-background-secondary overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", barColor(percentUsed, daysRemaining))}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        <span className="text-[10px] font-data tabular-nums text-foreground-muted flex-shrink-0 w-[90px] text-right">
          {formatCurrency(usedValue)} / {formatCurrency(maxValue)}
        </span>
      </div>

      {/* Log usage / quick actions */}
      {!isComplete && (
        <div className="mt-2 flex items-center gap-1.5">
          {showInput ? (
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[10px] text-foreground-muted">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={remaining}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") setShowInput(false) }}
                placeholder={`up to ${remaining.toFixed(2)}`}
                className="w-20 text-[11px] bg-transparent border-b border-foreground-muted/30 focus:border-primary outline-none py-0.5 text-foreground tabular-nums"
                autoFocus
              />
              <button onClick={handleSubmit} className="text-[10px] text-primary hover:text-primary-hover font-medium">
                Log
              </button>
              <button onClick={() => setShowInput(false)} className="text-[10px] text-foreground-muted hover:text-foreground">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowInput(true)}
                className="text-[10px] text-primary hover:text-primary-hover font-medium flex items-center gap-0.5"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 12 }}>add</span>
                Log Usage
              </button>
              <span className="w-px h-3 bg-foreground-muted/20" />
              <button
                onClick={() => onUpdate(cardId, id, { setUsedValue: maxValue })}
                className="text-[10px] text-foreground-muted hover:text-foreground"
              >
                Mark Full
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const SHORT_LABEL_PATTERNS = ["credit", "annual", "yearly", "statement", "card", "benefit"]
  .map((r) => new RegExp(`\\b${r}\\b`, "gi"))

function shortLabel(name: string): string {
  const label = SHORT_LABEL_PATTERNS.reduce((s, re) => s.replace(re, ""), name)
  return label.trim().replace(/\s+/g, " ") || name
}
