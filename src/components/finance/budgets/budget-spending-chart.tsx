"use client"

import { useMemo } from "react"
import { formatCurrency, cn } from "@/lib/utils"

interface BudgetSpendingChartProps {
  dailySpending: Array<{ date: string; amount: number }>
  budgetLimit: number
  projectedTotal: number
}

const CHART_W = 400
const CHART_H = 160
const PAD = { top: 12, right: 50, bottom: 24, left: 6 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

export function BudgetSpendingChart({ dailySpending, budgetLimit, projectedTotal }: BudgetSpendingChartProps) {
  const isOver = projectedTotal > budgetLimit

  const { linePath, areaPath, cumulative, maxY, daysInMonth } = useMemo(() => {
    if (dailySpending.length === 0) return { linePath: "", areaPath: "", cumulative: [], maxY: 1, daysInMonth: 30 }

    let running = 0
    const cum = dailySpending.map((d) => {
      running += d.amount
      return { date: d.date, total: running }
    })

    const lastDate = new Date(cum[cum.length - 1].date)
    const dim = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0).getDate()
    const mY = Math.max(budgetLimit * 1.3, running * 1.15, 1)

    const toX = (i: number) => PAD.left + (i / (dim - 1)) * PLOT_W
    const toY = (v: number) => PAD.top + PLOT_H - (v / mY) * PLOT_H

    const pts = cum.map((d, i) => ({ x: toX(i), y: toY(d.total) }))
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
    const area = `${line} L${pts[pts.length - 1].x},${toY(0)} L${pts[0].x},${toY(0)} Z`

    return { linePath: line, areaPath: area, cumulative: cum, maxY: mY, daysInMonth: dim }
  }, [dailySpending, budgetLimit])

  if (dailySpending.length === 0) {
    return <div className="h-[180px] flex items-center justify-center text-xs text-foreground-muted">No spending data yet</div>
  }

  const lastTotal = cumulative[cumulative.length - 1]?.total ?? 0
  const budgetLineY = PAD.top + PLOT_H - (budgetLimit / maxY) * PLOT_H
  const color = isOver ? "#ef4444" : "#3b82f6"
  const gradId = `budget-grad-${isOver ? "r" : "b"}`

  // Projection dashed line from current point to month end
  const lastPt = {
    x: PAD.left + ((cumulative.length - 1) / (daysInMonth - 1)) * PLOT_W,
    y: PAD.top + PLOT_H - (lastTotal / maxY) * PLOT_H,
  }
  const projPt = {
    x: PAD.left + PLOT_W,
    y: PAD.top + PLOT_H - (Math.min(projectedTotal, maxY) / maxY) * PLOT_H,
  }

  // X-axis labels (1st, mid, current day)
  const firstDate = new Date(cumulative[0].date)
  const midDay = Math.floor(daysInMonth / 2)
  const xLabels = [
    { day: 1, label: `${firstDate.toLocaleString("en", { month: "short" })} 1` },
    { day: midDay, label: `${midDay}` },
    { day: cumulative.length, label: `${cumulative.length}` },
  ]

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted mb-2">
        Daily Cumulative Spending
      </p>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ height: 180 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((f) => {
          const y = PAD.top + PLOT_H * (1 - f)
          return <line key={f} x1={PAD.left} y1={y} x2={PAD.left + PLOT_W} y2={y} stroke="var(--card-border)" strokeWidth="0.5" />
        })}

        {/* Budget line */}
        <line
          x1={PAD.left} y1={budgetLineY} x2={PAD.left + PLOT_W} y2={budgetLineY}
          stroke="var(--foreground-muted)" strokeWidth="1" strokeDasharray="6,4" opacity={0.6}
        />
        <text x={PAD.left + PLOT_W + 4} y={budgetLineY + 3} fontSize="9" fill="var(--foreground-muted)">
          Budget
        </text>
        <text x={PAD.left + PLOT_W + 4} y={budgetLineY + 13} fontSize="9" fill="var(--foreground-muted)" fontWeight="600">
          {formatCurrency(budgetLimit, "USD", 0)}
        </text>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Projection dashed line */}
        {cumulative.length < daysInMonth && (
          <line
            x1={lastPt.x} y1={lastPt.y} x2={projPt.x} y2={projPt.y}
            stroke={color} strokeWidth="1.5" strokeDasharray="4,4" opacity={0.4}
          />
        )}

        {/* Spending line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Current position dot */}
        <circle cx={lastPt.x} cy={lastPt.y} r="3.5" fill={color} />
        <circle cx={lastPt.x} cy={lastPt.y} r="6" fill={color} opacity="0.15" />

        {/* X-axis labels */}
        {xLabels.map(({ day, label }) => {
          const x = PAD.left + ((day - 1) / (daysInMonth - 1)) * PLOT_W
          return (
            <text key={day} x={x} y={CHART_H - 4} fontSize="8" fill="var(--foreground-muted)" textAnchor="middle">
              {label}
            </text>
          )
        })}
      </svg>
      <p className={cn("text-[10px] font-medium mt-1", isOver ? "text-error" : "text-success")}>
        On pace for {formatCurrency(projectedTotal, "USD", 0)} by month end
        {isOver ? ` — ${formatCurrency(projectedTotal - budgetLimit, "USD", 0)} over` : ` — ${formatCurrency(budgetLimit - projectedTotal, "USD", 0)} under`}
      </p>
    </div>
  )
}
