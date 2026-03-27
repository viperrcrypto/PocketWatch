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
  const displaySubs = subscriptions.slice(0, 8)

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>subscriptions</span>
          <h3 className="text-sm font-semibold text-foreground">Subscriptions Impact</h3>
        </div>
        <div className="text-right">
          <span className="text-sm font-data font-bold tabular-nums text-foreground">{formatCurrency(monthlyTotal, "USD", 0)}/mo</span>
          <span className="text-[10px] text-foreground-muted ml-1.5">{pctOfBudget}% of budget</span>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-shrink-0"><MiniDonut percent={Math.min(pctOfBudget, 100)} /></div>
        <div className="flex-1 space-y-2 min-w-0">
          {displaySubs.map((sub) => (
            <div key={sub.merchantName} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-foreground/5 text-[9px] font-bold text-foreground-muted overflow-hidden">
                  {sub.logoUrl ? <img src={sub.logoUrl} alt="" className="w-full h-full object-cover rounded-md" /> : sub.merchantName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground truncate">{sub.merchantName}</p>
                  {sub.category && <span className="text-[8px] font-medium px-1 rounded" style={{ color: getCategoryMeta(sub.category).hex, background: `${getCategoryMeta(sub.category).hex}15` }}>{sub.category}</span>}
                </div>
              </div>
              <span className="text-xs font-data tabular-nums text-foreground-muted flex-shrink-0">{formatCurrency(sub.amount, "USD", 2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-card-border">
        <Link href="/finance/cards" className="text-xs text-primary font-medium hover:text-primary-hover transition-colors flex items-center gap-1">
          View all subscriptions <span className="material-symbols-rounded" style={{ fontSize: 12 }}>arrow_forward</span>
        </Link>
      </div>
    </div>
  )
}

function MiniDonut({ percent }: { percent: number }) {
  const r = 28, circumference = 2 * Math.PI * r, offset = circumference * (1 - percent / 100)
  return (
    <div className="relative w-[72px] h-[72px]">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="transparent" stroke="var(--card-border)" strokeWidth="4" />
        <circle cx="36" cy="36" r={r} fill="transparent" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-data font-bold tabular-nums text-foreground">{percent}%</span>
      </div>
    </div>
  )
}
