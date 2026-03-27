"use client"

import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ResponsiveContainer, Tooltip,
} from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { ChartTooltip } from "@/components/finance/chart-tooltip"
import { formatCurrency } from "@/lib/utils"
import { buildPaceChartData } from "./budget-helpers"
import type { DailySpendingPoint } from "./budget-types"

interface BudgetPaceChartProps {
  dailySpending: DailySpendingPoint[]
  totalBudgeted: number
  projectedTotal: number
  daysInMonth: number
  dayOfMonth: number
}

export function BudgetPaceChart({
  dailySpending, totalBudgeted, projectedTotal, daysInMonth, dayOfMonth,
}: BudgetPaceChartProps) {
  const { success, error, foregroundMuted, border } = useChartTheme()

  const data = buildPaceChartData(dailySpending, totalBudgeted, daysInMonth, dayOfMonth, projectedTotal)
  const isOverPace = projectedTotal > totalBudgeted
  const dynamicColor = isOverPace ? error : success
  const projectedDiff = Math.abs(projectedTotal - totalBudgeted)
  const maxY = Math.max(totalBudgeted, projectedTotal) * 1.1

  return (
    <div className="bg-card rounded-2xl p-6 flex-1" style={{ boxShadow: "var(--shadow-sm)" }}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted mb-4">
        Daily Cumulative Spending
      </p>

      <div aria-label={`Spending pace: ${formatCurrency(projectedTotal, "USD", 0)} projected vs ${formatCurrency(totalBudgeted, "USD", 0)} budget`}>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={border} vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} ticks={buildXTicks(daysInMonth, dayOfMonth)} />
            <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} domain={[0, maxY]} width={48} />
            <ReferenceLine y={totalBudgeted} stroke={foregroundMuted} strokeDasharray="8 4" strokeWidth={1} label={{ value: `Budget ${formatCurrency(totalBudgeted, "USD", 0)}`, position: "right", fontSize: 9, fill: foregroundMuted }} />
            <Line type="monotone" dataKey="ideal" stroke={foregroundMuted} strokeDasharray="6 4" strokeWidth={1.5} dot={false} name="Budget Pace" connectNulls={false} animationDuration={800} />
            <Area type="monotone" dataKey="actual" fill={dynamicColor} fillOpacity={0.06} stroke="none" connectNulls={false} animationDuration={800} />
            <Line type="monotone" dataKey="actual" stroke={dynamicColor} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: dynamicColor }} name="Your Spending" connectNulls={false} animationDuration={800} />
            <Line type="monotone" dataKey="projected" stroke={dynamicColor} strokeDasharray="4 4" strokeWidth={1.5} dot={false} name="Projected" connectNulls={false} animationDuration={600} />
            <Tooltip content={<ChartTooltip formatLabel={(day) => `Day ${day}`} />} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className={`text-[11px] mt-2 ${isOverPace ? "text-error" : "text-success"} font-medium tabular-nums`}>
        On pace for {formatCurrency(projectedTotal, "USD", 0)} by month end — {formatCurrency(projectedDiff, "USD", 0)} {isOverPace ? "over" : "under"}
      </p>
    </div>
  )
}

function buildXTicks(daysInMonth: number, dayOfMonth: number): number[] {
  const ticks = new Set([1, 7, 14, 21, dayOfMonth, daysInMonth])
  return [...ticks].filter((d) => d <= daysInMonth).sort((a, b) => a - b)
}
