"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { FinanceChartWrapper } from "@/components/finance/finance-chart-wrapper"
import { SpendingDonutChart } from "@/components/finance/spending-donut-chart"

interface RecurringAllocationProps {
  deep: any
  donutData: Array<{ category: string; amount: number }>
  recurringData: any
  holdingsData: any
}

const TYPE_COLORS: Record<string, string> = {
  equity: "bg-blue-500", etf: "bg-cyan-500", "mutual fund": "bg-violet-500",
  "fixed income": "bg-amber-500", cash: "bg-green-500", derivative: "bg-red-500",
  cryptocurrency: "bg-orange-500", other: "bg-gray-400",
}
const TYPE_HEX: Record<string, string> = {
  equity: "#3B82F6", etf: "#06B6D4", "mutual fund": "#8B5CF6",
  "fixed income": "#F59E0B", cash: "#22C55E", derivative: "#EF4444",
  cryptocurrency: "#F97316", other: "#9CA3AF",
}

export function InsightsRecurringAllocation({ deep, donutData, recurringData, holdingsData }: RecurringAllocationProps) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinanceChartWrapper title="Category Breakdown">
          {donutData.length > 0 ? (
            <SpendingDonutChart data={donutData} height={300} />
          ) : (
            <p className="text-sm text-foreground-muted text-center py-16">No spending data</p>
          )}
        </FinanceChartWrapper>

        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-card-border/50 flex items-center gap-2">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>compare_arrows</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Recurring vs One-Time</span>
          </div>
          {deep?.recurringVsOneTime ? (
            <div className="p-5 space-y-4">
              <div className="text-center mb-2 relative">
                <div className="absolute inset-0 rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }} />
                <p className="font-data text-3xl font-bold text-foreground tabular-nums relative">
                  {deep.recurringVsOneTime.fixedCostRatio.toFixed(0)}%
                </p>
                <p className="text-[10px] text-foreground-muted relative">fixed costs</p>
              </div>
              <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${deep.recurringVsOneTime.fixedCostRatio}%`, background: "linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #000))" }}
                />
                <div
                  className="h-full rounded-full bg-foreground-muted/20 transition-[width] duration-500"
                  style={{ width: `${100 - deep.recurringVsOneTime.fixedCostRatio}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/10" style={{ borderLeft: "3px solid var(--primary)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Recurring</span>
                  </div>
                  <p className="font-data text-lg font-bold text-foreground tabular-nums">{formatCurrency(deep.recurringVsOneTime.recurring)}</p>
                  <p className="text-[10px] text-foreground-muted mt-0.5">{deep.recurringVsOneTime.fixedCostRatio.toFixed(1)}% of total</p>
                </div>
                <div className="p-3 rounded-xl bg-background-secondary/40 border border-card-border/40" style={{ borderLeft: "3px solid color-mix(in srgb, var(--foreground) 25%, transparent)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">One-Time</span>
                  </div>
                  <p className="font-data text-lg font-bold text-foreground tabular-nums">{formatCurrency(deep.recurringVsOneTime.oneTime)}</p>
                  <p className="text-[10px] text-foreground-muted mt-0.5">{(100 - deep.recurringVsOneTime.fixedCostRatio).toFixed(1)}% of total</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground-muted text-center py-12">No data</p>
          )}
        </div>
      </div>

      {(recurringData || holdingsData) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recurringData && recurringData.outflows.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>sync</span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Recurring Costs</span>
              </div>
              <div className="mt-2 mb-4 flex items-baseline gap-2">
                <span className="font-data text-2xl font-bold text-foreground tabular-nums">{formatCurrency(recurringData.totalMonthlyOutflow)}</span>
                <span className="text-xs text-foreground-muted">/month</span>
              </div>
              <div className="relative">
                <div className="space-y-0 max-h-[300px] overflow-y-auto">
                  {recurringData.outflows.slice(0, 10).map((s: any, i: number) => (
                    <div key={s.streamId} className={cn("flex items-center justify-between py-2 px-2 rounded-lg", i % 2 === 0 && "bg-background-secondary/30")}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", s.isActive ? "bg-success" : "bg-foreground-muted/30")} />
                        <span className="text-sm text-foreground truncate">{s.merchantName ?? s.description}</span>
                      </div>
                      <span className="font-data text-sm font-medium text-foreground tabular-nums ml-2">{formatCurrency(Math.abs(s.lastAmount ?? s.averageAmount ?? 0))}</span>
                    </div>
                  ))}
                </div>
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
              </div>
              {recurringData.inflows.length > 0 && (
                <div className="mt-4 pt-4 border-t border-card-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-muted">Recurring Income</span>
                    <span className="font-data text-sm font-medium text-success tabular-nums">+{formatCurrency(recurringData.totalMonthlyInflow)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {holdingsData && holdingsData.holdings.length > 0 && (() => {
            const byType = new Map<string, number>()
            for (const h of holdingsData.holdings) {
              const type = h.security?.type ?? "other"
              byType.set(type, (byType.get(type) ?? 0) + (h.institutionValue ?? 0))
            }
            const sorted = [...byType.entries()].sort((a, b) => b[1] - a[1])
            return (
              <div className="bg-card border border-card-border rounded-xl p-6">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: "#8B5CF6" }}>trending_up</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Investment Allocation</span>
                </div>
                <div className="mt-2 mb-4 flex items-baseline gap-2">
                  <span className="font-data text-2xl font-bold text-foreground tabular-nums">{formatCurrency(holdingsData.totalValue)}</span>
                  <span className="text-xs text-foreground-muted">total</span>
                </div>
                <div className="h-4 rounded-full overflow-hidden flex gap-0.5 mb-4">
                  {sorted.map(([type, value]) => (
                    <div
                      key={type}
                      className={cn("h-full rounded-full first:rounded-l-full last:rounded-r-full", TYPE_COLORS[type] ?? TYPE_COLORS.other)}
                      style={{ width: `${(value / holdingsData.totalValue) * 100}%` }}
                      title={`${type}: ${formatCurrency(value)}`}
                    />
                  ))}
                </div>
                <div className="space-y-1">
                  {sorted.map(([type, value]) => (
                    <div key={type} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-background-secondary/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: TYPE_HEX[type] ?? TYPE_HEX.other }} />
                        <span className="text-sm text-foreground capitalize">{type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-data text-xs text-foreground-muted tabular-nums">{((value / holdingsData.totalValue) * 100).toFixed(1)}%</span>
                        <span className="font-data text-sm font-medium text-foreground tabular-nums">{formatCurrency(value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </>
  )
}
