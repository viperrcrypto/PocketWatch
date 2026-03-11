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

// Chart color palettes
const COLOR_MAP = {
  neutral: {
    line: "#818cf8",
    areaTop: "rgba(129,140,248,0.28)",
    areaBottom: "rgba(129,140,248,0)",
    crosshair: "rgba(129,140,248,0.4)",
    crosshairHz: "rgba(129,140,248,0.15)",
  },
  positive: {
    line: "#4ade80",
    areaTop: "rgba(74,222,128,0.22)",
    areaBottom: "rgba(74,222,128,0)",
    crosshair: "rgba(74,222,128,0.4)",
    crosshairHz: "rgba(74,222,128,0.15)",
  },
  negative: {
    line: "#f87171",
    areaTop: "rgba(248,113,113,0.22)",
    areaBottom: "rgba(248,113,113,0)",
    crosshair: "rgba(248,113,113,0.4)",
    crosshairHz: "rgba(248,113,113,0.15)",
  },
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`
  if (price >= 100_000) return `$${(price / 1_000).toFixed(0)}K`
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function getThemeColors() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark"
  return {
    textColor: isDark ? "#4a4a5a" : "#86868B",
    gridColor: isDark ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.04)",
    labelBg: isDark ? "#1e1e2e" : "#F5F5F7",
    priceLabelColor: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
    crosshairMarkerBorder: isDark ? "#141419" : "#FFFFFF",
  }
}

function renderPriceLabels(chart: IChartApi, series: ISeriesApi<"Area">, data: ChartDataPoint[], isHidden?: boolean) {
  const container = chart.chartElement()?.closest(".portfolio-chart-container")
  if (!container) return

  container.querySelectorAll(".price-label-overlay").forEach((el) => el.remove())

  if (data.length < 2) return

  const min = Math.min(...data.map((d) => d.value))
  const max = Math.max(...data.map((d) => d.value))
  if (max === min) return

  const range = max - min
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
    label.textContent = formatPrice(price)
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
      lineWidth: 2,
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

    series.priceScale().applyOptions({
      scaleMargins: { top: 0.10, bottom: 0.10 },
    })

    if (data.length > 0) {
      const safeData = [...data].sort((a, b) => (a.time as number) - (b.time as number))
        .filter((p, i, arr) => i === 0 || (p.time as number) > (arr[i - 1].time as number))
      series.setData(safeData)
      chart.timeScale().fitContent()
      requestAnimationFrame(() => {
        renderPriceLabels(chart, series, safeData, isHidden)
      })
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        cancelAnimationFrame(rafRef.current)
        pendingPoint.current = null
        onCrosshairMoveRef.current?.(null)
        return
      }
      const dataPoint = param.seriesData.get(series)
      if (dataPoint && 'value' in dataPoint) {
        pendingPoint.current = { time: param.time as number, value: dataPoint.value }
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => {
          onCrosshairMoveRef.current?.(pendingPoint.current)
        })
      }
    })

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
