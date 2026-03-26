"use client"

import { useMemo } from "react"
import { formatCurrency, cn } from "@/lib/utils"

interface BudgetSpendingChartProps {
  dailySpending: Array<{ date: string; amount: number }>
  budgetLimit: number
  projectedTotal: number
}

/**
 * Simple SVG area chart showing cumulative daily spending vs budget line.
 * Uses inline SVG to avoid dynamic import overhead.
 */
export function BudgetSpendingChart({ dailySpending, budgetLimit, projectedTotal }: BudgetSpendingChartProps) {
  const isOver = projectedTotal > budgetLimit

  const { points, cumulative } = useMemo(() => {
    if (dailySpending.length === 0) return { points: "", cumulative: [] }

    // Build cumulative totals
    let running = 0
    const cum = dailySpending.map((d) => {
      running += d.amount
      return { date: d.date, total: running }
    })

    const maxY = Math.max(budgetLimit * 1.3, running * 1.1, 1)
    const w = 100
    const h = 100

    const pts = cum.map((d, i) => {
      const x = cum.length > 1 ? (i / (cum.length - 1)) * w : w / 2
      const y = h - (d.total / maxY) * h
      return `${x},${y}`
    })

    // Close the area polygon
    const areaPath = `${pts.join(" ")} ${w},${h} 0,${h}`

    return { points: areaPath, cumulative: cum }
  }, [dailySpending, budgetLimit])

  if (dailySpending.length === 0) {
    return <div className="h-[120px] flex items-center justify-center text-xs text-foreground-muted">No spending data yet</div>
  }

  const lastTotal = cumulative[cumulative.length - 1]?.total ?? 0
  const maxY = Math.max(budgetLimit * 1.3, lastTotal * 1.1, 1)
  const budgetY = 100 - (budgetLimit / maxY) * 100

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted mb-2">
        Daily Cumulative Spending
      </p>
      <div className="relative">
        <svg viewBox="0 0 100 100" className="w-full h-[120px]" preserveAspectRatio="none">
          {/* Budget line */}
          <line
            x1="0" y1={budgetY} x2="100" y2={budgetY}
            stroke="var(--foreground-muted)" strokeWidth="0.3" strokeDasharray="2,2" opacity={0.5}
          />
          {/* Area fill */}
          <polygon
            points={points}
            fill={isOver ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)"}
          />
          {/* Line */}
          <polyline
            points={cumulative.map((d, i) => {
              const x = cumulative.length > 1 ? (i / (cumulative.length - 1)) * 100 : 50
              const y = 100 - (d.total / maxY) * 100
              return `${x},${y}`
            }).join(" ")}
            fill="none"
            stroke={isOver ? "#ef4444" : "#3b82f6"}
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Current position dot */}
          {cumulative.length > 0 && (() => {
            const last = cumulative[cumulative.length - 1]
            const x = 100
            const y = 100 - (last.total / maxY) * 100
            return <circle cx={x} cy={y} r="1.5" fill={isOver ? "#ef4444" : "#3b82f6"} />
          })()}
        </svg>
        {/* Budget label */}
        <div className="absolute text-[9px] text-foreground-muted" style={{ top: `${(budgetY / 100) * 120 - 8}px`, right: 0 }}>
          Budget {formatCurrency(budgetLimit, "USD", 0)}
        </div>
      </div>
      <p className={cn("text-[10px] font-medium mt-1", isOver ? "text-error" : "text-success")}>
        On pace for {formatCurrency(projectedTotal, "USD", 0)} by month end
        {isOver ? ` — ${formatCurrency(projectedTotal - budgetLimit, "USD", 0)} over` : ` — ${formatCurrency(budgetLimit - projectedTotal, "USD", 0)} under`}
      </p>
    </div>
  )
}
