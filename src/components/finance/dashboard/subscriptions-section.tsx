"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { MerchantIcon } from "@/components/finance/merchant-icon"
import { SpendingDonutChart } from "@/components/finance/spending-donut-chart"

interface Sub {
  id: string
  merchantName: string
  amount: number
  frequency: string
  logoUrl?: string | null
  category?: string | null
}

interface SubscriptionsSectionProps {
  monthlySubTotal: number
  topSubs: Sub[]
  totalActiveSubs: number
  donutData: Array<{ category: string; amount: number }>
}

export function SubscriptionsSection({ monthlySubTotal, topSubs, totalActiveSubs, donutData }: SubscriptionsSectionProps) {
  return (
    <div className="animate-fade-up delay-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Active Subscriptions */}
      <div className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>subscriptions</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Active Subscriptions</span>
          </div>
          <span className="font-data text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full tabular-nums">
            {formatCurrency(monthlySubTotal)}/mo
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
                {formatCurrency(sub.amount)}
              </span>
            </div>
          )) : (
            <p className="text-sm text-foreground-muted text-center py-8">No active subscriptions</p>
          )}
        </div>
        {totalActiveSubs > 5 && (
          <div className="px-5 py-3 border-t border-card-border/30">
            <Link href="/finance/budgets" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
              View all {totalActiveSubs} subscriptions
            </Link>
          </div>
        )}
      </div>

      {/* Spending This Month */}
      <div className="bg-card rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          Spending This Month
        </span>
        <div className="mt-4">
          {donutData.length > 0 ? (
            <SpendingDonutChart data={donutData} />
          ) : (
            <p className="text-sm text-foreground-muted text-center py-12">No spending data yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
