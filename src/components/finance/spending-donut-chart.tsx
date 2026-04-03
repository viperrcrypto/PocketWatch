"use client"

import { useState, useMemo, useRef, useCallback } from "react"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { formatCurrency, cn } from "@/lib/utils"

interface SpendingDonutChartProps {
  data: Array<{ category: string; amount: number }>
  height?: number
}

// ─── Geometry helpers ───

const SIZE = 200
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = 90
const INNER_R = 62
const HOVER_EXPAND = 6
const GAP_DEG = 1.5 // gap between slices in degrees
const MIN_ARC_DEG = 8 // minimum visible arc size for tiny categories

interface ArcSlice {
  category: string
  amount: number
  pct: number
  startAngle: number
  endAngle: number
  color: string
  index: number
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, innerR: number, outerR: number, startDeg: number, endDeg: number): string {
  const sweep = endDeg - startDeg
  if (sweep <= 0) return ""
  const largeArc = sweep > 180 ? 1 : 0

  const outerStart = polarToCartesian(cx, cy, outerR, startDeg)
  const outerEnd = polarToCartesian(cx, cy, outerR, endDeg)
  const innerStart = polarToCartesian(cx, cy, innerR, endDeg)
  const innerEnd = polarToCartesian(cx, cy, innerR, startDeg)

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ")
}

// ─── Legend stagger delays (after chart entrance) ───

const LEGEND_BASE_DELAY_MS = 600
const LEGEND_STAGGER_MS = 40

// ─── Component ───

const MAX_LEGEND_ITEMS = 7
const OTHER_THRESHOLD = 0.02 // categories under 2% get grouped

// Purpose-built spending palette — high contrast, no muddy neighbors
const SPENDING_PALETTE = [
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#10B981", // emerald
  "#8B5CF6", // violet
  "#EF4444", // red
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#84CC16", // lime
  "#F97316", // orange
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#A855F7", // purple
]

