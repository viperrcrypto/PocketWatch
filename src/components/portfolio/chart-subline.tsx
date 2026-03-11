"use client"

import { formatFiatValue } from "@/lib/portfolio/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import type { SyncStatusInfo } from "@/components/portfolio/sync-button"

export function ChartSubline({
  hoveredPoint,
  hoverDelta,
  periodChange,
  chartStats,
  timeframe,
  isHidden,
}: {
  hoveredPoint: { time: number; value: number } | null
  hoverDelta: { delta: number; pct: number; positive: boolean } | null
  periodChange: { delta: number; pct: number; positive: boolean } | null
  chartStats: { high: number; low: number; start: number; delta: number; pct: number } | null
  timeframe: string
  isHidden: boolean
}) {
  return (
    <>
      <div className="min-h-[24px] mt-2">
        {hoveredPoint ? (
          <div className="flex items-center gap-3">
            <p
              className="text-foreground-muted text-xs font-data"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {timeframe === "1D"
                ? new Date(hoveredPoint.time * 1000).toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric", year: "numeric",
                    hour: "2-digit", minute: "2-digit", hour12: true,
                  })
                : new Date(hoveredPoint.time * 1000).toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric", year: "numeric",
                    timeZone: "UTC",
                  })}
            </p>
            {hoverDelta && (
              <span className={`text-xs font-data ${hoverDelta.positive ? "text-success" : "text-error"}`}>
                {hoverDelta.positive ? "+" : ""}{formatFiatValue(hoverDelta.delta)} ({hoverDelta.positive ? "+" : ""}{hoverDelta.pct.toFixed(2)}%)
              </span>
            )}
          </div>
        ) : (
          periodChange && (
            <BlurredValue isHidden={isHidden}>
              <div className={`flex items-center gap-1.5 ${periodChange.positive ? "text-success" : "text-error"}`}>
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{periodChange.positive ? "trending_up" : "trending_down"}</span>
                <span className="font-data" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                  {`${periodChange.positive ? "+" : ""}${periodChange.pct.toFixed(2)}%`}
                </span>
                <span className="text-foreground-muted font-data text-xs">(</span>
                <span className="text-foreground-muted font-data" style={{ fontSize: 12 }}>
                  {`${periodChange.positive ? "+" : ""}${formatFiatValue(periodChange.delta)}`}
                </span>
                <span className="text-foreground-muted font-data text-xs">)</span>
              </div>
            </BlurredValue>
          )
        )}
      </div>
      {chartStats && !hoveredPoint && (
        <BlurredValue isHidden={isHidden}>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-foreground-muted font-data mb-2">
            <span>High {formatFiatValue(chartStats.high)}</span>
            <span>Low {formatFiatValue(chartStats.low)}</span>
            <span>
              Range {chartStats.start !== 0 ? `${chartStats.delta >= 0 ? "+" : ""}${chartStats.pct.toFixed(2)}%` : "--"}
            </span>
          </div>
        </BlurredValue>
      )}
    </>
  )
}

export function ChartEmptyState({
  syncStatus,
  timeframe,
  chartScope,
}: {
  syncStatus: SyncStatusInfo | null
  timeframe: string
  chartScope: string
}) {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center gap-2">
      {syncStatus?.active && syncStatus.variant === "info" ? (
        <>
          <span
            className="material-symbols-rounded text-2xl text-foreground-muted/40"
            style={{ animation: "spinnerRotate 1.5s linear infinite" }}
          >sync</span>
          <p className="text-foreground-muted text-sm">Building your portfolio chart...</p>
          <p className="text-foreground-muted/60 text-xs">This usually takes a minute on first sync.</p>
        </>
      ) : timeframe === "ALL" ? (
        <p className="text-foreground-muted text-sm">
          {chartScope === "total"
            ? "Total history is limited right now. Sync more transaction history for the full lifecycle view."
            : "Rebuilding on-chain lifecycle history. Recent balances are available now."}
        </p>
      ) : (
        <p className="text-foreground-muted text-sm">Not enough data to render chart yet.</p>
      )}
    </div>
  )
}
