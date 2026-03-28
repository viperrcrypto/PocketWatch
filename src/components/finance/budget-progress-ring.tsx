"use client"

import { useMemo } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface BudgetSegment {
  category: string
  spent: number
  monthlyLimit: number
}

interface BudgetProgressRingProps {
  spent: number
  budget: number
  size?: number
  segments?: BudgetSegment[]
}

const GAP_DEG = 1.5

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcD(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const sweep = endDeg - startDeg
  const large = sweep > 180 ? 1 : 0
  const s = polarToXY(cx, cy, r, startDeg)
  const e = polarToXY(cx, cy, r, endDeg)
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

export function BudgetProgressRing({ spent, budget, size = 192, segments = [] }: BudgetProgressRingProps) {
  const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0

  const isOver = spent > budget
  const isWarning = percent >= 80 && !isOver

  // Build multi-colored arcs from budget segments
  const arcs = useMemo(() => {
    const validSegs = segments.filter((s) => s.spent > 0).sort((a, b) => b.spent - a.spent)
    if (validSegs.length === 0) return []
    const total = validSegs.reduce((s, seg) => s + seg.spent, 0) || 1
    const usedDegrees = percent / 100 * 360
    const totalGap = validSegs.length * GAP_DEG
    const available = usedDegrees - totalGap
    if (available <= 0) return []
    let cursor = 0
    return validSegs.map((seg) => {
      const sweep = (seg.spent / total) * available
      const start = cursor + GAP_DEG / 2
      const end = start + sweep
      cursor = end + GAP_DEG / 2
      const meta = getCategoryMeta(seg.category)
      const segOver = seg.spent > seg.monthlyLimit
      const segWarn = seg.spent / seg.monthlyLimit >= 0.8 && !segOver
      const color = segOver ? "var(--error)" : segWarn ? "var(--warning)" : meta.hex
      return { start, end, color }
    })
  }, [segments, percent])

  const r = 42
  const hasMultiColor = arcs.length > 1
  const fallbackColor = isOver ? "var(--error)" : isWarning ? "var(--warning)" : "var(--primary)"

  // Single-color fallback
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - percent / 100)

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        className="w-full h-full -rotate-90"
        viewBox="0 0 100 100"
      >
        {/* Track — thicker, more visible */}
        <circle
          cx="50" cy="50" r={r}
          fill="transparent"
          stroke="var(--background-secondary)"
          strokeWidth="8"
        />

        {hasMultiColor ? (
          // Multi-colored segments
          arcs.map((arc, i) => (
            <path
              key={i}
              d={arcD(50, 50, r, arc.start, arc.end)}
              fill="none"
              stroke={arc.color}
              strokeWidth="8"
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          ))
        ) : (
          // Single-color ring
          <circle
            cx="50" cy="50" r={r}
            fill="transparent"
            stroke={fallbackColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        )}
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span
          className="font-data font-black tabular-nums leading-none"
          style={{
            fontSize: size < 140 ? "clamp(14px,4vw,20px)" : "clamp(18px,3vw,26px)",
            color: isOver ? "var(--error)" : "var(--foreground)",
            letterSpacing: "-0.03em",
          }}
        >
          {formatCurrency(spent, "USD", 0)}
        </span>
        <span
          className="font-medium uppercase tracking-widest"
          style={{
            fontSize: size < 140 ? 8 : 9,
            color: "var(--foreground-muted)",
          }}
        >
          of {formatCurrency(budget, "USD", 0)}
        </span>
        {percent > 0 && (
          <span
            className={cn(
              "font-data text-[10px] font-bold tabular-nums mt-0.5",
              isOver ? "text-error" : isWarning ? "text-warning" : "text-primary"
            )}
          >
            {Math.round(percent)}%
          </span>
        )}
      </div>
    </div>
  )
}
