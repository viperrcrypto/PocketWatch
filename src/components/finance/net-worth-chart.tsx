"use client"

import { useRef, useState, useEffect, useMemo, useCallback } from "react"

interface NetWorthChartProps {
  data: Array<{ date: string; fiatNetWorth: number; totalNetWorth: number; annotation?: string }>
  range: "1w" | "1m" | "3m" | "6m" | "1y" | "all"
  height?: number
  color?: string
}

// ─── Format Helpers ────────────────────────────────────────────────────
function formatCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function formatTooltipValue(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

function formatDate(ts: number, range: string): string {
  const d = new Date(ts)
  if (range === "1w") {
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
  }
  if (range === "all" || range === "1y") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatTooltipDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  })
}

// ─── Build smooth SVG path using monotone cubic bezier ─────────────────
function buildSmoothPath(xs: number[], ys: number[]): string {
  const n = xs.length
  if (n === 0) return ""
  if (n === 1) return `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`

  const slopes: number[] = new Array(n).fill(0)
  const deltas: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i]
    deltas.push(dx === 0 ? 0 : (ys[i + 1] - ys[i]) / dx)
  }
  slopes[0] = deltas[0]
  slopes[n - 1] = deltas[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (deltas[i - 1] * deltas[i] <= 0) {
      slopes[i] = 0
    } else {
      slopes[i] = (deltas[i - 1] + deltas[i]) / 2
    }
  }

  let d = `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const segDx = (xs[i + 1] - xs[i]) / 3
    d += ` C${(xs[i] + segDx).toFixed(2)},${(ys[i] + slopes[i] * segDx).toFixed(2)} ${(xs[i + 1] - segDx).toFixed(2)},${(ys[i + 1] - slopes[i + 1] * segDx).toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1].toFixed(2)}`
  }
  return d
}

// ─── Component ─────────────────────────────────────────────────────────
export function NetWorthChart({ data, range, height = 300, color }: NetWorthChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<{ x: number; y: number; idx: number } | null>(null)

  // Increment on data change → used as React key to force remount (restarts animation)
  const animKeyRef = useRef(0)
  const animKey = useMemo(() => {
    animKeyRef.current += 1
    return animKeyRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Track whether initial mount animation is done (for pulsing dot)
  const prevDataRef = useRef(0)
  const drawDur = prevDataRef.current > 0 ? 1 : 1.6 // seconds
  const [dotVisible, setDotVisible] = useState(false)

  useEffect(() => {
    setDotVisible(false)
    const timer = setTimeout(() => {
      setDotVisible(true)
      prevDataRef.current = data?.length ?? 0
    }, drawDur * 1000)
    return () => clearTimeout(timer)
  }, [data, drawDur])

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    obs.observe(el)
    setWidth(el.clientWidth)
    return () => obs.disconnect()
  }, [])

  const points = useMemo(() => {
    if (!data || data.length === 0) return [] as Array<{ t: number; v: number; annotation?: string }>
    const mapped = data.map((d) => ({ t: new Date(d.date).getTime(), v: d.totalNetWorth, annotation: d.annotation }))
    // If only 1 data point, synthesize a second point at the start of the
    // range so the chart draws a flat line instead of showing nothing.
    if (mapped.length === 1) {
      const DAY_MS = 86_400_000
      const rangeMs = range === "1w" ? 7 * DAY_MS : range === "1m" ? 30 * DAY_MS
        : range === "3m" ? 90 * DAY_MS : range === "6m" ? 180 * DAY_MS
        : range === "1y" ? 365 * DAY_MS : 30 * DAY_MS
      return [{ t: mapped[0].t - rangeMs, v: mapped[0].v }, mapped[0]]
    }
    return mapped
  }, [data, range])

  const lineColor = useMemo(() => {
    if (color) return color
    if (points.length >= 2 && points[points.length - 1].v < points[0].v) return "#ef4444"
    return "#6366f1"
  }, [color, points])

  // ─── Layout ───
  const PAD = { top: 12, right: 28, bottom: 32, left: 56 }
  const chartW = Math.max(width - PAD.left - PAD.right, 0)
  const chartH = Math.max(height - PAD.top - PAD.bottom, 0)

  const tMin = points.length > 0 ? points[0].t : 0
  const tMax = points.length > 0 ? points[points.length - 1].t : 1
  const tRange = tMax - tMin || 1

  const allVals = points.map((p) => p.v)
  const rawMin = allVals.length > 0 ? Math.min(...allVals) : 0
  const rawMax = allVals.length > 0 ? Math.max(...allVals) : 1
  const valPad = Math.max((rawMax - rawMin) * 0.1, rawMax * 0.02, 100)
  const yMin = rawMin - valPad
  const yMax = rawMax + valPad
  const yRange = yMax - yMin || 1

  const sx = useCallback((t: number) => PAD.left + ((t - tMin) / tRange) * chartW, [tMin, tRange, chartW])
  const sy = useCallback((v: number) => PAD.top + (1 - (v - yMin) / yRange) * chartH, [yMin, yRange, chartH])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    if (mx < PAD.left || mx > PAD.left + chartW || my < PAD.top || my > PAD.top + chartH) {
      setHover(null)
      return
    }
    const targetT = tMin + ((mx - PAD.left) / chartW) * tRange
    let lo = 0, hi = points.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (points[mid].t < targetT) lo = mid + 1
      else hi = mid
    }
    const idx = lo > 0 && Math.abs(points[lo - 1].t - targetT) < Math.abs(points[lo].t - targetT) ? lo - 1 : lo
    setHover({ x: sx(points[idx].t), y: sy(points[idx].v), idx })
  }, [points, tMin, tRange, chartW, chartH, sx, sy])

  const handleMouseLeave = useCallback(() => setHover(null), [])

  if (points.length === 0 || chartW <= 0) {
    return (
      <div ref={containerRef} style={{ width: "100%", height }} className="flex items-center justify-center">
        <span className="text-xs text-foreground-muted">No data</span>
      </div>
    )
  }

  // ─── Build paths ───
  const pxX = points.map((p) => sx(p.t))
  const pxY = points.map((p) => sy(p.v))
  const linePath = buildSmoothPath(pxX, pxY)

  const areaPath = linePath
    + ` L${pxX[pxX.length - 1].toFixed(2)},${(PAD.top + chartH).toFixed(2)}`
    + ` L${pxX[0].toFixed(2)},${(PAD.top + chartH).toFixed(2)} Z`

  // When all values are identical (or nearly so), show fewer Y ticks to avoid repeated labels
  const isFlat = rawMax - rawMin < 1
  const yTicks = isFlat
    ? [{ y: PAD.top + chartH * 0.5, val: rawMin }]
    : [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
        y: PAD.top + pct * chartH,
        val: yMin + yRange * (1 - pct),
      }))

  // When time range is < 2 days (single data point padded), show just one x label
  const isSingleDay = tRange < 2 * 24 * 60 * 60 * 1000
  const xTickCount = isSingleDay ? 1 : Math.min(6, Math.max(3, Math.floor(chartW / 110)))
  const xTicks: Array<{ x: number; label: string }> = []
  if (isSingleDay) {
    xTicks.push({ x: sx(tMax), label: formatDate(tMax, "1m") })
  } else {
    for (let i = 0; i < xTickCount; i++) {
      const t = tMin + (tRange * i) / (xTickCount - 1)
      xTicks.push({ x: sx(t), label: formatDate(t, range) })
    }
  }

  const tooltipFlip = hover && hover.x > PAD.left + chartW * 0.6
  const lastX = pxX[pxX.length - 1]
  const lastY = pxY[pxY.length - 1]
  const ease = "cubic-bezier(0.25, 0.1, 0.25, 1)"

  return (
    <div ref={containerRef} style={{ width: "100%", height, position: "relative" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: hover ? "crosshair" : "default", display: "block" }}
      >
        <defs>
          <linearGradient id="nw-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.22} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* ── Axes ── */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="var(--card-border)" strokeWidth={0.5} />
        <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH} stroke="var(--card-border)" strokeWidth={0.5} />

        {/* ── Y grid + labels ── */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            {i > 0 && i < yTicks.length - 1 && (
              <line x1={PAD.left} y1={tick.y} x2={PAD.left + chartW} y2={tick.y} stroke="var(--card-border)" strokeWidth={0.5} strokeDasharray="3 6" opacity={0.4} />
            )}
            <text x={PAD.left - 8} y={tick.y + 4} textAnchor="end" style={{ fill: "var(--foreground-muted)", fontSize: 10, fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>
              {formatCompact(tick.val)}
            </text>
          </g>
        ))}

        {/* ── X labels ── */}
        {xTicks.map((tick, i) => (
          <text key={i} x={tick.x} y={PAD.top + chartH + 20} textAnchor="middle" style={{ fill: "var(--foreground-muted)", fontSize: 10, fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {tick.label}
          </text>
        ))}

        {/* ── Area fill — fades in with delay ── */}
        <path
          key={`area-${animKey}`}
          d={areaPath}
          fill="url(#nw-area-grad)"
          style={{
            opacity: 0,
            animation: `chart-area-fade ${drawDur * 0.5}s ${ease} ${drawDur * 0.5}s forwards`,
          }}
        />

        {/* ── Line — draws itself via strokeDashoffset ── */}
        <path
          key={`line-${animKey}`}
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          style={{
            animation: `chart-line-draw ${drawDur}s ${ease} forwards`,
          }}
        />

        {/* ── Pulsing dot — appears after draw completes ── */}
        {dotVisible && (
          <>
            <circle cx={lastX} cy={lastY} r={5} fill={lineColor} opacity={0.15}>
              <animate attributeName="r" values="5;9;5" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={lastX} cy={lastY} r={3} fill={lineColor} stroke="var(--card)" strokeWidth={1.5} />
          </>
        )}

        {/* ── Annotation markers — subtle dots for large swings ── */}
        {dotVisible && points.map((p, i) => p.annotation ? (
          <circle key={`ann-${i}`} cx={pxX[i]} cy={pxY[i]} r={3} fill="var(--foreground-muted)" opacity={0.35} style={{ cursor: "default" }}>
            <title>{p.annotation}</title>
          </circle>
        ) : null)}

        {/* ── Hover crosshair ── */}
        {hover && (
          <>
            <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={PAD.top + chartH} stroke="var(--foreground-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
            <line x1={PAD.left} y1={hover.y} x2={PAD.left + chartW} y2={hover.y} stroke="var(--foreground-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.2} />
            <circle cx={hover.x} cy={hover.y} r={5} fill={lineColor} opacity={0.25} />
            <circle cx={hover.x} cy={hover.y} r={3.5} fill={lineColor} stroke="var(--card)" strokeWidth={1.5} />
          </>
        )}
      </svg>

      {/* ── Tooltip ── */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg px-3 py-2 text-xs"
          style={{
            top: Math.max(0, hover.y - 58),
            left: tooltipFlip ? hover.x - 170 : hover.x + 14,
            backgroundColor: "var(--card)",
            border: "1px solid var(--card-border)",
            color: "var(--foreground)",
            boxShadow: "var(--shadow-lg)",
            backdropFilter: "blur(8px)",
            minWidth: 140,
          }}
        >
          <div style={{ color: "var(--foreground-muted)" }} className="mb-0.5">
            {formatTooltipDate(points[hover.idx].t)}
          </div>
          <div className="font-semibold tabular-nums text-sm" style={{ color: "var(--foreground)" }}>
            {formatTooltipValue(points[hover.idx].v)}
          </div>
          {points[hover.idx].annotation && (
            <div style={{ color: "var(--foreground-muted)", fontSize: 10, marginTop: 2 }}>
              {points[hover.idx].annotation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
