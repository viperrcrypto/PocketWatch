"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface SubItem {
  merchantName: string
  amount: number
  logoUrl?: string | null
}

interface BudgetSubscriptionsBurnProps {
  subscriptions: SubItem[]
  monthlyTotal: number
}

export function BudgetSubscriptionsBurn({ subscriptions, monthlyTotal }: BudgetSubscriptionsBurnProps) {
  if (subscriptions.length === 0) return null

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>autorenew</span>
          <h3 className="text-sm font-semibold text-foreground">Recurring Costs</h3>
          <span className="text-[10px] font-semibold text-foreground-muted tabular-nums">{formatCurrency(monthlyTotal, "USD", 0)}/month</span>
        </div>
        <Link href="/finance/cards" className="text-[10px] font-semibold text-primary hover:text-primary-hover transition-colors">
          View all &rarr;
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {subscriptions.slice(0, 8).map((sub, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 min-w-[64px] flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-background-secondary flex items-center justify-center overflow-hidden">
              {sub.logoUrl ? (
                <img src={sub.logoUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[10px] font-bold text-foreground-muted">
                  {sub.merchantName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-[9px] text-foreground-muted text-center truncate w-full">{sub.merchantName}</span>
            <span className="text-[10px] font-semibold tabular-nums text-foreground">{formatCurrency(sub.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
