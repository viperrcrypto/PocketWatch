"use client"

import { cn } from "@/lib/utils"

interface BudgetProgressBarProps {
  spent: number
  limit: number
  /** Optional category hex color — defaults to semantic colors */
  color?: string
  showPercent?: boolean
  className?: string
}

export function BudgetProgressBar({ spent, limit, color, showPercent, className }: BudgetProgressBarProps) {
  const percent = limit > 0 ? Math.min((spent / limit) * 100, 120) : 0
  const displayPercent = Math.min(percent, 100)
  const isOver = percent >= 100
  const isWarn = percent >= 80 && !isOver

  const fillColor = isOver ? "var(--error)" : isWarn ? "var(--warning)" : (color ?? "var(--success)")
  const fromColor = isOver
    ? "color-mix(in srgb, var(--error) 70%, transparent)"
    : isWarn
    ? "color-mix(in srgb, var(--warning) 70%, transparent)"
    : color
    ? `color-mix(in srgb, ${color} 60%, transparent)`
    : "color-mix(in srgb, var(--success) 60%, transparent)"

  return (
    <div className={cn("space-y-1", className)}>
      <div
        className="h-[5px] rounded-full overflow-hidden"
        style={{ background: "color-mix(in srgb, var(--foreground) 12%, var(--background-secondary))" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.max(displayPercent, 1)}%`,
            background: `linear-gradient(90deg, ${fromColor}, ${fillColor})`,
          }}
        />
      </div>
      {showPercent && (
        <p className={cn(
          "text-xs font-data tabular-nums",
          isOver ? "text-error" : isWarn ? "text-warning" : "text-foreground-muted"
        )}>
          {Math.round(percent)}%
        </p>
      )}
    </div>
  )
}
