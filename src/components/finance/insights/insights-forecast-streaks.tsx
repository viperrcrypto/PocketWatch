"use client"

import { formatCurrency, cn } from "@/lib/utils"

const grad = (v: string) => `linear-gradient(90deg, var(--${v}), color-mix(in srgb, var(--${v}) 70%, #000))`
const grad135 = (c: string) => `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 80%, #000))`

export function InsightsForecastStreaks({ forecast, streaks }: { forecast: any; streaks: any }) {
  if (!forecast && !streaks) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Cash Flow Forecast */}
      {forecast && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-card-border/50 flex items-center gap-2">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>account_balance</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              Cash Flow Forecast
            </span>
          </div>
          <div className="p-5">
            {/* Net cash flow hero with glow */}
            <div className="text-center mb-5 relative">
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-[0.035]"
                style={{
                  background: `radial-gradient(circle, ${forecast.projectedNetCashFlow >= 0 ? "var(--success)" : "var(--error)"} 0%, transparent 70%)`
                }}
              />
              <p className="text-[10px] text-foreground-muted uppercase tracking-wider mb-1 relative">
                Projected Net Cash Flow
              </p>
              <p className={cn(
                "font-data text-3xl font-bold tabular-nums relative",
                forecast.projectedNetCashFlow >= 0 ? "text-success" : "text-error"
              )}>
                {forecast.projectedNetCashFlow >= 0 ? "+" : ""}{formatCurrency(forecast.projectedNetCashFlow)}
              </p>
            </div>

            {/* Income vs Spending visual bar */}
            <div className="space-y-2 mb-4">
              <FlowBar
                label="Income"
                amount={forecast.projectedIncome}
                maxAmount={Math.max(forecast.projectedIncome, forecast.projectedSpending)}
                type="income"
                prefix="+"
              />
              <FlowBar
                label="Spending"
                amount={forecast.projectedSpending}
                maxAmount={Math.max(forecast.projectedIncome, forecast.projectedSpending)}
                type="spending"
                prefix="-"
              />
            </div>

            {/* Safe daily spend callout */}
            <div className="relative rounded-xl p-3.5 flex items-center gap-3 bg-background-secondary/60 border-l-[3px] border-primary">
              <span className="material-symbols-rounded text-primary flex-shrink-0" style={{ fontSize: 20 }}>wallet</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">
                  Safe daily spend: <span className="font-data font-bold tabular-nums text-primary">{formatCurrency(forecast.safeDailySpend)}</span>
                </p>
                <p className="text-[10px] text-foreground-muted mt-0.5">
                  {forecast.daysRemaining} days remaining this month
                </p>
                {/* Days remaining progress bar */}
                <div className="h-1 rounded-full bg-background-secondary mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((30 - forecast.daysRemaining) / 30) * 100))}%`,
                      background: grad("primary")
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spending Streaks */}
      {streaks && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-card-border/50 flex items-center gap-2">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>local_fire_department</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              Spending Streaks
            </span>
          </div>
          <div className="p-5">
            {/* No-spend rate hero with glow */}
            <div className="text-center mb-5 relative">
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-[0.035]"
                style={{
                  background: `radial-gradient(circle, ${streaks.noSpendRate >= 30 ? "var(--success)" : streaks.noSpendRate >= 15 ? "var(--primary)" : "var(--warning)"} 0%, transparent 70%)`
                }}
              />
              <p className="text-[10px] text-foreground-muted uppercase tracking-wider mb-1 relative">No-Spend Rate</p>
              <p className={cn(
                "font-data text-3xl font-bold tabular-nums relative",
                streaks.noSpendRate >= 30 ? "text-success" : streaks.noSpendRate >= 15 ? "text-foreground" : "text-warning"
              )}>
                {streaks.noSpendRate}%
              </p>
            </div>

            {/* Visual progress bar — thicker with gradient */}
            <div className="h-3 rounded-full bg-background-secondary overflow-hidden mb-5">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${Math.min(streaks.noSpendRate, 100)}%`,
                  background: grad(streaks.noSpendRate >= 30 ? "success" : streaks.noSpendRate >= 15 ? "primary" : "warning")
                }}
              />
            </div>

            {/* Streak stats */}
            <div className="grid grid-cols-3 gap-3">
              <StreakStat value={streaks.noSpendDays} label="No-Spend Days" icon="event_available" color="var(--success)" />
              <StreakStat value={streaks.longestNoSpendStreak} label="Best Streak" icon="emoji_events" color="var(--warning)" />
              <StreakStat value={streaks.totalDays} label="Days Tracked" icon="calendar_month" color="var(--primary)" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FlowBar({ label, amount, maxAmount, type, prefix }: {
  label: string; amount: number; maxAmount: number; type: "income" | "spending"; prefix: string
}) {
  const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0
  const key = type === "income" ? "success" : "error"
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-foreground-muted">{label}</span>
        <span className={cn("font-data text-sm font-semibold tabular-nums", type === "income" ? "text-success" : "text-error")}>
          {prefix}{formatCurrency(amount)}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-background-secondary overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: grad(key) }} />
      </div>
    </div>
  )
}

function StreakStat({ value, label, icon, color }: {
  value: number; label: string; icon: string; color: string
}) {
  return (
    <div
      className="text-center p-3 rounded-xl bg-background-secondary/40 border-t-2 transition-transform duration-200 hover:scale-[1.04]"
      style={{ borderTopColor: color }}
    >
      <span className="material-symbols-rounded mx-auto mb-2 block" style={{ fontSize: 20, color }}>{icon}</span>
      <span className="font-data text-xl font-bold text-foreground tabular-nums block">{value}</span>
      <span className="text-[9px] text-foreground-muted uppercase tracking-wider leading-tight block mt-0.5">{label}</span>
    </div>
  )
}
