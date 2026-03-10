"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { ChartTooltip } from "./chart-tooltip"

interface CashFlowChartProps {
  data: Array<{ month: string; income: number; spending: number }>
  height?: number
}

export function CashFlowChart({ data, height = 300 }: CashFlowChartProps) {
  const { success, error, border, foregroundMuted } = useChartTheme()

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={border} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: foregroundMuted }} />
        <YAxis tick={{ fontSize: 11, fill: foregroundMuted }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="income" name="Income" stroke={success} fill={success} fillOpacity={0.1} strokeWidth={2} />
        <Area type="monotone" dataKey="spending" name="Spending" stroke={error} fill={error} fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
