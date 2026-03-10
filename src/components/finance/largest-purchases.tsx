"use client"

import { formatCurrency } from "@/lib/utils"
import { MerchantIcon } from "@/components/finance/merchant-icon"

interface LargestPurchasesProps {
  purchases: Array<{
    merchantName: string | null
    name: string
    amount: number
    date: string
    category: string | null
    logoUrl?: string | null
  }>
}

export function LargestPurchases({ purchases }: LargestPurchasesProps) {
  if (purchases.length === 0) {
    return <p className="text-sm text-foreground-muted text-center py-6">No purchases this month</p>
  }

  return (
    <div className="divide-y divide-card-border/30">
      {purchases.map((p, i) => (
        <div key={`${p.date}-${i}`} className="flex items-center gap-3 px-5 py-2.5">
          <MerchantIcon logoUrl={p.logoUrl} category={p.category} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {p.merchantName ?? p.name}
            </p>
            <p className="text-[10px] text-foreground-muted">
              {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {p.category && ` · ${p.category}`}
            </p>
          </div>
          <span className="font-data text-sm font-semibold text-foreground tabular-nums flex-shrink-0">
            {formatCurrency(Math.abs(p.amount))}
          </span>
        </div>
      ))}
    </div>
  )
}
