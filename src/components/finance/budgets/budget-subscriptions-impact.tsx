"use client"

import { formatCurrency } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import Link from "next/link"

interface SubscriptionItem { merchantName: string; amount: number; logoUrl: string | null; category: string | null }

interface BudgetSubscriptionsImpactProps {
  subscriptions: SubscriptionItem[]
  monthlyTotal: number
  totalBudgeted: number
}

export function BudgetSubscriptionsImpact({ subscriptions, monthlyTotal, totalBudgeted }: BudgetSubscriptionsImpactProps) {
  const pctOfBudget = totalBudgeted > 0 ? Math.round((monthlyTotal / totalBudgeted) * 100) : 0
  const displaySubs = subscriptions.slice(0, 6)

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>subscriptions</span>
          <h3 className="text-sm font-semibold text-foreground">Subscriptions Impact</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-data font-bold tabular-nums text-foreground">{formatCurrency(monthlyTotal, "USD", 0)}/mo</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary tabular-nums">{pctOfBudget}%</span>
        </div>
      </div>

      {displaySubs.length > 0 ? (
        <div className="space-y-2.5">
          {displaySubs.map((sub) => (
            <div key={sub.merchantName} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-foreground/5 text-[9px] font-bold text-foreground-muted overflow-hidden">
                  {sub.logoUrl ? <img src={sub.logoUrl} alt="" className="w-full h-full object-cover rounded-lg" onError={(e) => { e.currentTarget.style.display = "none" }} /> : sub.merchantName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{sub.merchantName}</p>
                  {sub.category && <span className="text-[8px] font-medium px-1 rounded" style={{ color: getCategoryMeta(sub.category).hex, background: `${getCategoryMeta(sub.category).hex}15` }}>{sub.category}</span>}
                </div>
              </div>
              <span className="text-xs font-data font-semibold tabular-nums text-foreground flex-shrink-0">{formatCurrency(sub.amount, "USD", 2)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <span className="material-symbols-rounded text-foreground-muted/40 block mb-2" style={{ fontSize: 24 }}>credit_card_off</span>
          <p className="text-sm text-foreground-muted">No active subscriptions detected.</p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-card-border">
        <Link href="/finance/cards" className="text-xs text-primary font-medium hover:text-primary-hover transition-colors flex items-center gap-1">
          View all subscriptions <span className="material-symbols-rounded" style={{ fontSize: 12 }}>arrow_forward</span>
        </Link>
      </div>
    </div>
  )
}
