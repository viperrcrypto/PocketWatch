"use client"

import { formatCurrency, cn } from "@/lib/utils"
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
  const top = subscriptions.slice(0, 8)
  const maxAmount = top.length > 0 ? Math.max(...top.map((s) => s.amount)) : 1

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>subscriptions</span>
          <h3 className="text-sm font-semibold text-foreground">Subscriptions Impact</h3>
        </div>
        <span className="text-lg font-data font-bold tabular-nums text-foreground">{formatCurrency(monthlyTotal, "USD", 0)}<span className="text-xs text-foreground-muted font-normal">/mo</span></span>
      </div>

      {/* Budget percentage bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-foreground-muted">{pctOfBudget}% of total budget</span>
        </div>
        <div className="h-1.5 rounded-full bg-background-secondary overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500",
              pctOfBudget > 75 ? "bg-error" : pctOfBudget > 50 ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${Math.min(pctOfBudget, 100)}%` }}
          />
        </div>
      </div>

      {top.length > 0 ? (
        <div className="space-y-2">
          {top.map((sub) => {
            const barWidth = maxAmount > 0 ? (sub.amount / maxAmount) * 100 : 0
            const catMeta = sub.category ? getCategoryMeta(sub.category) : null
            return (
              <div key={`${sub.merchantName}-${sub.amount}`} className="group">
                <div className="flex items-center justify-between gap-3 mb-0.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-foreground/5 text-[8px] font-bold text-foreground-muted overflow-hidden">
                      {sub.logoUrl ? (
                        <img src={sub.logoUrl} alt="" className="w-full h-full object-cover rounded-md" onError={(e) => { e.currentTarget.style.display = "none" }} />
                      ) : (
                        sub.merchantName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="text-xs font-medium text-foreground truncate">{sub.merchantName}</span>
                    {catMeta && (
                      <span
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ color: catMeta.hex, background: `${catMeta.hex}12` }}
                      >
                        {sub.category}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-data font-semibold tabular-nums text-foreground flex-shrink-0">
                    {formatCurrency(sub.amount, "USD", 2)}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-background-secondary overflow-hidden ml-8">
                  <div
                    className="h-full rounded-full bg-primary/30 transition-colors duration-300"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <span className="material-symbols-rounded text-foreground-muted/30 block mb-2" style={{ fontSize: 28 }}>credit_card_off</span>
          <p className="text-xs text-foreground-muted">No active subscriptions detected</p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-card-border/50">
        <Link href="/finance/cards" className="text-[11px] text-primary font-medium hover:text-primary-hover transition-colors flex items-center gap-1">
          View all subscriptions <span className="material-symbols-rounded" style={{ fontSize: 12 }}>arrow_forward</span>
        </Link>
      </div>
    </div>
  )
}
