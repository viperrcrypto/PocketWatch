"use client"

import { cn } from "@/lib/utils"

interface BudgetProgressBarProps {
  spent: number
  limit: number
  showPercent?: boolean
  className?: string
}

export function BudgetProgressBar({ spent, limit, showPercent, className }: BudgetProgressBarProps) {
  const percent = limit > 0 ? Math.min((spent / limit) * 100, 120) : 0
  const displayPercent = Math.min(percent, 100)

  const color = percent >= 100
    ? "bg-error"
    : percent >= 80
    ? "bg-warning"
    : "bg-success"

  return (
    <div className={cn("space-y-1", className)}>
      <div className="progress-track h-1.5 rounded-full bg-background-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
          style={{ width: `${displayPercent}%` }}
        />
      </div>
      {showPercent && (
        <p className={cn(
          "text-xs font-data tabular-nums",
          percent >= 100 ? "text-error" : percent >= 80 ? "text-warning" : "text-foreground-muted"
        )}>
          {Math.round(percent)}%
        </p>
      )}
    </div>
  )
}
