"use client"

import { formatCurrency, cn } from "@/lib/utils"

interface SubscriptionSummary {
  merchantName: string
  nickname?: string | null
  amount: number
}

interface BudgetStatCardsProps {
  hasBudgets: boolean
  totalBudgeted: number
  totalSpent: number
  budgetCount: number
  daysRemaining: number
  totalAvgSpending: number
  monthsAnalyzed: number
  subscriptionTotal: number
  subscriptionCount: number
  billsCount: number
  billsTotal: number
  nextBillDays: number | null
  subscriptions?: SubscriptionSummary[]
}

export function BudgetStatCards({
  hasBudgets,
  totalBudgeted,
  totalSpent,
  budgetCount,
  daysRemaining,
  totalAvgSpending,
  monthsAnalyzed,
  subscriptionTotal,
  subscriptionCount,
  billsCount,
  billsTotal,
  nextBillDays,
  subscriptions = [],
}: BudgetStatCardsProps) {
  const remaining = totalBudgeted - totalSpent
  const percentUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0
  const safeDaily = daysRemaining > 0 ? remaining / daysRemaining : 0

  if (hasBudgets) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Budgeted */}
        <div className="bg-card border border-card-border rounded-2xl p-3 sm:p-5 relative overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.03]" style={{ background: "radial-gradient(circle, var(--success), transparent 70%)" }} />
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, var(--success), color-mix(in srgb, var(--success) 80%, #000))" }}>
              <span className="material-symbols-rounded text-white drop-shadow-sm" style={{ fontSize: 18 }}>account_balance_wallet</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">Budgeted</span>
          </div>
          <p className="font-data text-xl sm:text-2xl font-black text-foreground tabular-nums" style={{ letterSpacing: "-0.03em" }}>
            {formatCurrency(totalBudgeted, "USD", 0)}
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">{budgetCount} categories tracked</p>
        </div>

        {/* Spent — with mini ring */}
        <div className="bg-card border border-card-border rounded-2xl p-3 sm:p-5 relative overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 80%, #000))" }}>
                  <span className="material-symbols-rounded text-white drop-shadow-sm" style={{ fontSize: 18 }}>payments</span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">Spent</span>
              </div>
              <p className="font-data text-xl sm:text-2xl font-black text-foreground tabular-nums" style={{ letterSpacing: "-0.03em" }}>
                {formatCurrency(totalSpent, "USD", 0)}
              </p>
            </div>
            <MiniRing percent={percentUsed} />
          </div>
          <div className="mt-2 h-1 rounded-full bg-background-secondary overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                percentUsed >= 100 ? "bg-error" : percentUsed >= 80 ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
        </div>

        {/* Remaining */}
        <div
          className={cn(
            "border rounded-2xl p-3 sm:p-5 relative overflow-hidden",
            remaining < 0
              ? "bg-error/5 border-error/20"
              : remaining / totalBudgeted < 0.2
              ? "bg-warning/5 border-warning/20"
              : "bg-card border-card-border"
          )}
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-sm" style={{
              background: remaining < 0
                ? "linear-gradient(135deg, var(--error), color-mix(in srgb, var(--error) 80%, #000))"
                : remaining / totalBudgeted < 0.2
                ? "linear-gradient(135deg, var(--warning), color-mix(in srgb, var(--warning) 80%, #000))"
                : "linear-gradient(135deg, var(--success), color-mix(in srgb, var(--success) 80%, #000))"
            }}>
              <span className="material-symbols-rounded text-white drop-shadow-sm" style={{ fontSize: 18 }}>savings</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">Remaining</span>
          </div>
          <p className={cn(
            "font-data text-xl sm:text-2xl font-black tabular-nums",
            remaining < 0 ? "text-error" : remaining / totalBudgeted < 0.2 ? "text-warning" : "text-foreground"
          )} style={{ letterSpacing: "-0.03em" }}>
            {remaining < 0 ? `-${formatCurrency(Math.abs(remaining), "USD", 0)}` : formatCurrency(remaining, "USD", 0)}
          </p>
          {remaining >= 0 && daysRemaining > 0 ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 12 }}>wallet</span>
              <span className="text-[11px] text-foreground-muted">
                <span className="font-data font-bold tabular-nums text-foreground">{formatCurrency(safeDaily, "USD", 0)}</span>/day safe to spend
              </span>
            </div>
          ) : remaining < 0 ? (
            <p className="text-[11px] text-error mt-1">Over budget</p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Avg Spending */}
      <div className="bg-card border border-card-border rounded-2xl p-3 sm:p-5 relative overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.03]" style={{ background: "radial-gradient(circle, var(--success), transparent 70%)" }} />
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, var(--success), color-mix(in srgb, var(--success) 80%, #000))" }}>
            <span className="material-symbols-rounded text-white drop-shadow-sm" style={{ fontSize: 18 }}>account_balance_wallet</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">Avg Spending</span>
        </div>
        <p className="font-data text-xl sm:text-2xl font-black text-foreground tabular-nums" style={{ letterSpacing: "-0.03em" }}>
          {formatCurrency(totalAvgSpending, "USD", 0)}
        </p>
        <p className="text-[11px] text-foreground-muted mt-1">{monthsAnalyzed} mo average</p>
      </div>

      {/* Subscriptions */}
      <div className="bg-card border border-card-border rounded-2xl p-3 sm:p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 80%, #000))" }}>
            <span className="material-symbols-rounded text-white drop-shadow-sm" style={{ fontSize: 18 }}>sync</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">Subscriptions</span>
        </div>
        <p className="font-data text-xl sm:text-2xl font-black text-foreground tabular-nums" style={{ letterSpacing: "-0.03em" }}>
          {formatCurrency(subscriptionTotal)}
        </p>
        <p className="text-[11px] text-foreground-muted mt-1">{subscriptionCount} recurring</p>
        {subscriptions.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-card-border/40 pt-2.5">
            {subscriptions.slice(0, 3).map((sub) => (
              <div key={sub.merchantName} className="flex justify-between items-center">
                <span className="text-[10px] text-foreground-muted truncate mr-2">
                  {sub.nickname ?? sub.merchantName}
                </span>
                <span className="text-[10px] font-data font-bold tabular-nums text-foreground flex-shrink-0">
                  {formatCurrency(sub.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Bills */}
      <div className="bg-card border border-card-border rounded-2xl p-3 sm:p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-sm" style={{
            background: nextBillDays != null && nextBillDays <= 3
              ? "linear-gradient(135deg, var(--error), color-mix(in srgb, var(--error) 80%, #000))"
              : "linear-gradient(135deg, var(--warning), color-mix(in srgb, var(--warning) 80%, #000))"
          }}>
            <span className="material-symbols-rounded text-white drop-shadow-sm" style={{ fontSize: 18 }}>schedule</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">Upcoming</span>
        </div>
        <p className="font-data text-xl sm:text-2xl font-black text-foreground tabular-nums" style={{ letterSpacing: "-0.03em" }}>
          {billsCount} Bills
        </p>
        {billsCount > 0 ? (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-foreground-muted">
              {formatCurrency(billsTotal)} total
            </span>
            {nextBillDays != null && nextBillDays <= 7 && (
              <>
                <span className="w-1 h-1 rounded-full bg-foreground-muted/30" />
                <span className={cn(
                  "text-[11px] font-semibold",
                  nextBillDays <= 3 ? "text-error" : "text-warning"
                )}>
                  next in {nextBillDays}d
                </span>
              </>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-foreground-muted mt-1">No upcoming bills</p>
        )}
      </div>
    </div>
  )
}

function MiniRing({ percent }: { percent: number }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(percent, 100) / 100)
  const color = percent >= 100 ? "var(--error)" : percent >= 80 ? "var(--warning)" : "var(--primary)"

  return (
    <div className="relative w-11 h-11 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--card-border)" strokeWidth="3" />
        <circle
          cx="20" cy="20" r={r} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-data text-[10px] font-bold tabular-nums" style={{ color }}>
        {Math.round(percent)}%
      </span>
    </div>
  )
}
