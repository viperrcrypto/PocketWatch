"use client"

import { formatCurrency } from "@/lib/utils"

interface SubscriptionSummary {
  merchantName: string
  nickname?: string | null
  amount: number
}

interface BudgetStatCardsProps {
  hasBudgets: boolean
  // Budget mode
  totalBudgeted: number
  totalSpent: number
  budgetCount: number
  daysRemaining: number
  // No-budgets mode
  totalAvgSpending: number
  monthsAnalyzed: number
  subscriptionTotal: number
  subscriptionCount: number
  billsCount: number
  billsTotal: number
  nextBillDays: number | null
  // Subscription details (both modes)
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
  const remainingPercent = totalBudgeted > 0 ? (remaining / totalBudgeted) * 100 : 0
  const safeDaily = daysRemaining > 0 ? remaining / daysRemaining : 0

  const remainingColor =
    remainingPercent <= 0 ? "error" : remainingPercent <= 20 ? "warning" : "success"
  const remainingIconColor =
    remainingPercent <= 0
      ? "text-error"
      : remainingPercent <= 20
      ? "text-warning"
      : "text-success"
  const remainingBgColor =
    remainingPercent <= 0
      ? "bg-error/10"
      : remainingPercent <= 20
      ? "bg-warning/10"
      : "bg-success-muted"

  if (hasBudgets) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon="account_balance_wallet"
          iconColor="text-success"
          iconBg="bg-success-muted"
          label="Budgeted"
          value={formatCurrency(totalBudgeted, "USD", 0)}
          subtext={`${budgetCount} categories`}
        />
        <StatCard
          icon="payments"
          iconColor="text-primary"
          iconBg="bg-primary-muted"
          label="Spent"
          value={formatCurrency(totalSpent, "USD", 0)}
          subtext={
            totalBudgeted > 0
              ? `${Math.round((totalSpent / totalBudgeted) * 100)}% of budget`
              : ""
          }
        />
        <StatCard
          icon="savings"
          iconColor={remainingIconColor}
          iconBg={remainingBgColor}
          label="Remaining"
          value={formatCurrency(Math.abs(remaining), "USD", 0)}
          subtext={
            remaining >= 0 && daysRemaining > 0
              ? `${formatCurrency(safeDaily, "USD", 0)}/day safe to spend`
              : remaining < 0
              ? "Over budget"
              : ""
          }
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard
        icon="account_balance_wallet"
        iconColor="text-success"
        iconBg="bg-success-muted"
        label="Avg Spending"
        value={formatCurrency(totalAvgSpending, "USD", 0)}
        subtext={`${monthsAnalyzed}-mo average`}
      />
      <StatCard
        icon="sync"
        iconColor="text-primary"
        iconBg="bg-primary-muted"
        label="Subscriptions"
        value={formatCurrency(subscriptionTotal)}
        subtext={`${subscriptionCount} recurring`}
      >
        {subscriptions.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-card-border/40 pt-2">
            {subscriptions.slice(0, 3).map((sub) => (
              <div key={sub.merchantName} className="flex justify-between text-[10px]">
                <span className="text-foreground-muted truncate mr-2">
                  {sub.nickname ?? sub.merchantName}
                </span>
                <span className="font-bold tabular-nums text-foreground flex-shrink-0">
                  {formatCurrency(sub.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </StatCard>
      <StatCard
        icon="schedule"
        iconColor="text-warning"
        iconBg="bg-warning-muted"
        label="Upcoming"
        value={`${billsCount} Bills`}
        subtext={
          billsCount > 0
            ? `${formatCurrency(billsTotal)} total${nextBillDays != null && nextBillDays <= 7 ? ` · next ${nextBillDays}d` : ""}`
            : "No upcoming bills"
        }
      />
    </div>
  )
}

function StatCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  subtext,
  children,
}: {
  icon: string
  iconColor: string
  iconBg: string
  label: string
  value: string
  subtext: string
  children?: React.ReactNode
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`size-6 rounded-md ${iconBg} flex items-center justify-center`}>
          <span className={`material-symbols-rounded ${iconColor}`} style={{ fontSize: 13 }}>
            {icon}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
          {label}
        </span>
      </div>
      <div className="text-lg font-black font-data tabular-nums text-foreground">{value}</div>
      <div className="text-[10px] text-foreground-muted">{subtext}</div>
      {children}
    </div>
  )
}
