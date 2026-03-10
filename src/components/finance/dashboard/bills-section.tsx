"use client"

import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import { MerchantIcon } from "@/components/finance/merchant-icon"

interface Bill {
  id: string
  merchantName: string
  amount: number
  daysUntil: number
  category?: string | null
}

interface BillsSectionProps {
  bills: Bill[]
}

export function BillsSection({ bills }: BillsSectionProps) {
  return (
    <div className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/30">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>receipt_long</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Bills Coming Up</span>
        </div>
        <Link href="/finance/subscriptions" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
          View all
        </Link>
      </div>
      <div className="divide-y divide-card-border/20">
        {bills.length > 0 ? (
          bills.slice(0, 5).map((bill, idx) => (
            <div
              key={bill.id}
              className="flex items-center justify-between px-5 py-2.5 hover:bg-primary-subtle transition-colors animate-slide-in-right"
              style={{ animationDelay: `${idx * 0.06}s` }}
            >
              <div className="flex items-center gap-3">
                <MerchantIcon category={bill.category} size="sm" />
                <div>
                  <p className="text-sm font-medium text-foreground">{bill.merchantName}</p>
                  <p className="text-[10px] text-foreground-muted">
                    {bill.daysUntil === 0 ? "Due today" : bill.daysUntil === 1 ? "Tomorrow" : `In ${bill.daysUntil} days`}
                  </p>
                </div>
              </div>
              <span className={cn(
                "font-data text-sm font-semibold tabular-nums",
                bill.daysUntil <= 1 ? "text-warning animate-gentle-pulse" : "text-foreground"
              )}>
                {formatCurrency(bill.amount)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-foreground-muted text-center py-8">No upcoming bills</p>
        )}
      </div>
    </div>
  )
}
