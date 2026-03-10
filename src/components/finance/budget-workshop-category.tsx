"use client"

import { useState, useRef } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface BudgetWorkshopCategoryProps {
  category: string
  monthlyLimit: number
  suggestedLimit: number
  lastMonthSpent: number | null
  aiTip: string | null
  aiTipType: "saving" | "increase" | "steady" | null
  onChange: (value: number) => void
  onRemove: () => void
}

export function BudgetWorkshopCategory({
  category,
  monthlyLimit,
  suggestedLimit,
  lastMonthSpent,
  aiTip,
  aiTipType,
  onChange,
  onRemove,
}: BudgetWorkshopCategoryProps) {
  const meta = getCategoryMeta(category)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // FIXED: Stable max from suggested limit, NOT from current value
  const sliderMax = Math.max(suggestedLimit * 3, 2000)
  const pct = sliderMax > 0 ? Math.min((monthlyLimit / sliderMax) * 100, 100) : 0

  // Last-month marker position
  const lastMonthPct =
    lastMonthSpent != null && lastMonthSpent > 0 && sliderMax > 0
      ? Math.min((lastMonthSpent / sliderMax) * 100, 100)
      : null

  const changePercent =
    lastMonthSpent != null && lastMonthSpent > 0
      ? ((monthlyLimit - lastMonthSpent) / lastMonthSpent) * 100
      : null

  const tipColor =
    aiTipType === "saving"
      ? "bg-success/10 border-success/20 text-success"
      : aiTipType === "increase"
      ? "bg-warning/10 border-warning/20 text-warning"
      : "bg-primary/10 border-primary/20 text-primary"

  const tipIcon =
    aiTipType === "saving"
      ? "trending_down"
      : aiTipType === "increase"
      ? "trending_up"
      : "auto_awesome"

  const startEditing = () => {
    setEditValue(monthlyLimit.toString())
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  const commitEdit = () => {
    const parsed = parseFloat(editValue)
    if (!isNaN(parsed) && parsed >= 0) {
      const clamped = Math.min(parsed, 99999)
      const rounded = Math.round(clamped / 10) * 10
      onChange(rounded)
    }
    setEditing(false)
  }

  return (
    <div className="px-6 py-6 border-b border-card-border/30 last:border-b-0 group">
      {/* Category Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: `color-mix(in srgb, ${meta.hex} 10%, var(--background-secondary))`,
              border: `1px solid color-mix(in srgb, ${meta.hex} 20%, transparent)`,
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: 20, color: meta.hex }}
            >
              {meta.icon}
            </span>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">{category}</h4>
            <p className="text-[10px] text-foreground-muted">Budget Limit</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-foreground-muted text-sm">$</span>
                <input
                  ref={inputRef}
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit()
                    if (e.key === "Escape") setEditing(false)
                  }}
                  min={0}
                  max={99999}
                  step={10}
                  className="w-24 text-xl font-bold font-data tabular-nums text-foreground bg-transparent border-b-2 border-primary outline-none text-right"
                />
              </div>
            ) : (
              <button
                onClick={startEditing}
                className="text-xl font-bold font-data tabular-nums text-foreground hover:text-primary transition-colors cursor-text"
                title="Click to edit amount"
              >
                {formatCurrency(monthlyLimit, "USD", 0)}
              </button>
            )}
            <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-tight mt-0.5">
              Budget Limit
            </p>
          </div>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove budget"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>
      </div>

      {/* Slider Section */}
      <div className="relative pt-5">
        <span className="absolute top-0 left-0 text-[10px] font-medium text-foreground-muted uppercase tracking-widest">
          Adjustment
        </span>

        {/* AI Tip */}
        {aiTip && (
          <div
            className={cn(
              "flex items-center gap-1.5 mb-2 w-fit px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-tight",
              tipColor
            )}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 12 }}>
              {tipIcon}
            </span>
            <span>{aiTip}</span>
          </div>
        )}

        {/* Slider Track Container */}
        <div className="relative">
          {/* Last-month marker */}
          {lastMonthPct != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 z-10 pointer-events-none"
              style={{ left: `${lastMonthPct}%` }}
            >
              <div
                className="w-0.5 h-4 bg-foreground-muted/30 rounded-full -translate-x-1/2"
                title={`Last month: ${formatCurrency(lastMonthSpent!, "USD", 0)}`}
              />
            </div>
          )}

          {/* Range Slider with filled track */}
          <input
            type="range"
            min={0}
            max={sliderMax}
            step={10}
            value={Math.min(monthlyLimit, sliderMax)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="budget-slider w-full"
            style={{
              background: `linear-gradient(to right, ${meta.hex} ${pct}%, var(--card-border) ${pct}%)`,
              "--slider-color": meta.hex,
              "--slider-glow": `${meta.hex}25`,
            } as React.CSSProperties}
          />
        </div>

        {/* Last Month Comparison */}
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-foreground-muted">
            {lastMonthSpent != null
              ? `Last Month: ${formatCurrency(lastMonthSpent, "USD", 0)}`
              : "No data for last month"}
          </span>
          {changePercent != null && (
            <span
              className={cn(
                "text-[10px] font-semibold",
                changePercent > 0
                  ? "text-warning"
                  : changePercent < 0
                  ? "text-success"
                  : "text-foreground-muted"
              )}
            >
              {changePercent > 0 ? "+" : ""}
              {changePercent.toFixed(1)}%{" "}
              {changePercent < 0
                ? "saving"
                : changePercent > 0
                ? "increase"
                : "No change"}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
