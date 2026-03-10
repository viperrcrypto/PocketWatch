"use client"

import { useState } from "react"
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { formatCurrency, cn } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────────

interface Holding {
  institutionValue: number | null
  security: {
    name: string | null
    type: string | null
    sector: string | null
  } | null
}

interface Props {
  holdings: Holding[]
  totalValue: number
  compact?: boolean
}

type GroupMode = "type" | "sector"

// ─── Type Metadata ──────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  equity: { label: "Stocks", icon: "show_chart", color: "#6366f1" },
  etf: { label: "ETFs", icon: "analytics", color: "#06b6d4" },
  "mutual fund": { label: "Mutual Funds", icon: "pie_chart", color: "#8B5CF6" },
  "fixed income": { label: "Bonds", icon: "savings", color: "#10b981" },
  bond: { label: "Bonds", icon: "savings", color: "#10b981" },
  cash: { label: "Cash", icon: "payments", color: "#64748b" },
  cryptocurrency: { label: "Crypto", icon: "currency_bitcoin", color: "#f59e0b" },
  derivative: { label: "Derivatives", icon: "swap_horiz", color: "#ef4444" },
  loan: { label: "Loans", icon: "account_balance", color: "#78716c" },
  other: { label: "Other", icon: "category", color: "#a855f7" },
}

function getTypeMeta(type: string | null) {
  if (!type) return TYPE_META.other
  const key = type.toLowerCase()
  return TYPE_META[key] ?? TYPE_META.other
}

// ─── Active Shape Renderer ─────────────────────────────────────

interface ActiveShapeProps {
  cx: number; cy: number
  innerRadius: number; outerRadius: number
  startAngle: number; endAngle: number
  fill?: string
}

function renderActiveShape(props: ActiveShapeProps) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: `drop-shadow(0 2px 8px ${fill}40)`, transition: "all 0.3s ease" }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={innerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ transition: "all 0.3s ease" }}
      />
    </g>
  )
}

function renderCompactActiveShape(props: ActiveShapeProps) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 1}
        outerRadius={outerRadius + 2}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ transition: "all 0.3s ease" }}
      />
    </g>
  )
}

// ─── Component ──────────────────────────────────────────────────

