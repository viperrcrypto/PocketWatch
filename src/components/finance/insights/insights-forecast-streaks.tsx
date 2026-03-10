"use client"

import { formatCurrency, cn } from "@/lib/utils"

export function InsightsForecastStreaks({ forecast, streaks }: { forecast: any; streaks: any }) {
  if (!forecast && !streaks) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Cash Flow Forecast */}
      {forecast && (
        <div className="bg-card border border-card-border rounded-xl p-6">
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Cash Flow Forecast
          </span>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Projected Income</span>
              <span className="font-data text-sm font-medium text-success tabular-nums">
                +{formatCurrency(forecast.projectedIncome)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Projected Spending</span>
              <span className="font-data text-sm font-medium text-error tabular-nums">
                -{formatCurrency(forecast.projectedSpending)}
              </span>
            </div>
            <div className="border-t border-card-border pt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Net Cash Flow</span>
              <span className={cn(
                "font-data text-sm font-bold tabular-nums",
                forecast.projectedNetCashFlow >= 0 ? "text-success" : "text-error"
              )}>
                {forecast.projectedNetCashFlow >= 0 ? "+" : ""}{formatCurrency(forecast.projectedNetCashFlow)}
              </span>
            </div>
            <div className="bg-primary/5 rounded-lg p-3 mt-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>
                  lightbulb
                </span>
                <span className="text-xs text-foreground">
                  Safe daily spend: <strong className="font-data tabular-nums">{formatCurrency(forecast.safeDailySpend)}</strong> for the remaining {forecast.daysRemaining} days
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spending Streaks */}
      {streaks && (
        <div className="bg-card border border-card-border rounded-xl p-6">
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Spending Streaks
          </span>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <span className="text-3xl font-data font-bold text-foreground tabular-nums">
                {streaks.noSpendDays}
              </span>
              <span className="text-[10px] text-foreground-muted block mt-1 uppercase tracking-wider">
                No-Spend Days
              </span>
            </div>
            <div className="text-center">
              <span className="text-3xl font-data font-bold text-foreground tabular-nums">
                {streaks.longestNoSpendStreak}
              </span>
              <span className="text-[10px] text-foreground-muted block mt-1 uppercase tracking-wider">
                Longest Streak
              </span>
            </div>
            <div className="text-center">
              <span className="text-3xl font-data font-bold text-foreground tabular-nums">
                {streaks.noSpendRate}%
              </span>
              <span className="text-[10px] text-foreground-muted block mt-1 uppercase tracking-wider">
                No-Spend Rate
              </span>
            </div>
            <div className="text-center">
              <span className="text-3xl font-data font-bold text-foreground tabular-nums">
                {streaks.totalDays}
              </span>
              <span className="text-[10px] text-foreground-muted block mt-1 uppercase tracking-wider">
                Days Tracked
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
