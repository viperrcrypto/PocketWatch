"use client"

import { cn, formatCurrency } from "@/lib/utils"

interface Bill {
  id: string
  merchantName: string
  amount: number
  daysUntil: number
}

interface BillsImmediateActionsProps {
  bills: Bill[]
}

export function BillsImmediateActions({ bills }: BillsImmediateActionsProps) {
  const urgent = bills.filter((b) => b.daysUntil <= 7)
  if (urgent.length === 0) return null

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-card-border">
        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Immediate Actions</span>
      </div>
      <div className="divide-y divide-card-border/50">
        {urgent.map((bill) => (
          <div key={bill.id} className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className={cn("w-2 h-2 rounded-full", bill.daysUntil <= 3 ? "bg-amber-500" : "bg-foreground-muted/30")} />
              <div>
                <p className="text-sm font-medium text-foreground truncate max-w-[300px]">{bill.merchantName}</p>
                <p className="text-[10px] text-foreground-muted">
                  {bill.daysUntil === 0 ? "Due today" : bill.daysUntil === 1 ? "Due tomorrow" : `Due in ${bill.daysUntil} days`}
                </p>
              </div>
            </div>
            <span className="font-data text-sm font-semibold text-foreground tabular-nums">{formatCurrency(bill.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
