"use client"

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { ChartTooltip } from "./chart-tooltip"

interface SpendingBarChartProps {
  data: Array<{ month: string; income: number; spending: number; net: number }>
}

export function SpendingBarChart({ data }: SpendingBarChartProps) {
  const { success, error, primary, border, foregroundMuted } = useChartTheme()

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={border} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: foregroundMuted, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: border }}
        />
        <YAxis
          tick={{ fill: foregroundMuted, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(Math.abs(v) / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          iconType="square"
          iconSize={8}
        />
        <Bar dataKey="income" name="Income" fill={success} radius={[3, 3, 0, 0]} barSize={20} />
        <Bar dataKey="spending" name="Spending" fill={error} radius={[3, 3, 0, 0]} barSize={20} />
        <Line
          type="monotone"
          dataKey="net"
          name="Net"
          stroke={primary}
          strokeWidth={2}
          dot={{ r: 3, fill: primary }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
