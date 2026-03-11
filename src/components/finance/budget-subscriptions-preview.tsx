"use client"

import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import { MerchantIcon } from "@/components/finance/merchant-icon"

interface Subscription {
  id: string
  merchantName: string
  nickname?: string | null
  amount: number
  frequency: string
  category: string | null
  nextChargeDate: string | null
  status: string
  logoUrl?: string | null
}

interface BudgetSubscriptionsPreviewProps {
  subscriptions: Subscription[]
  totalSubscriptions: number
  monthlyTotal: number
}

export function BudgetSubscriptionsPreview({
  subscriptions,
  totalSubscriptions,
  monthlyTotal,
}: BudgetSubscriptionsPreviewProps) {
  return (
    <section className="bg-card rounded-2xl border border-card-border overflow-hidden">
      <div className="p-5 border-b border-card-border/50 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-foreground">Active Subscriptions</h3>
          <p className="text-xs text-foreground-muted">
            {totalSubscriptions} services totaling {formatCurrency(monthlyTotal)}/mo
          </p>
        </div>
        <Link
          href="/finance/budgets"
          className="text-primary text-xs font-semibold hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="divide-y divide-card-border/20">
        {subscriptions.map((sub) => (
          <div
            key={sub.id}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-primary-subtle hover:scale-[1.005] transition-all rounded-xl mx-1"
          >
            <div className="flex items-center gap-3 min-w-0">
              <MerchantIcon logoUrl={sub.logoUrl} category={sub.category} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {sub.nickname ?? sub.merchantName}
                </p>
                <span className="text-[10px] text-foreground-muted capitalize">
                  {sub.frequency === "yearly" ? "Annual" : sub.frequency}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-semibold font-data tabular-nums text-foreground">
                {formatCurrency(sub.amount)}
              </span>
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  sub.status === "active"
                    ? "bg-success"
                    : sub.status === "paused"
                      ? "bg-warning"
                      : "bg-foreground-muted"
                )}
                title={sub.status}
              />
            </div>
          </div>
        ))}
      </div>

      {totalSubscriptions > subscriptions.length && (
        <div className="px-5 py-3 border-t border-card-border/50">
          <Link
            href="/finance/budgets"
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            View all {totalSubscriptions} subscriptions
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
              arrow_forward
            </span>
          </Link>
        </div>
      )}
    </section>
  )
}
