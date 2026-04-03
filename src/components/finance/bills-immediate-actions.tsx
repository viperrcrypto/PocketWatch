"use client"

import { cn, formatCurrency } from "@/lib/utils"

interface Bill {
  id: string
  merchantName: string
  amount: number
  daysUntil: number
  isPaid?: boolean
}

interface BillsImmediateActionsProps {
  bills: Bill[]
}

export function BillsImmediateActions({ bills }: BillsImmediateActionsProps) {
  // Only show upcoming unpaid bills due within 7 days, never negative days (already past)
  const urgent = bills.filter((b) => b.daysUntil >= 0 && b.daysUntil <= 7 && !b.isPaid)
  if (urgent.length === 0) return null

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="px-5 py-3 border-b border-card-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-warning" style={{ fontSize: 18 }}>priority_high</span>
          <span className="text-sm font-bold text-foreground">Immediate Actions</span>
        </div>
        <span className="text-[10px] font-data font-semibold tabular-nums text-foreground-muted">
          {urgent.length} bill{urgent.length !== 1 ? "s" : ""} due soon
        </span>
      </div>
      <div className="divide-y divide-card-border/30">
        {urgent.map((bill) => {
          const isToday = bill.daysUntil === 0
          const isTomorrow = bill.daysUntil === 1
          const isUrgent = bill.daysUntil <= 3

          return (
            <div key={bill.id} className="flex items-center justify-between px-5 py-3 hover:bg-background-secondary/20 transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    isToday ? "bg-error/10" : isUrgent ? "bg-warning/10" : "bg-primary/10"
                  )}
                >
                  <span
                    className={cn(
                      "material-symbols-rounded",
                      isToday ? "text-error" : isUrgent ? "text-warning" : "text-primary"
                    )}
                    style={{ fontSize: 18 }}
                  >
                    {isToday ? "notifications_active" : isUrgent ? "schedule" : "event"}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{bill.merchantName}</p>
                  <p className={cn(
                    "text-[10px] font-semibold",
                    isToday ? "text-error" : isUrgent ? "text-warning" : "text-foreground-muted"
                  )}>
                    {isToday ? "Due today" : isTomorrow ? "Due tomorrow" : `Due in ${bill.daysUntil} days`}
                  </p>
                </div>
              </div>
              <span className={cn(
                "font-data text-sm font-bold tabular-nums",
                isToday ? "text-error" : "text-foreground"
              )}>
                {formatCurrency(bill.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