export function SpendingDonutChart({ data, height = 250 }: SpendingDonutChartProps) {
  useChartTheme() // keep subscription for theme changes
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; slice: ArcSlice } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Step 1: Merge duplicate category names (e.g. two "Uncategorized" entries)
  const mergedData = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of data) {
      map.set(d.category, (map.get(d.category) ?? 0) + d.amount)
    }
    return Array.from(map, ([category, amount]) => ({ category, amount }))
  }, [data])

  const total = useMemo(() => mergedData.reduce((sum, d) => sum + d.amount, 0), [mergedData])

  // Step 2: Consolidate small categories into "Other" for a cleaner chart
  const consolidatedData = useMemo(() => {
    if (total <= 0) return mergedData
    const sorted = [...mergedData].sort((a, b) => b.amount - a.amount)
    const top: typeof mergedData = []
    let otherTotal = 0

    for (const d of sorted) {
      if (top.length < MAX_LEGEND_ITEMS - 1 && d.amount / total >= OTHER_THRESHOLD) {
        top.push(d)
      } else {
        otherTotal += d.amount
      }
    }

    if (otherTotal > 0) {
      top.push({ category: "Other", amount: otherTotal })
    }
    return top
  }, [mergedData, total])

  const slices: ArcSlice[] = useMemo(() => {
    if (total <= 0) return []
    const totalGap = GAP_DEG * consolidatedData.length
    const available = 360 - totalGap

    // Calculate raw sweeps and enforce minimum arc size
    const rawSweeps = consolidatedData.map((d) => (d.amount / total) * available)
    const smallTotal = rawSweeps.reduce((sum, s) => (s < MIN_ARC_DEG ? MIN_ARC_DEG - s : 0) + sum, 0)
    const largeTotal = rawSweeps.reduce((sum, s) => (s >= MIN_ARC_DEG ? s : 0) + sum, 0)
    const shrinkRatio = largeTotal > 0 ? (largeTotal - smallTotal) / largeTotal : 1

    const sweeps = rawSweeps.map((s) =>
      s < MIN_ARC_DEG ? MIN_ARC_DEG : s * shrinkRatio
    )

    let cursor = 0
    return consolidatedData.map((d, i) => {
      const pct = d.amount / total
      const startAngle = cursor + GAP_DEG / 2
      const endAngle = startAngle + sweeps[i]
      cursor = endAngle + GAP_DEG / 2
      return {
        category: d.category,
        amount: d.amount,
        pct,
        startAngle,
        endAngle,
        color: SPENDING_PALETTE[i % SPENDING_PALETTE.length],
        index: i,
      }
    })
  }, [consolidatedData, total])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGPathElement>, slice: ArcSlice) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      slice,
    })
    setActiveIndex(slice.index)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
    setActiveIndex(null)
  }, [])

  // Center text — show active slice or total
  const centerAmount = activeIndex !== null && slices[activeIndex]
    ? slices[activeIndex].amount
    : total
  const centerLabel = activeIndex !== null && slices[activeIndex]
    ? slices[activeIndex].category
    : "total spent"

  return (
    <div>
      {/* Donut chart */}
      <div className="relative" style={{ height }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full h-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            {slices.map((slice) => (
              <filter key={`glow-${slice.index}`} id={`glow-${slice.index}`} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor={slice.color} floodOpacity="0.4" />
              </filter>
            ))}
          </defs>

          {/* Arc slices */}
          {slices.map((slice) => {
            const isActive = activeIndex === slice.index
            const dimmed = activeIndex !== null && !isActive
            // Compute midpoint angle for directional hover offset
            const midAngle = (slice.startAngle + slice.endAngle) / 2
            const midRad = ((midAngle - 90) * Math.PI) / 180
            const hoverOffset = isActive ? 4 : 0

            return (
              <path
                key={slice.index}
                d={arcPath(CX, CY, INNER_R, OUTER_R, slice.startAngle, slice.endAngle)}
                fill={slice.color}
                opacity={dimmed ? 0.35 : 1}
                filter={isActive ? `url(#glow-${slice.index})` : undefined}
                style={{
                  transform: `translate(${Math.cos(midRad) * hoverOffset}px, ${Math.sin(midRad) * hoverOffset}px)`,
                  transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, filter 0.2s ease",
                  cursor: "pointer",
                  animation: `donut-slice-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) ${slice.index * 60}ms both`,
                }}
                onMouseMove={(e) => handleMouseMove(e, slice)}
                onMouseLeave={handleMouseLeave}
              />
            )
          })}

          {/* Center text */}
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground font-data font-semibold"
            style={{
              fontSize: 22,
              transition: "all 0.2s ease",
              animation: "donut-center-in 0.5s ease 0.4s both",
            }}
          >
            {formatCurrency(centerAmount, "USD", 0)}
          </text>
          <text
            x={CX}
            y={CY + 14}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground-muted"
            style={{
              fontSize: 10,
              transition: "all 0.2s ease",
              animation: "donut-center-in 0.5s ease 0.5s both",
            }}
          >
            {centerLabel}
          </text>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: "translate(-50%, -100%)",
              animation: "tooltip-in 0.15s ease both",
            }}
          >
            <div className="bg-[var(--foreground)] text-[var(--background)] rounded-lg px-3 py-2 shadow-xl text-xs backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tooltip.slice.color }}
                />
                <span className="font-medium">{tooltip.slice.category}</span>
              </div>
              <div className="flex items-center justify-between gap-4 mt-1">
                <span className="font-data font-semibold text-sm">
                  {formatCurrency(tooltip.slice.amount)}
                </span>
                <span className="text-[var(--background)]/60 font-data">
                  {(tooltip.slice.pct * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            {/* Arrow */}
            <div className="flex justify-center -mt-px">
              <div
                className="w-2 h-2 rotate-45 bg-[var(--foreground)]"
                style={{ marginTop: -4 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="space-y-1.5 px-4 pb-4">
        {slices.map((slice) => {
          const isActive = activeIndex === slice.index
          const delayMs = LEGEND_BASE_DELAY_MS + slice.index * LEGEND_STAGGER_MS
          const pctDisplay = (slice.pct * 100).toFixed(1)
          return (
            <div
              key={slice.index}
              className={cn(
                "flex items-center gap-2.5 text-xs cursor-default rounded-lg px-2 py-1.5 -mx-2 transition-colors duration-200",
                isActive && "bg-foreground/[0.04]",
                activeIndex !== null && !isActive && "opacity-40"
              )}
              style={{ animationDelay: `${delayMs}ms` }}
              onMouseEnter={() => setActiveIndex(slice.index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-200"
                style={{
                  backgroundColor: slice.color,
                  transform: isActive ? "scale(1.3)" : "scale(1)",
                  boxShadow: isActive ? `0 0 6px ${slice.color}60` : "none",
                }}
              />
              <span className={cn(
                "flex-1 truncate transition-colors duration-200",
                isActive ? "text-foreground font-medium" : "text-foreground-muted"
              )}>
                {slice.category}
              </span>
              <span className="font-data text-foreground tabular-nums flex-shrink-0">
                {formatCurrency(slice.amount)}
              </span>
              <span className="font-data text-foreground-muted tabular-nums flex-shrink-0 w-10 text-right text-[10px]">
                {pctDisplay}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes donut-slice-in {
          from {
            opacity: 0;
            transform: scale(0.8);
            transform-origin: ${CX}px ${CY}px;
          }
          to {
            opacity: 1;
            transform: scale(1);
            transform-origin: ${CX}px ${CY}px;
          }
        }
        @keyframes donut-center-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tooltip-in {
          from {
            opacity: 0;
            transform: translate(-50%, -100%) translateY(4px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%) translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
