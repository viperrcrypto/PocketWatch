"use client"

import { useState, useMemo, useCallback } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface BudgetEntry {
  id: string
  category: string
  spent: number
  monthlyLimit: number
  percentUsed: number
}

interface SpendingEntry {
  category: string
  avgMonthly: number
  suggested: number
}

interface BudgetDonutHeroProps {
  hasBudgets: boolean
  budgets?: BudgetEntry[]
  totalSpent?: number
  totalBudgeted?: number
  spendingCategories?: SpendingEntry[]
  totalAvgSpending?: number
  monthsAnalyzed?: number
  availableMonths?: string[]
  selectedMonth?: string | null
  onMonthChange?: (month: string | null) => void
}

const MAX_LEGEND_ITEMS = 8
const SIZE = 220
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = 98
const INNER_R = 70
const HOVER_EXPAND = 5
const GAP_DEG = 1.2 // gap between segments in degrees

/** Convert polar to cartesian for SVG arc commands */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/** Build an SVG arc path (annular sector) */
function arcPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startDeg: number, endDeg: number,
): string {
  const sweep = endDeg - startDeg
  const largeArc = sweep > 180 ? 1 : 0
  const oStart = polarToCartesian(cx, cy, outerR, startDeg)
  const oEnd = polarToCartesian(cx, cy, outerR, endDeg)
  const iStart = polarToCartesian(cx, cy, innerR, endDeg)
  const iEnd = polarToCartesian(cx, cy, innerR, startDeg)
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iStart.x} ${iStart.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${iEnd.x} ${iEnd.y}`,
    "Z",
  ].join(" ")
}

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export function BudgetDonutHero({
  hasBudgets,
  budgets = [],
  totalSpent = 0,
  totalBudgeted = 0,
  spendingCategories = [],
  totalAvgSpending = 0,
  monthsAnalyzed = 0,
  availableMonths = [],
  selectedMonth = null,
  onMonthChange,
}: BudgetDonutHeroProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const segments = useMemo(() => {
    if (hasBudgets) {
      return [...budgets]
        .filter((b) => b.spent > 0)
        .sort((a, b) => b.spent - a.spent)
        .map((b) => ({
          name: b.category,
          value: b.spent,
          limit: b.monthlyLimit,
          percent: b.percentUsed,
          hex: getCategoryMeta(b.category).hex,
        }))
    }
    return [...spendingCategories]
      .filter((c) => c.avgMonthly > 0)
      .sort((a, b) => b.avgMonthly - a.avgMonthly)
      .map((c) => {
        const total = totalAvgSpending || 1
        return {
          name: c.category,
          value: c.avgMonthly,
          limit: c.suggested,
          percent: (c.avgMonthly / total) * 100,
          hex: getCategoryMeta(c.category).hex,
        }
      })
  }, [hasBudgets, budgets, spendingCategories, totalAvgSpending])

  // Compute arc angles for each segment
  const arcs = useMemo(() => {
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
    const totalGap = segments.length * GAP_DEG
    const available = 360 - totalGap
    let cursor = 0
    return segments.map((seg) => {
      const sweep = (seg.value / total) * available
      const start = cursor + GAP_DEG / 2
      const end = start + sweep
      cursor = end + GAP_DEG / 2
      return { start, end }
    })
  }, [segments])

  const legendItems = segments.slice(0, MAX_LEGEND_ITEMS)
  const extraCount = Math.max(0, segments.length - MAX_LEGEND_ITEMS)
  const centerTotal = hasBudgets ? totalSpent : totalAvgSpending
  const centerLabel = hasBudgets
    ? `of ${formatCurrency(totalBudgeted, "USD", 0)}`
    : selectedMonth
      ? formatMonthLabel(selectedMonth)
      : "avg / month"

  const hoveredSegment = activeIndex != null ? segments[activeIndex] : null

  const onEnter = useCallback((i: number) => setActiveIndex(i), [])
  const onLeave = useCallback(() => setActiveIndex(null), [])

  if (segments.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
        <span
          className="material-symbols-rounded text-foreground-muted mb-2 block"
          style={{ fontSize: 40 }}
        >
          donut_large
        </span>
        <p className="text-sm text-foreground-muted">
          No spending data yet. Connect accounts to see your overview.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-card-border/50 bg-foreground/[0.02]">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>
            donut_large
          </span>
          Spending Overview
          {!hasBudgets && monthsAnalyzed != null && monthsAnalyzed > 0 && (
            availableMonths.length > 0 && onMonthChange ? (
              <div className="relative inline-flex items-center">
                <select
                  value={selectedMonth ?? ""}
                  onChange={(e) => onMonthChange(e.target.value || null)}
                  className="text-[9px] font-bold uppercase tracking-widest bg-foreground/[0.06] text-foreground-muted pl-2 pr-5 py-0.5 rounded-full border-none outline-none cursor-pointer hover:bg-foreground/[0.1] transition-colors appearance-none"
                >
                  <option value="">{monthsAnalyzed}-Mo Average</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                  ))}
                </select>
                <span className="material-symbols-rounded absolute right-1 pointer-events-none text-foreground-muted" style={{ fontSize: 12 }}>expand_more</span>
              </div>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-widest bg-foreground/[0.06] text-foreground-muted px-2 py-0.5 rounded-full">
                Spending Profile · {monthsAnalyzed}-mo history
              </span>
            )
          )}
        </h3>
      </div>

      {/* Body: donut + legend */}
      <div className="p-3 sm:p-5 flex flex-col md:flex-row items-center md:items-start gap-4 sm:gap-6">
        {/* SVG Donut */}
        <div className="relative flex-shrink-0 w-[160px] h-[160px] sm:w-[220px] sm:h-[220px]">
          <svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {/* Background track */}
            <circle
              cx={CX} cy={CY}
              r={(OUTER_R + INNER_R) / 2}
              fill="none"
              stroke="var(--card-border)"
              strokeWidth={OUTER_R - INNER_R}
              opacity={0.2}
            />
            {/* Segments */}
            {segments.map((seg, i) => {
              const isActive = activeIndex === i
              const isDimmed = activeIndex != null && !isActive
              const outerR = isActive ? OUTER_R + HOVER_EXPAND : OUTER_R
              const innerR = isActive ? INNER_R - 2 : INNER_R
              return (
                <path
                  key={seg.name}
                  d={arcPath(CX, CY, outerR, innerR, arcs[i].start, arcs[i].end)}
                  fill={seg.hex}
                  opacity={isDimmed ? 0.3 : 1}
                  style={{
                    cursor: "pointer",
                    transition: "opacity 0.2s ease, d 0.15s ease",
                  }}
                  onMouseEnter={() => onEnter(i)}
                  onMouseLeave={onLeave}
                />
              )
            })}
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black font-data tabular-nums text-foreground">
              {formatCurrency(hoveredSegment ? hoveredSegment.value : centerTotal, "USD", 0)}
            </span>
            <span className="text-[10px] text-foreground-muted font-bold uppercase tracking-widest max-w-[100px] text-center leading-tight">
              {hoveredSegment ? hoveredSegment.name : centerLabel}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full min-w-0 space-y-1">
          {legendItems.map((seg, i) => {
            const meta = getCategoryMeta(seg.name)
            const barPercent = hasBudgets
              ? Math.min(seg.percent, 100)
              : (seg.value / (segments[0]?.value || 1)) * 100
            const barColor = hasBudgets
              ? seg.percent >= 100
                ? "var(--error)"
                : seg.percent >= 80
                ? "var(--warning)"
                : meta.hex
              : meta.hex

            return (
              <div
                key={seg.name}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg cursor-default transition-colors",
                  activeIndex === i ? "bg-foreground/[0.04]" : "hover:bg-foreground/[0.02]",
                )}
                onMouseEnter={() => onEnter(i)}
                onMouseLeave={onLeave}
              >
                {/* Category icon */}
                <div
                  className="size-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${meta.hex}, color-mix(in srgb, ${meta.hex} 80%, #000))`,
                  }}
                >
                  <span
                    className="material-symbols-rounded text-white drop-shadow-sm"
                    style={{ fontSize: 16 }}
                  >
                    {meta.icon}
                  </span>
                </div>

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {seg.name}
                    </span>
                    <span className="text-xs font-black font-data tabular-nums text-foreground ml-2 flex-shrink-0">
                      {formatCurrency(seg.value, "USD", 0)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(barPercent, 2)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                  {hasBudgets && (
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-foreground-muted">
                        of {formatCurrency(seg.limit, "USD", 0)}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold tabular-nums",
                          seg.percent >= 100
                            ? "text-error"
                            : seg.percent >= 80
                            ? "text-warning"
                            : "text-foreground-muted",
                        )}
                      >
                        {Math.round(seg.percent)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {extraCount > 0 && (
            <a
              href="#category-breakdown"
              className="block text-[11px] text-primary font-bold px-3 py-1.5 hover:underline"
            >
              +{extraCount} more
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
