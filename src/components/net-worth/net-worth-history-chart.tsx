"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"

const PortfolioLineChart = dynamic(
  () => import("@/components/portfolio/portfolio-line-chart").then((m) => m.PortfolioLineChart),
  { ssr: false, loading: () => <div className="h-[280px] animate-shimmer rounded-lg" /> }
)

interface HistoryPoint {
  date: string
  fiat: number
  crypto: number
  total: number
}

interface NetWorthHistoryChartProps {
  data: HistoryPoint[]
  height?: number
}

export function NetWorthHistoryChart({ data, height = 280 }: NetWorthHistoryChartProps) {
  const chartData = useMemo(
    () =>
      data.map((p) => ({
        time: Math.floor(new Date(p.date).getTime() / 1000) as any,
        value: p.total,
      })),
    [data]
  )

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center text-foreground-muted text-sm" style={{ height }}>
        Not enough history for chart
      </div>
    )
  }

  const first = chartData[0].value
  const last = chartData[chartData.length - 1].value
  const color = last >= first ? "positive" : "negative"

  return <PortfolioLineChart data={chartData} height={height} color={color} />
}
