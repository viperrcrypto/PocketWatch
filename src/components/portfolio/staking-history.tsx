"use client"

import { useMemo, useState, useEffect } from "react"
import { useStakingHistory } from "@/hooks/use-portfolio-tracker"
import { formatFiatValue } from "@/lib/portfolio/utils"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

// ─── Chart tooltip ───

interface TooltipEntry {
  dataKey: string
  name: string
  value: number
  color: string
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-card border border-card-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-foreground-muted mb-1">{label}</p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey}
          className="text-sm font-data tabular-nums"
          style={{ color: entry.color }}
        >
          {entry.name}: {formatFiatValue(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Year tab pill ───

function YearTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-foreground-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )
}

// ─── Stat card (minimal, inline) ───

function StatBox({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-background-secondary rounded-xl p-4">
      <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-lg font-semibold font-data tabular-nums text-foreground">
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-foreground-muted mt-0.5">{sub}</p>
      )}
    </div>
  )
}

// ─── Main modal component ───

export function YieldHistoryModal({ onClose }: { onClose: () => void }) {
  const currentYear = new Date().getUTCFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear - 1)
  const [rangeMode, setRangeMode] = useState<"year" | "ytd" | "all">("year")

  const { data, isLoading } = useStakingHistory(
    rangeMode === "year"
      ? { range: "year", year: selectedYear }
      : rangeMode === "ytd"
        ? { range: "ytd" }
        : { range: "all" },
  )

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const chartData = useMemo(() => {
    if (!data?.entries) return []
    let prevCumulative = 0
    return data.entries.map((e: any, idx: number) => {
      const cumulativeYield = Number(e.cumulativeYieldUsd ?? 0)
      const dailyEarned = idx === 0 ? 0 : cumulativeYield - prevCumulative
      prevCumulative = cumulativeYield
      return {
      date: new Date(e.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      cumulativeYield,
      dailyEarned,
      deposited: Number(e.depositedUsdCumulative ?? 0),
      withdrawn: Number(e.withdrawnUsdCumulative ?? 0),
      totalStaked: Number(e.totalStaked ?? 0),
      confidence: String(e.confidence ?? ""),
      }
    })
  }, [data])

  const availableYears = useMemo(
    () => (data?.availableYears ?? [currentYear, currentYear - 1]) as number[],
    [data, currentYear],
  )

  useEffect(() => {
    if (availableYears.length === 0) return
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  const yieldEarned = (data?.yieldEarned ?? 0) as number
  const avgApy = (data?.avgApyOverPeriod ?? 0) as number
  const entryCount = (data?.entries?.length ?? 0) as number
  const daysTracked = (data?.daysTracked ?? 0) as number
  const depositedUsd = (data?.depositedUsd ?? 0) as number
  const withdrawnUsd = (data?.withdrawnUsd ?? 0) as number
  const hasReliableHistory = useMemo(() => {
    if ((data as any)?.positionBased && (data?.yieldEarned ?? 0) !== 0) return true
    const entries = (data?.entries ?? []) as Array<{ confidence?: string }>
    const hasModeledOrExact = entries.some((e) => e.confidence === "modeled" || e.confidence === "exact")
    return hasModeledOrExact && depositedUsd > 0
  }, [data, depositedUsd, withdrawnUsd])

  const earliestDate = useMemo(() => {
    if (!data?.entries || data.entries.length === 0) return null
    const first = data.entries[0] as { date: string }
    return new Date(first.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }, [data])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="yield-history-title"
    >
      <div
        className="bg-card border border-card-border rounded-2xl max-w-3xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
              <span
                className="material-symbols-rounded text-success"
                style={{ fontSize: 20 }}
              >
                trending_up
              </span>
            </div>
            <div>
              <h2 id="yield-history-title" className="text-base font-semibold text-foreground">
                Yield History
              </h2>
              <p className="text-xs text-foreground-muted">
                Track your staking performance over time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground transition-colors p-1"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>

        {/* Year tabs */}
        <div className="px-6 pt-4">
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-1 bg-background-secondary rounded-lg p-1 w-max min-w-fit">
              {availableYears.map((year) => (
                <YearTab
                  key={year}
                  label={String(year)}
                  active={rangeMode === "year" && selectedYear === year}
                  onClick={() => {
                    setSelectedYear(year)
                    setRangeMode("year")
                  }}
                />
              ))}
              <YearTab
                label="YTD"
                active={rangeMode === "ytd"}
                onClick={() => setRangeMode("ytd")}
              />
              <YearTab
                label="All Time"
                active={rangeMode === "all"}
                onClick={() => setRangeMode("all")}
              />
            </div>
          </div>
          {earliestDate && (
            <p className="text-[10px] text-foreground-muted mt-2">
              History starts from {earliestDate}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="h-48 bg-background-secondary rounded-xl animate-pulse" />
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBox
                  label={`Yield Earned${
                    rangeMode === "year" ? ` in ${selectedYear}` : rangeMode === "ytd" ? " YTD" : ""
                  }`}
                  value={hasReliableHistory ? formatFiatValue(yieldEarned) : "Recomputing..."}
                  sub={
                    hasReliableHistory && yieldEarned > 0
                      ? `${daysTracked} day${daysTracked === 1 ? "" : "s"} tracked`
                      : undefined
                  }
                />
                <StatBox
                  label="Avg APY"
                  value={avgApy > 0 ? `${avgApy.toFixed(2)}%` : "\u2014"}
                />
                <StatBox
                  label="Days Tracked"
                  value={String(daysTracked)}
                />
                <StatBox
                  label="Deposited"
                  value={formatFiatValue(depositedUsd)}
                  sub={withdrawnUsd > 0 ? `Withdrawn ${formatFiatValue(withdrawnUsd)}` : undefined}
                />
              </div>
              {!hasReliableHistory && (
                <div className="bg-card border border-info/30 px-3 py-2 rounded-lg text-xs text-foreground-muted">
                  Yield history is still estimating from APY only. Run transaction history sync for accurate earned values.
                </div>
              )}

              {/* Chart */}
              {chartData.length > 1 && hasReliableHistory ? (
                <div className="bg-background-secondary rounded-xl p-5">
                  <p className="text-xs font-medium text-foreground-muted mb-4">
                    Yield Earned Over Time
                  </p>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer>
                      <AreaChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="modal-cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#34D399" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="modal-dailyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "var(--foreground-muted)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "var(--foreground-muted)" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="cumulativeYield"
                          name="Cumulative Earned"
                          stroke="#34D399"
                          strokeWidth={2}
                          fill="url(#modal-cumulativeGrad)"
                        />
                        <Area
                          type="monotone"
                          dataKey="dailyEarned"
                          name="Daily Earned"
                          stroke="#F59E0B"
                          strokeWidth={1.5}
                          fill="url(#modal-dailyGrad)"
                          yAxisId={0}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="bg-background-secondary rounded-xl p-8 text-center">
                  <span
                    className="material-symbols-rounded text-foreground-muted mb-2 block"
                    style={{ fontSize: 28 }}
                  >
                    show_chart
                  </span>
                  <p className="text-sm text-foreground-muted">
                    {entryCount === 0
                      ? ((data as any)?.positionBased
                        ? "Yield summary estimated from position records. Daily chart will appear as snapshots accumulate."
                        : "No history data yet. Hourly snapshots will appear after sync runs.")
                      : "Needs more data points to display a chart. Check back after a few more days."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
