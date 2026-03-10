"use client"

import dynamic from "next/dynamic"
import { TextMorph } from "torph/react"
import { PortfolioChartCard } from "@/components/portfolio/portfolio-chart-card"
import { PrivacyToggle } from "@/components/portfolio/privacy-toggle"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { ChartSubline, ChartEmptyState } from "@/components/portfolio/chart-subline"
import { formatFiatValue } from "@/lib/portfolio/utils"
import type { TIMEFRAMES, CHART_SCOPES } from "@/lib/portfolio/overview-helpers"
import type { SyncStatusInfo } from "@/components/portfolio/sync-button"
import type { UTCTimestamp } from "lightweight-charts"

const PortfolioLineChart = dynamic(
  () => import("@/components/portfolio/portfolio-line-chart").then((m) => ({ default: m.PortfolioLineChart })),
  { ssr: false, loading: () => <div className="h-[240px] bg-card-border/20 animate-pulse rounded-xl" /> },
)

export interface ChartHeroSectionProps {
  timeframes: typeof TIMEFRAMES
  timeframe: (typeof TIMEFRAMES)[number]
  onTimeframeChange: (tf: string) => void
  chartScopes: typeof CHART_SCOPES
  chartScope: (typeof CHART_SCOPES)[number]
  onChartScopeChange: (scope: (typeof CHART_SCOPES)[number]) => void
  isLoading: boolean
  headlineLoading: boolean
  isHidden: boolean
  togglePrivacy: () => void
  chartDisplayValue: number
  hoveredPoint: { time: number; value: number } | null
  onCrosshairMove: (point: { time: number; value: number } | null) => void
  onPointClick?: (point: { time: number; value: number }) => void
  periodChange: { delta: number; pct: number; positive: boolean } | null
  hoverDelta: { delta: number; pct: number; positive: boolean } | null
  chartData: { time: UTCTimestamp; value: number; source?: string }[]
  chartColor: "neutral" | "positive" | "negative"
  chartStats: { high: number; low: number; start: number; end: number; delta: number; pct: number } | null
  historyWarning: string | null
  syncStatus: SyncStatusInfo | null
}

export function ChartHeroSection({
  timeframes, timeframe, onTimeframeChange,
  chartScopes, chartScope, onChartScopeChange,
  isLoading, headlineLoading, isHidden, togglePrivacy,
  chartDisplayValue, hoveredPoint, onCrosshairMove, onPointClick,
  periodChange, hoverDelta, chartData, chartColor,
  chartStats, historyWarning, syncStatus,
}: ChartHeroSectionProps) {
  const isHovering = hoveredPoint !== null

  return (
    <PortfolioChartCard
      title="NET WORTH"
      timeframes={timeframes}
      activeTimeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      isLoading={isLoading}
      headerActions={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg">
            {chartScopes.map((scope) => {
              const active = chartScope === scope
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() => onChartScopeChange(scope)}
                  className={active
                    ? "px-2.5 py-1 text-[10px] font-medium rounded-md bg-primary text-white"
                    : "px-2.5 py-1 text-[10px] font-medium rounded-md text-foreground-muted hover:text-foreground"}
                >
                  {scope === "total" ? "TOTAL" : "ON-CHAIN"}
                </button>
              )
            })}
          </div>
          <PrivacyToggle isHidden={isHidden} onToggle={togglePrivacy} />
        </div>
      }
    >
      {historyWarning && (
        <div className="px-6 pb-2">
          <p className="text-[11px] text-warning">{historyWarning}</p>
        </div>
      )}

      <div className="mb-1 px-6">
        {headlineLoading ? (
          <div className="h-12 w-48 animate-shimmer rounded-lg" />
        ) : (
          <>
            {isHovering ? (
              <BlurredValue isHidden={isHidden}>
                <span
                  className="text-foreground font-data"
                  style={{ fontSize: 36, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}
                >
                  {formatFiatValue(hoveredPoint!.value)}
                </span>
              </BlurredValue>
            ) : (
              <BlurredValue isHidden={isHidden}>
                <TextMorph
                  className="text-foreground font-data"
                  style={{ fontSize: 36, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}
                  duration={600}
                  ease="cubic-bezier(0.19, 1, 0.22, 1)"
                >
                  {formatFiatValue(chartDisplayValue)}
                </TextMorph>
              </BlurredValue>
            )}
            <ChartSubline
              hoveredPoint={hoveredPoint}
              hoverDelta={hoverDelta}
              periodChange={periodChange}
              chartStats={chartStats}
              timeframe={timeframe}
              isHidden={isHidden}
            />
          </>
        )}
      </div>

      {chartData.length > 1 ? (
        <PortfolioLineChart
          data={chartData}
          height={240}
          color={chartColor}
          onCrosshairMove={onCrosshairMove}
          onPointClick={onPointClick}
          isHidden={isHidden}
          timeframe={timeframe}
        />
      ) : !isLoading ? (
        <ChartEmptyState syncStatus={syncStatus} timeframe={timeframe} chartScope={chartScope} />
      ) : null}
    </PortfolioChartCard>
  )
}
