"use client"

import { useState, useMemo } from "react"
import { useSpendingByMonth } from "@/hooks/use-finance"
import { SpendingDonutChart } from "./spending-donut-chart"

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

export function SpendingMonthCard() {
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(
    undefined
  )
  const { data, isLoading } = useSpendingByMonth(selectedMonth)

  const available = data?.availableMonths ?? []
  const currentIndex = data?.month ? available.indexOf(data.month) : 0
  const canGoBack = available.length > 0 && currentIndex < available.length - 1
  const canGoForward = available.length > 0 && currentIndex > 0
  const isLatest = currentIndex === 0

  const goBack = () => {
    if (canGoBack) setSelectedMonth(available[currentIndex + 1])
  }
  const goForward = () => {
    if (canGoForward) setSelectedMonth(available[currentIndex - 1])
  }
  const goToLatest = () => setSelectedMonth(undefined)

  const donutData = useMemo(
    () =>
      (data?.categories ?? []).map((c) => ({
        category: c.category,
        amount: c.total,
      })),
    [data?.categories]
  )

  const monthLabel = data?.month ? formatMonthLabel(data.month) : ""
  const headerLabel = isLatest ? "Spending This Month" : monthLabel

  return (
    <div
      className="bg-card rounded-xl p-5"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          {headerLabel}
        </span>

        {available.length > 1 && (
          <div className="flex items-center gap-1">
            {/* Back arrow */}
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className="size-6 rounded-md flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-foreground/[0.06] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <span
                className="material-symbols-rounded"
                style={{ fontSize: 16 }}
              >
                chevron_left
              </span>
            </button>

            {/* Month label / Today link */}
            {isLatest ? (
              <span className="text-[10px] font-bold text-foreground-muted tabular-nums min-w-[80px] text-center">
                {monthLabel}
              </span>
            ) : (
              <button
                onClick={goToLatest}
                className="text-[10px] font-bold text-primary hover:underline min-w-[80px] text-center"
              >
                Today
              </button>
            )}

            {/* Forward arrow */}
            <button
              onClick={goForward}
              disabled={!canGoForward}
              className="size-6 rounded-md flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-foreground/[0.06] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <span
                className="material-symbols-rounded"
                style={{ fontSize: 16 }}
              >
                chevron_right
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Chart content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : donutData.length > 0 ? (
        <SpendingDonutChart data={donutData} />
      ) : (
        <p className="text-sm text-foreground-muted text-center py-12">
          No spending data{data?.month ? ` for ${formatMonthLabel(data.month)}` : " yet"}
        </p>
      )}
    </div>
  )
}
