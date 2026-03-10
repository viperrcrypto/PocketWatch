"use client"

import { useRef, useEffect, useCallback } from "react"
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type DeepPartial,
  type ChartOptions,
  type AreaSeriesPartialOptions,
  AreaSeries,
  ColorType,
  LineType,
  CrosshairMode,
} from "lightweight-charts"

interface ChartDataPoint {
  time: UTCTimestamp
  value: number
}

interface PortfolioLineChartProps {
  data: ChartDataPoint[]
  height?: number
  color?: "neutral" | "positive" | "negative"
  onCrosshairMove?: (point: { time: number; value: number } | null) => void
  onPointClick?: (point: { time: number; value: number }) => void
  isHidden?: boolean
  timeframe?: "ALL" | "1Y" | "3M" | "1W" | "1D"
}

// lightweight-charts needs resolved colors, not CSS vars
const COLOR_MAP = {
  neutral: {
    line: "#818cf8",
    areaTop: "rgba(129,140,248,0.36)",
    areaBottom: "rgba(129,140,248,0)",
    crosshair: "rgba(129,140,248,0.4)",
    crosshairHz: "rgba(129,140,248,0.15)",
  },
  positive: {
    line: "#34C759",
    areaTop: "rgba(52,199,89,0.32)",
    areaBottom: "rgba(52,199,89,0)",
    crosshair: "rgba(52,199,89,0.4)",
    crosshairHz: "rgba(52,199,89,0.15)",
  },
  negative: {
    line: "#FF3B30",
    areaTop: "rgba(255,59,48,0.32)",
    areaBottom: "rgba(255,59,48,0)",
    crosshair: "rgba(255,59,48,0.4)",
    crosshairHz: "rgba(255,59,48,0.15)",
  },
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`
  if (price >= 100_000) return `$${(price / 1_000).toFixed(0)}K`
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

/** Range-aware price formatter — prevents all labels from collapsing to "$177K" */
function formatPriceLabel(price: number, dataRange: number): string {
  if (price >= 1_000_000) {
    const m = price / 1_000_000
    if (dataRange < 40_000) return `$${m.toFixed(3)}M`
    if (dataRange < 400_000) return `$${m.toFixed(2)}M`
    return `$${m.toFixed(1)}M`
  }
  if (price >= 1_000) {
    const k = price / 1_000
    // step = dataRange / 4 → need enough decimals that ticks are distinguishable
    if (dataRange < 400) return `$${k.toFixed(2)}K`
    if (dataRange < 4_000) return `$${k.toFixed(1)}K`
    return `$${k.toFixed(0)}K`
  }
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function getThemeColors() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark"
  return {
    textColor: isDark ? "#8E8E93" : "#86868B",
    gridColor: isDark ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.04)",
    labelBg: isDark ? "#1C1C1E" : "#F5F5F7",
    priceLabelColor: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
    crosshairMarkerBorder: isDark ? "#1C1C1E" : "#FFFFFF",
  }
}

function renderPriceLabels(chart: IChartApi, series: ISeriesApi<"Area">, data: ChartDataPoint[], isHidden?: boolean) {
  const container = chart.chartElement()?.closest(".portfolio-chart-container")
  if (!container) return

  container.querySelectorAll(".price-label-overlay").forEach((el) => el.remove())

  if (data.length < 2) return

  let min = Infinity
  let max = -Infinity
  for (const d of data) {
    if (d.value < min) min = d.value
    if (d.value > max) max = d.value
  }
  const range = max - min
  if (max === min || (max > 0 && range / max < 0.001)) return

  const step = range / 4
  const ticks: number[] = []
  for (let i = 0; i <= 4; i++) {
    ticks.push(min + step * i)
  }

  const chartEl = chart.chartElement()
  if (!chartEl) return
  const chartRect = chartEl.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const theme = getThemeColors()

  for (const price of ticks) {
    const coord = series.priceToCoordinate(price)
    if (coord === null || coord < 0) continue

    const label = document.createElement("div")
    label.className = "price-label-overlay"
    label.textContent = formatPriceLabel(price, range)
    label.style.cssText = `
      position: absolute;
      right: 12px;
      top: ${coord + (chartRect.top - containerRect.top) - 7}px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      color: ${theme.priceLabelColor};
      pointer-events: none;
      z-index: 2;
      line-height: 1;
      ${isHidden ? "filter: blur(8px); user-select: none;" : ""}
    `
    container.appendChild(label)
  }
}

function formatTick(time: UTCTimestamp, timeframe: "ALL" | "1Y" | "3M" | "1W" | "1D"): string {
  const d = new Date(time * 1000)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  if (timeframe === "1D") {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    })
  }

  if (timeframe === "1W" || timeframe === "3M") {
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`
  }

  return `${months[d.getUTCMonth()]} '${d.getUTCFullYear().toString().slice(2)}`
}

