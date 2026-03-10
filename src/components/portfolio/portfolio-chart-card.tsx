"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

const DEFAULT_TIMEFRAMES = ["ALL", "1Y", "3M", "1W", "1D"]

interface PortfolioChartCardProps {
  title: string
  timeframes?: readonly string[]
  activeTimeframe?: string
  onTimeframeChange?: (tf: string) => void
  children: ReactNode
  isLoading?: boolean
  headerActions?: ReactNode
}

export function PortfolioChartCard({
  title,
  timeframes = DEFAULT_TIMEFRAMES,
  activeTimeframe,
  onTimeframeChange,
  children,
  isLoading,
  headerActions,
}: PortfolioChartCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <div className="h-3 w-24 animate-shimmer rounded mb-4" />
          <div className="h-10 w-48 animate-shimmer rounded mb-2" />
          <div className="h-4 w-32 animate-shimmer rounded" />
        </div>
        <div className="pb-3 h-60">
          <div className="w-full h-full animate-shimmer rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      {/* Header: title label + timeframe pills */}
      <div className="flex items-start justify-between px-6 pt-5 pb-0">
        <div>
          {title && (
            <span className="text-xs font-medium text-foreground-muted">
              {title}
            </span>
          )}
        </div>

        {/* Header actions + Timeframe pills */}
        <div className="flex items-center gap-3">
          {headerActions}
          {onTimeframeChange && (
            <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg">
              {timeframes.map((tf) => {
                const isActive = activeTimeframe === tf
                return (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => onTimeframeChange(tf)}
                    className={cn(
                      "px-3 py-1 text-[10px] font-medium rounded-md transition-all duration-150",
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "bg-transparent text-foreground-muted hover:text-foreground"
                    )}
                  >
                    {tf}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Children: value display + chart — full-bleed so chart reaches edges */}
      <div className="pb-0">
        {children}
      </div>
    </div>
  )
}
