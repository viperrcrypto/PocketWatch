"use client"

import { formatCurrency, cn } from "@/lib/utils"

interface SavingsTip {
  type: "cancel" | "reduce" | "switch" | "adjust"
  title: string
  amount: number
  frequency: string
  actionLabel: string
}

interface BudgetSavingsCardProps {
  tips: SavingsTip[]
  onAction?: (tip: SavingsTip) => void
}

export function BudgetSavingsCard({ tips, onAction }: BudgetSavingsCardProps) {
  if (tips.length === 0) return null

  const iconMap = { cancel: "cancel", reduce: "trending_down", switch: "swap_horiz", adjust: "tune" }
  const colorMap = { cancel: "text-error", reduce: "text-amber-500", switch: "text-primary", adjust: "text-primary" }

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-rounded text-amber-500" style={{ fontSize: 16 }}>lightbulb</span>
        <h3 className="text-sm font-semibold text-foreground">Savings Opportunities</h3>
        <span className="text-[10px] text-foreground-muted">{formatCurrency(tips.reduce((s, t) => s + t.amount, 0))}/mo potential</span>
      </div>
      <div className="space-y-3">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className={cn("material-symbols-rounded", colorMap[tip.type])} style={{ fontSize: 16 }}>
                {iconMap[tip.type]}
              </span>
              <p className="text-xs text-foreground truncate">{tip.title}</p>
            </div>
            <span className="text-xs font-semibold tabular-nums text-foreground-muted flex-shrink-0">
              {formatCurrency(tip.amount)}/{tip.frequency === "yearly" ? "yr" : "mo"}
            </span>
            {onAction && (
              <button
                onClick={() => onAction(tip)}
                className="text-[10px] font-semibold text-primary hover:text-primary-hover transition-colors flex-shrink-0"
              >
                {tip.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