export function PortfolioLineChart({
  data,
  height = 240,
  color = "neutral",
  onCrosshairMove,
  onPointClick,
  isHidden,
  timeframe = "ALL",
}: PortfolioLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const onCrosshairMoveRef = useRef(onCrosshairMove)
  onCrosshairMoveRef.current = onCrosshairMove
  const onPointClickRef = useRef(onPointClick)
  onPointClickRef.current = onPointClick
  const rafRef = useRef<number>(0)
  const pendingPoint = useRef<{ time: number; value: number } | null>(null)
  const mouseleaveHandlerRef = useRef<(() => void) | null>(null)

  const colors = COLOR_MAP[color]

  const initChart = useCallback(() => {
    if (!containerRef.current) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      seriesRef.current = null
    }

    const theme = getThemeColors()

    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: theme.textColor,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: theme.gridColor, style: 0 },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: colors.crosshair,
          width: 1,
          style: 0,
          labelBackgroundColor: theme.labelBg,
        },
        horzLine: {
          color: colors.crosshairHz,
          width: 1,
          style: 3,
          labelVisible: false,
        },
      },
      rightPriceScale: {
        visible: false,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: timeframe === "1D",
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 0,
        lockVisibleTimeRangeOnResize: true,
        // NOTE: The `shown` set and `lastCallMs` are captured in a closure created
        // by this IIFE. They are reset each time `initChart` runs (the whole chart is
        // rebuilt when data/timeframe changes), so stale-closure risk is tied to chart
        // recreation — not to React renders.
        tickMarkFormatter: (() => {
          let shown = new Set<string>()
          let lastCallMs = 0

          return (time: UTCTimestamp) => {
            if (!chartRef.current) return ""

            const now = performance.now()
            if (now - lastCallMs > 50) shown = new Set()
            lastCallMs = now

            const label = formatTick(time, timeframe)

            if (shown.has(label)) return ""
            shown.add(label)
            return label
          }
        })(),
      },
      handleScale: false,
      handleScroll: false,
      width: containerRef.current.clientWidth,
      height,
    }

    const chart = createChart(containerRef.current, chartOptions)
    chartRef.current = chart

    const areaOptions: AreaSeriesPartialOptions = {
      lineColor: colors.line,
      topColor: colors.areaTop,
      bottomColor: colors.areaBottom,
      lineWidth: 3,
      lineType: LineType.Curved,
      crosshairMarkerBackgroundColor: colors.line,
      crosshairMarkerBorderColor: theme.crosshairMarkerBorder,
      crosshairMarkerBorderWidth: 2,
      crosshairMarkerRadius: 5,
      lastValueVisible: false,
      priceLineVisible: false,
      priceScaleId: "overlay",
      priceFormat: {
        type: "custom",
        formatter: formatPrice,
      },
    }

    const series = chart.addSeries(AreaSeries, areaOptions)
    seriesRef.current = series

    // Dynamic scale margins: when data range is tiny relative to value,
    // compress the chart vertically so a $11 change in a $177K portfolio
    // doesn't look like a rollercoaster.
    let marginTop = 0.12
    let marginBottom = 0.05
    if (data.length >= 2) {
      let dataMin = Infinity
      let dataMax = -Infinity
      for (const d of data) {
        if (d.value < dataMin) dataMin = d.value
        if (d.value > dataMax) dataMax = d.value
      }
      const dataRange = dataMax - dataMin
      const absMax = Math.max(Math.abs(dataMin), Math.abs(dataMax))
      const rangePct = absMax > 0 ? dataRange / absMax : 0

      if (rangePct < 0.005) {
        // < 0.5% range — nearly flat, compress heavily
        marginTop = 0.38
        marginBottom = 0.38
      } else if (rangePct < 0.02) {
        // < 2% range — moderate compression
        marginTop = 0.28
        marginBottom = 0.22
      } else if (rangePct < 0.05) {
        // < 5% range — light compression
        marginTop = 0.18
        marginBottom = 0.10
      }
    }

    series.priceScale().applyOptions({
      scaleMargins: { top: marginTop, bottom: marginBottom },
    })

    if (data.length > 0) {
      // Defensive: ensure data is strictly ascending by time (lightweight-charts asserts this)
      const safeData = [...data].sort((a, b) => (a.time as number) - (b.time as number))
        .filter((p, i, arr) => i === 0 || (p.time as number) > (arr[i - 1].time as number))
      series.setData(safeData)
      chart.timeScale().fitContent()
      // Wait a frame for the chart to finish layout before rendering overlays
      requestAnimationFrame(() => {
        renderPriceLabels(chart, series, safeData, isHidden)
      })
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        // Clear immediately on mouse exit — no debounce
        cancelAnimationFrame(rafRef.current)
        pendingPoint.current = null
        onCrosshairMoveRef.current?.(null)
        return
      }
      const dataPoint = param.seriesData.get(series)
      if (dataPoint && 'value' in dataPoint) {
        // Use rAF to coalesce rapid moves into one render per frame
        pendingPoint.current = { time: param.time as number, value: dataPoint.value }
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => {
          onCrosshairMoveRef.current?.(pendingPoint.current)
        })
      }
    })

    // Clean up previous mouseleave listener before adding a new one
    if (mouseleaveHandlerRef.current) {
      containerRef.current.removeEventListener("mouseleave", mouseleaveHandlerRef.current)
    }
    const handleMouseLeave = () => {
      cancelAnimationFrame(rafRef.current)
      pendingPoint.current = null
      onCrosshairMoveRef.current?.(null)
    }
    mouseleaveHandlerRef.current = handleMouseLeave
    containerRef.current.addEventListener("mouseleave", handleMouseLeave)

    // Click handler — report the nearest data point to the click position
    chart.subscribeClick((param) => {
      if (!param.time || !param.seriesData.size) return
      const dp = param.seriesData.get(series)
      if (dp && "value" in dp) {
        onPointClickRef.current?.({ time: param.time as number, value: dp.value })
      }
    })
  }, [data, height, colors, isHidden, timeframe])

  useEffect(() => {
    initChart()
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (mouseleaveHandlerRef.current && containerRef.current) {
        containerRef.current.removeEventListener("mouseleave", mouseleaveHandlerRef.current)
        mouseleaveHandlerRef.current = null
      }
      // Clear hover state on unmount to prevent stale values
      onCrosshairMoveRef.current?.(null)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
      }
    }
  }, [initChart])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (chartRef.current) {
          chartRef.current.applyOptions({ width: entry.contentRect.width })
          chartRef.current.timeScale().fitContent()
          if (seriesRef.current && data.length > 0) {
            requestAnimationFrame(() => {
              if (chartRef.current && seriesRef.current) {
                renderPriceLabels(chartRef.current, seriesRef.current, data, isHidden)
              }
            })
          }
        }
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [data, isHidden])

  return (
    <div
      ref={containerRef}
      className="portfolio-chart-container"
      style={{ height, width: "100%", position: "relative" }}
    />
  )
}
