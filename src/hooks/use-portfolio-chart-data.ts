/**
 * Chart-related derived hooks for the portfolio dashboard.
 */

import { useMemo } from "react"
import type { UTCTimestamp } from "lightweight-charts"
import {
  parseSnapshotData,
  type ChartScope,
} from "@/lib/portfolio/overview-helpers"

export function useChartData(
  netValue: any,
  chartScope: ChartScope,
  totalValue: number,
  onchainValue: number,
) {
  return useMemo(() => {
    const parsed = parseSnapshotData(netValue)
    const byTime = new Map<number, { time: UTCTimestamp; value: number; source?: string }>()

    for (const point of parsed) {
      if (!Number.isFinite(point.time) || !Number.isFinite(point.value) || point.value <= 0) continue
      byTime.set(point.time, point)
    }

    const liveAnchor = chartScope === "total" ? totalValue : onchainValue
    if (Number.isFinite(liveAnchor) && liveAnchor > 0) {
      const nowSec = (Math.floor(Date.now() / 60_000) * 60) as UTCTimestamp
      const points = Array.from(byTime.values()).sort((a, b) => a.time - b.time)
      const latest = points[points.length - 1]
      const drift = !latest || (Math.abs(latest.value - liveAnchor) / Math.max(liveAnchor, 1)) > 0.01
      const stale = !latest || (nowSec - latest.time) > (15 * 60)

      if (drift || stale) {
        byTime.set(nowSec, { time: nowSec, value: liveAnchor, source: "live_refresh" })
      }
    }

    return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
  }, [netValue, chartScope, totalValue, onchainValue])
}

export function usePeriodChange(chartData: { time: UTCTimestamp; value: number }[]) {
  return useMemo(() => {
    if (chartData.length < 2) return null
    const first = chartData[0].value
    const last = chartData[chartData.length - 1].value
    const delta = last - first
    const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0
    return { delta, pct, positive: delta >= 0 }
  }, [chartData])
}

export function useChartStats(chartData: { time: UTCTimestamp; value: number }[]) {
  return useMemo(() => {
    if (chartData.length === 0) return null
    const values = chartData.map((point) => point.value)
    const high = Math.max(...values)
    const low = Math.min(...values)
    const start = chartData[0].value
    const end = chartData[chartData.length - 1].value
    const delta = end - start
    const pct = start !== 0 ? (delta / Math.abs(start)) * 100 : 0
    return { high, low, start, end, delta, pct }
  }, [chartData])
}

export function useHoverDelta(
  hoveredPoint: { time: number; value: number } | null,
  chartData: { time: UTCTimestamp; value: number }[],
) {
  return useMemo(() => {
    if (!hoveredPoint || chartData.length === 0) return null
    const start = chartData[0].value
    const delta = hoveredPoint.value - start
    const pct = start !== 0 ? (delta / Math.abs(start)) * 100 : 0
    return { delta, pct, positive: delta >= 0 }
  }, [hoveredPoint, chartData])
}

export function useChange24h(netValue1D: any, totalValue: number, isPartialFetch?: boolean) {
  return useMemo(() => {
    const parsed = parseSnapshotData(netValue1D)
    if (parsed.length < 2) return null

    const byTime = new Map<number, { time: UTCTimestamp; value: number }>()
    for (const point of parsed) {
      if (!Number.isFinite(point.time) || !Number.isFinite(point.value) || point.value <= 0) continue
      byTime.set(point.time, { time: point.time, value: point.value })
    }

    const points = Array.from(byTime.values()).sort((a, b) => a.time - b.time)
    if (points.length < 2) return null

    const first = points[0].value
    const chartLast = points[points.length - 1].value
    // When partial fetch occurs, totalValue may be artificially low (only some wallets).
    // Use the chart's last point as a more reliable "current" value in that case.
    const last = isPartialFetch ? chartLast : (totalValue > 0 ? totalValue : chartLast)
    const delta = last - first
    const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0
    return { delta, pct, positive: delta >= 0 }
  }, [netValue1D, totalValue, isPartialFetch])
}

export function useHistoryWarning(chartMeta: any, chartScope: ChartScope) {
  return useMemo(() => {
    if (!chartMeta) return null
    if (chartMeta.status === "syncing" && chartScope === "onchain") {
      return "On-chain history sync is still running. Pre-coverage points are hidden until data is complete."
    }
    if (chartMeta.warningCode === "total_sparse_history" && chartScope === "total") {
      return "Historical total is limited; sync more transaction history for the full lifecycle view."
    }
    if (chartMeta.warningCode === "onchain_missing_coverage" && chartScope === "onchain") {
      return "Not enough trusted on-chain history yet for older dates."
    }
    return null
  }, [chartMeta, chartScope])
}
