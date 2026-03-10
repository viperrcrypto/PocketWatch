"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { ChartTooltip } from "./chart-tooltip"

interface CategoryTrendChartProps {
  data: Array<Record<string, string | number>>
  categories: string[]
}

export function CategoryTrendChart({ data, categories }: CategoryTrendChartProps) {
  const { palette, border, foregroundMuted } = useChartTheme()
  const top6 = categories.slice(0, 6)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
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
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" iconSize={8} />
        {top6.map((cat, i) => (
          <Area
            key={cat}
            type="monotone"
            dataKey={cat}
            stackId="1"
            stroke={palette[i % palette.length]}
            fill={palette[i % palette.length]}
            fillOpacity={0.6}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
