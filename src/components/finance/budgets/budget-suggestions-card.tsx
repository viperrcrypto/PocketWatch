"use client"

import { formatCurrency } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { useMemo, useRef, useCallback } from "react"

const MIN_SLICE_PERCENT = 2
const SIZE = 180
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER = 80
const INNER = 56
const GAP_DEG = 2

interface SuggestionEntry {
  category: string
  avgMonthly: number
  suggested: number
  monthsOfData: number
}

interface BudgetSuggestionsCardProps {
  suggestions: SuggestionEntry[]
  totalAvgSpending: number
  monthsAnalyzed: number
  availableMonths: string[]
  selectedMonth: string | null
  onMonthChange: (month: string | null) => void
}

interface SliceData {
  name: string
  value: number
  hex: string
  icon: string
  percent: number
}

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(startDeg: number, endDeg: number): string {
  const s1 = polarToCartesian(CX, CY, OUTER, startDeg)
  const e1 = polarToCartesian(CX, CY, OUTER, endDeg)
  const s2 = polarToCartesian(CX, CY, INNER, endDeg)
  const e2 = polarToCartesian(CX, CY, INNER, startDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return [
    `M ${s1.x} ${s1.y}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${e1.x} ${e1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${e2.x} ${e2.y}`,
    "Z",
  ].join(" ")
}

export function BudgetSuggestionsCard({
  suggestions,
  totalAvgSpending,
  monthsAnalyzed,
  availableMonths,
  selectedMonth,
  onMonthChange,
}: BudgetSuggestionsCardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const sorted = [...suggestions]
    .filter((s) => s.avgMonthly > 0)
    .sort((a, b) => b.avgMonthly - a.avgMonthly)

  const total = sorted.reduce((sum, s) => sum + s.avgMonthly, 0)

  const slices: SliceData[] = useMemo(() => {
    const main: SliceData[] = []
    let otherValue = 0
    for (const item of sorted) {
      const pct = total > 0 ? (item.avgMonthly / total) * 100 : 0
      if (pct >= MIN_SLICE_PERCENT) {
        const meta = getCategoryMeta(item.category)
        main.push({ name: item.category, value: item.avgMonthly, hex: meta.hex, icon: meta.icon, percent: pct })
      } else {
        otherValue += item.avgMonthly
      }
    }
    if (otherValue > 0) {
      main.push({
        name: "Other",
        value: otherValue,
        hex: "#94a3b8",
        icon: "more_horiz",
        percent: total > 0 ? (otherValue / total) * 100 : 0,
      })
    }
    return main
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted.map((s) => `${s.category}:${s.avgMonthly}`).join(), total])

  const paths = useMemo(() => {
    const result: { d: string; hex: string; idx: number }[] = []
    let cursor = 0
    const totalGap = GAP_DEG * slices.length
    const available = 360 - totalGap
    for (let i = 0; i < slices.length; i++) {
      const sweep = (slices[i].value / total) * available
      const start = cursor + GAP_DEG / 2
      const end = start + Math.max(sweep, 0.5)
      result.push({ d: arcPath(start, end), hex: slices[i].hex, idx: i })
      cursor += sweep + GAP_DEG
    }
    return result
  }, [slices, total])

  const highlight = useCallback((idx: number) => {
    const svg = svgRef.current
    const legend = legendRef.current
    if (!svg || !legend) return
    svg.querySelectorAll<SVGPathElement>("path[data-idx]").forEach((p) => {
      p.style.opacity = Number(p.dataset.idx) === idx ? "1" : "0.3"
    })
    legend.querySelectorAll<HTMLDivElement>("[data-lidx]").forEach((r) => {
      r.style.opacity = Number(r.dataset.lidx) === idx ? "1" : "0.5"
    })
  }, [])

  const clearHighlight = useCallback(() => {
    const svg = svgRef.current
    const legend = legendRef.current
    if (!svg || !legend) return
    svg.querySelectorAll<SVGPathElement>("path[data-idx]").forEach((p) => {
      p.style.opacity = "1"
    })
    legend.querySelectorAll<HTMLDivElement>("[data-lidx]").forEach((r) => {
      r.style.opacity = "1"
    })
    const tt = tooltipRef.current
    if (tt) tt.style.display = "none"
  }, [])

  const showTooltip = useCallback((e: React.MouseEvent, idx: number) => {
    const tt = tooltipRef.current
    const container = svgRef.current?.parentElement
    if (!tt || !container) return
    const rect = container.getBoundingClientRect()
    const s = slices[idx]
    tt.innerHTML = `<span style="font-weight:600">${s.name}</span><br/><span style="font-weight:900">${formatCurrency(s.value, "USD", 0)}</span> <span style="opacity:0.6">(${s.percent.toFixed(1)}%)</span>`
    tt.style.display = "block"
    tt.style.left = `${e.clientX - rect.left + 12}px`
    tt.style.top = `${e.clientY - rect.top - 10}px`
  }, [slices])

  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-card-border/50 bg-foreground/[0.02] flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>
            insights
          </span>
          Data-Driven Budget
        </h3>
        {availableMonths.length > 0 && (
          <div className="relative inline-flex items-center flex-shrink-0">
            <select
              value={selectedMonth ?? ""}
              onChange={(e) => onMonthChange(e.target.value || null)}
              className="text-[10px] font-semibold bg-foreground/[0.06] text-foreground-muted pl-2 pr-4 py-0.5 rounded-full border-none outline-none cursor-pointer hover:bg-foreground/[0.1] transition-colors appearance-none"
            >
              <option value="">{monthsAnalyzed} mo avg</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
            <span
              className="material-symbols-rounded absolute right-0.5 pointer-events-none text-foreground-muted"
              style={{ fontSize: 10 }}
            >
              expand_more
            </span>
          </div>
        )}
      </div>

      {/* Pie chart + legend */}
      <div className="flex-1 overflow-y-auto max-h-[480px] p-4">
        {slices.length === 0 ? (
          <div className="text-center py-8">
            <span
              className="material-symbols-rounded text-foreground-muted block mb-2"
              style={{ fontSize: 32 }}
            >
              pie_chart
            </span>
            <p className="text-xs text-foreground-muted">
              No spending data yet. Connect accounts to see suggestions.
            </p>
          </div>
        ) : (
          <>
            {/* Donut with center total */}
            <div className="relative flex justify-center" onMouseLeave={clearHighlight}>
              <svg
                ref={svgRef}
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.06))" }}
              >
                {paths.map((p) => (
                  <path
                    key={p.idx}
                    d={p.d}
                    fill={p.hex}
                    data-idx={p.idx}
                    style={{ transition: "opacity 0.2s ease", cursor: "pointer" }}
                    onMouseEnter={(e) => { highlight(p.idx); showTooltip(e, p.idx) }}
                    onMouseMove={(e) => showTooltip(e, p.idx)}
                    onMouseLeave={clearHighlight}
                  />
                ))}
              </svg>
              {/* Center total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-data text-lg font-black text-foreground tabular-nums" style={{ letterSpacing: "-0.03em" }}>
                  {formatCurrency(total, "USD", 0)}
                </span>
                <span className="text-[9px] text-foreground-muted uppercase tracking-wider font-medium">/month</span>
              </div>
              <div
                ref={tooltipRef}
                className="absolute pointer-events-none bg-card border border-card-border rounded-lg px-3 py-1.5 shadow-lg text-[11px] text-foreground z-10"
                style={{ display: "none" }}
              />
            </div>

            {/* Legend — category rows with icon + bar */}
            <div ref={legendRef} className="mt-4 space-y-1.5">
              {slices.map((item, idx) => {
                const barWidth = total > 0 ? (item.value / total) * 100 : 0
                return (
                  <div
                    key={item.name}
                    data-lidx={idx}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-background-secondary/30 cursor-default"
                    style={{ transition: "opacity 0.2s ease" }}
                    onMouseEnter={() => highlight(idx)}
                    onMouseLeave={clearHighlight}
                  >
                    <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 14, color: item.hex }}>
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-medium text-foreground truncate">{item.name}</span>
                        <span className="text-[11px] font-bold font-data tabular-nums text-foreground flex-shrink-0 ml-2">
                          {formatCurrency(item.value, "USD", 0)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-background-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: item.hex }}
                        />
                      </div>
                    </div>
                    <span className="text-[9px] font-data tabular-nums text-foreground-muted/60 flex-shrink-0 w-8 text-right">
                      {item.percent.toFixed(0)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {slices.length > 0 && (
        <div className="px-5 py-3 border-t border-card-border/50 flex items-center justify-between">
          <span className="text-xs font-black text-foreground tabular-nums font-data">
            Total: {formatCurrency(totalAvgSpending, "USD", 0)}/mo
          </span>
          <span className="text-[10px] text-foreground-muted font-medium">
            Based on {monthsAnalyzed} mo spending
          </span>
        </div>
      )}
    </div>
  )
}
