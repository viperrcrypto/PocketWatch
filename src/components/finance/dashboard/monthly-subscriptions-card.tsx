"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { MerchantIcon } from "@/components/finance/merchant-icon"
import { BlurredValue } from "@/components/portfolio/blurred-value"

interface Sub {
  id: string
  merchantName: string
  amount: number
  frequency: string
  logoUrl?: string | null
  category?: string | null
  billType?: string | null
}

interface MonthlySubscriptionsCardProps {
  subscriptions: Sub[]
  isHidden: boolean
}

/**
 * Calculate calendar-month aware burn rate.
 * Weekly/biweekly subs count actual occurrences in the month.
 */
function calcMonthlyBurn(subs: Sub[]): number {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const weeksInMonth = daysInMonth / 7

  return subs.reduce((sum, s) => {
    switch (s.frequency) {
      case "weekly": return sum + s.amount * Math.round(weeksInMonth)
      case "biweekly": return sum + s.amount * Math.round(weeksInMonth / 2)
      case "monthly": return sum + s.amount
      default: return sum
    }
  }, 0)
}

export function MonthlySubscriptionsCard({ subscriptions, isHidden }: MonthlySubscriptionsCardProps) {
  // Only true subscriptions with frequent billing
  const monthlySubs = subscriptions.filter(
    (s) => s.billType === "subscription" || (!s.billType && ["weekly", "biweekly", "monthly"].includes(s.frequency))
  )
  const monthlyBurn = calcMonthlyBurn(monthlySubs)
  const topSubs = [...monthlySubs].sort((a, b) => b.amount - a.amount).slice(0, 5)

  return (
    <div className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/30">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>subscriptions</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Monthly Subscriptions</span>
        </div>
        <span className="font-data text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full tabular-nums">
          <BlurredValue isHidden={isHidden}>{formatCurrency(monthlyBurn)}/mo</BlurredValue>
        </span>
      </div>
      <div className="divide-y divide-card-border/20">
        {topSubs.length > 0 ? topSubs.map((sub, idx) => (
          <div
            key={sub.id}
            className="flex items-center justify-between px-5 py-2.5 hover:bg-primary-subtle transition-colors animate-slide-in-right"
            style={{ animationDelay: `${idx * 0.06}s` }}
          >
            <div className="flex items-center gap-3">
              <MerchantIcon logoUrl={sub.logoUrl} category={sub.category} size="sm" />
              <div>
                <p className="text-sm font-medium text-foreground">{sub.merchantName}</p>
                <p className="text-[10px] text-foreground-muted capitalize">{sub.frequency}</p>
              </div>
            </div>
            <span className="font-data text-sm font-semibold text-foreground tabular-nums">
              <BlurredValue isHidden={isHidden}>{formatCurrency(sub.amount)}</BlurredValue>
            </span>
          </div>
        )) : (
          <p className="text-sm text-foreground-muted text-center py-8">No active subscriptions</p>
        )}
      </div>
      {monthlySubs.length > 5 && (
        <div className="px-5 py-3 border-t border-card-border/30">
          <Link href="/finance/budgets" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
            View all {monthlySubs.length} subscriptions
          </Link>
        </div>
      )}
    </div>
  )
}