export function InvestmentAllocationChart({ holdings, totalValue, compact = false }: Props) {
  const { palette } = useChartTheme()
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)
  const [groupMode, setGroupMode] = useState<GroupMode>("type")

  // Group holdings by type or sector
  const grouped = new Map<string, number>()
  for (const h of holdings) {
    if (h.institutionValue == null || h.institutionValue <= 0) continue
    const key = groupMode === "type"
      ? (h.security?.type?.toLowerCase() ?? "other")
      : (h.security?.sector ?? "Other")
    grouped.set(key, (grouped.get(key) ?? 0) + h.institutionValue)
  }

  // Sort by value descending, cap at 8 segments
  const segments = Array.from(grouped.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, value]) => ({
      key,
      label: groupMode === "type" ? (getTypeMeta(key).label) : key,
      value,
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))

  const colors = groupMode === "type"
    ? segments.map((s) => getTypeMeta(s.key).color)
    : segments.map((_, i) => palette[i % palette.length])

  const activeSegment = activeIndex != null ? segments[activeIndex] : null
  const centerAmount = activeSegment ? activeSegment.value : totalValue
  const centerLabel = activeSegment ? activeSegment.label : "total"

  if (segments.length === 0) return null

  const donutSize = compact ? 160 : 220
  const innerR = compact ? 46 : 62
  const outerR = compact ? 66 : 90

  return (
    <div className={cn("bg-card border border-card-border rounded-xl overflow-hidden", compact ? "p-4" : "p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={cn("font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>Asset Allocation</h3>
          {!compact && (
            <p className="text-[10px] text-foreground-muted mt-0.5">
              Portfolio breakdown by {groupMode}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 bg-background-secondary rounded-lg p-0.5">
          <button
            onClick={() => setGroupMode("type")}
            className={cn(
              "px-2 py-0.5 text-[10px] font-medium rounded-md transition-all duration-200",
              groupMode === "type"
                ? "bg-card text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            Type
          </button>
          <button
            onClick={() => setGroupMode("sector")}
            className={cn(
              "px-2 py-0.5 text-[10px] font-medium rounded-md transition-all duration-200",
              groupMode === "sector"
                ? "bg-card text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            Sector
          </button>
        </div>
      </div>

      <div className={cn("flex items-center", compact ? "flex-col gap-3" : "flex-col md:flex-row gap-6")}>
        {/* Donut */}
        <div className={cn("flex-shrink-0", compact ? "max-w-[200px] mx-auto" : "w-full md:w-[220px]")}>
          <ResponsiveContainer width="100%" height={donutSize}>
            <PieChart>
              <Pie
                data={segments}
                cx="50%"
                cy="50%"
                innerRadius={innerR}
                outerRadius={outerR}
                dataKey="value"
                nameKey="label"
                stroke="none"
                activeShape={compact ? renderCompactActiveShape : renderActiveShape}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(undefined)}
                animationBegin={0}
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {segments.map((entry, i) => (
                  <Cell
                    key={entry.key}
                    fill={colors[i]}
                    style={{ cursor: "pointer", transition: "opacity 0.2s ease" }}
                    opacity={activeIndex != null && activeIndex !== i ? 0.5 : 1}
                  />
                ))}
              </Pie>
              <text
                x="50%"
                y="46%"
                textAnchor="middle"
                className={cn("font-bold fill-foreground font-data", compact ? "text-sm" : "text-lg")}
                style={{ transition: "opacity 0.2s ease" }}
              >
                {formatCurrency(centerAmount, "USD", 0)}
              </text>
              <text
                x="50%"
                y={compact ? "60%" : "58%"}
                textAnchor="middle"
                className="text-[9px] fill-foreground-muted uppercase tracking-widest"
                style={{ transition: "opacity 0.2s ease" }}
              >
                {centerLabel}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend list — synced with chart hover */}
        <div className={cn("w-full", compact ? "space-y-1.5" : "flex-1 space-y-2.5")}>
          {segments.map((s, i) => {
            const isActive = activeIndex === i
            const meta = groupMode === "type" ? getTypeMeta(s.key) : null
            return (
              <div
                key={s.key}
                className={cn(
                  "flex items-center gap-2 rounded-lg transition-all duration-200 cursor-default",
                  compact ? "px-1 py-1 -mx-1" : "gap-3 px-2 py-1.5 -mx-2",
                  isActive ? "bg-background-secondary/60" : "hover:bg-background-secondary/30"
                )}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(undefined)}
              >
                {meta ? (
                  <span
                    className="material-symbols-rounded flex-shrink-0 transition-transform duration-200"
                    style={{
                      fontSize: compact ? 14 : 16,
                      color: colors[i],
                      transform: isActive ? "scale(1.15)" : "scale(1)",
                    }}
                  >
                    {meta.icon}
                  </span>
                ) : (
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colors[i] }}
                  />
                )}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-baseline justify-between">
                    <span className={cn(
                      "transition-colors duration-200 truncate",
                      compact ? "text-[11px]" : "text-xs",
                      isActive ? "text-foreground font-semibold" : "text-foreground"
                    )}>
                      {s.label}
                    </span>
                    <div className="flex items-baseline gap-1.5 ml-2 flex-shrink-0">
                      <span className={cn("text-foreground-muted font-data tabular-nums", compact ? "text-[9px]" : "text-[10px]")}>
                        {s.pct < 1 ? s.pct.toFixed(2) : s.pct.toFixed(1)}%
                      </span>
                      {!compact && (
                        <span className="text-xs font-semibold font-data tabular-nums text-foreground">
                          {formatCurrency(s.value, "USD", 0)}
                        </span>
                      )}
                    </div>
                  </div>
                  {!compact && (
                    <div className="h-1 bg-background-secondary rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${s.pct}%`,
                          backgroundColor: colors[i],
                          opacity: activeIndex != null && activeIndex !== i ? 0.4 : 1,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
