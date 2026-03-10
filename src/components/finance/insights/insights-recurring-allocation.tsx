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

export function InsightsRecurringAllocation({ deep, donutData, recurringData, holdingsData }: RecurringAllocationProps) {
  return (
    <>
      {/* Two-column: Donut + Recurring vs One-Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinanceChartWrapper title="Category Breakdown">
          {donutData.length > 0 ? (
            <SpendingDonutChart data={donutData} height={300} />
          ) : (
            <p className="text-sm text-foreground-muted text-center py-16">No spending data</p>
          )}
        </FinanceChartWrapper>

        <div className="bg-card border border-card-border rounded-xl p-6">
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Recurring vs One-Time
          </span>
          {deep?.recurringVsOneTime ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm text-foreground">Recurring</span>
                </div>
                <span className="font-data text-sm font-medium text-foreground tabular-nums">
                  {formatCurrency(deep.recurringVsOneTime.recurring)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-foreground-muted/30" />
                  <span className="text-sm text-foreground">One-Time</span>
                </div>
                <span className="font-data text-sm font-medium text-foreground tabular-nums">
                  {formatCurrency(deep.recurringVsOneTime.oneTime)}
                </span>
              </div>
              <div className="h-3 rounded-full bg-gray-200 dark:bg-background-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${deep.recurringVsOneTime.fixedCostRatio}%` }}
                />
              </div>
              <p className="text-xs text-foreground-muted">
                {deep.recurringVsOneTime.fixedCostRatio.toFixed(0)}% fixed costs
              </p>
            </div>
          ) : (
            <p className="text-sm text-foreground-muted text-center py-12">No data</p>
          )}
        </div>
      </div>

      {/* Recurring Costs + Investment Allocation */}
      {(recurringData || holdingsData) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recurring Costs Breakdown */}
          {recurringData && recurringData.outflows.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-6">
              <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                Recurring Costs
              </span>
              <div className="mt-2 mb-4 flex items-baseline gap-2">
                <span className="font-data text-2xl font-bold text-foreground tabular-nums">
                  {formatCurrency(recurringData.totalMonthlyOutflow)}
                </span>
                <span className="text-xs text-foreground-muted">/month</span>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recurringData.outflows.slice(0, 10).map((s: any) => (
                  <div key={s.streamId} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", s.isActive ? "bg-success" : "bg-foreground-muted/30")} />
                      <span className="text-sm text-foreground truncate">{s.merchantName ?? s.description}</span>
                    </div>
                    <span className="font-data text-sm font-medium text-foreground tabular-nums ml-2">
                      {formatCurrency(Math.abs(s.lastAmount ?? s.averageAmount ?? 0))}
                    </span>
                  </div>
                ))}
              </div>
              {recurringData.inflows.length > 0 && (
                <div className="mt-4 pt-4 border-t border-card-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-muted">Recurring Income</span>
                    <span className="font-data text-sm font-medium text-success tabular-nums">
                      +{formatCurrency(recurringData.totalMonthlyInflow)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Investment Allocation */}
          {holdingsData && holdingsData.holdings.length > 0 && (() => {
            const byType = new Map<string, number>()
            for (const h of holdingsData.holdings) {
              const type = h.security?.type ?? "other"
              byType.set(type, (byType.get(type) ?? 0) + (h.institutionValue ?? 0))
            }
            const sorted = [...byType.entries()].sort((a, b) => b[1] - a[1])

            return (
              <div className="bg-card border border-card-border rounded-xl p-6">
                <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                  Investment Allocation
                </span>
                <div className="mt-2 mb-4 flex items-baseline gap-2">
                  <span className="font-data text-2xl font-bold text-foreground tabular-nums">
                    {formatCurrency(holdingsData.totalValue)}
                  </span>
                  <span className="text-xs text-foreground-muted">total</span>
                </div>
                {/* Stacked bar */}
                <div className="h-4 rounded-full overflow-hidden flex mb-4">
                  {sorted.map(([type, value]) => (
                    <div
                      key={type}
                      className={cn("h-full", TYPE_COLORS[type] ?? TYPE_COLORS.other)}
                      style={{ width: `${(value / holdingsData.totalValue) * 100}%` }}
                      title={`${type}: ${formatCurrency(value)}`}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  {sorted.map(([type, value]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", TYPE_COLORS[type] ?? TYPE_COLORS.other)} />
                        <span className="text-sm text-foreground capitalize">{type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-data text-xs text-foreground-muted tabular-nums">
                          {((value / holdingsData.totalValue) * 100).toFixed(1)}%
                        </span>
                        <span className="font-data text-sm font-medium text-foreground tabular-nums">
                          {formatCurrency(value)}
                        </span>
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
