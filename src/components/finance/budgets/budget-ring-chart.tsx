"use client"

import { cn } from "@/lib/utils"

interface BudgetRingChartProps {
  spent: number
  limit: number
  size?: number
  strokeWidth?: number
}

export function BudgetRingChart({ spent, limit, size = 180, strokeWidth = 14 }: BudgetRingChartProps) {
  const percent = limit > 0 ? (spent / limit) * 100 : 0
  const displayPercent = Math.min(percent, 100)
  const isOver = percent > 100
  const isWarn = percent >= 80 && !isOver

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (displayPercent / 100) * circumference

  const strokeColor = isOver ? "var(--error)" : isWarn ? "#f59e0b" : "#10b981"

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="var(--background-secondary)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-2xl font-bold tabular-nums tracking-tight", isOver ? "text-error" : "text-foreground")}>
          ${Math.round(spent).toLocaleString()}
        </span>
        <span className="text-[10px] text-foreground-muted">
          of ${Math.round(limit).toLocaleString()} budget
        </span>
        <span className={cn(
          "text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-full tabular-nums",
          isOver ? "bg-error/10 text-error" : isWarn ? "bg-amber-500/10 text-amber-500" : "bg-success/10 text-success"
        )}>
          {Math.round(percent)}% used
        </span>
      </div>
    </div>
  )
}
