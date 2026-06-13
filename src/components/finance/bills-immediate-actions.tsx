"use client"

import Link from "next/link"
import { cn, formatCurrency } from "@/lib/utils"

interface Bill {
  id: string
  merchantName: string
  amount: number
  daysUntil: number
  isPaid?: boolean
  lastTransactionId?: string | null
  category?: string | null
}

/** Drill-through to the underlying transaction(s): the exact paid transaction if
 * linked; otherwise the category's transactions when the bill is only labeled by
 * category (the nameless "Food & Dining"-style false positives), else a merchant
 * search. */
function billHref(bill: Bill): string {
  if (bill.lastTransactionId) return `/finance/transactions?highlight=${bill.lastTransactionId}`
  if (bill.category && bill.merchantName === bill.category) {
    return `/finance/transactions?category=${encodeURIComponent(bill.category)}`
  }
  return `/finance/transactions?search=${encodeURIComponent(bill.merchantName)}`
}

interface BillsImmediateActionsProps {
  bills: Bill[]
  /** Dismiss a materialized subscription bill (id is a plain cuid, not cc-/plaid:). */
  onDismiss?: (id: string) => void
}

/** Only real subscription rows (cuid ids) can be dismissed — CC/Plaid bills can't. */
function isDismissible(id: string): boolean {
  return !id.startsWith("cc-") && !id.startsWith("plaid:")
}

export function BillsImmediateActions({ bills, onDismiss }: BillsImmediateActionsProps) {
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
            <div key={bill.id} className="flex items-center gap-1 px-5 py-3 hover:bg-background-secondary/20 transition-colors group">
            <Link href={billHref(bill)} className="flex items-center justify-between flex-1 min-w-0">
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
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "font-data text-sm font-bold tabular-nums",
                  isToday ? "text-error" : "text-foreground"
                )}>
                  {formatCurrency(bill.amount)}
                </span>
                <span className="material-symbols-rounded text-foreground-muted/40" style={{ fontSize: 16 }} aria-hidden="true">chevron_right</span>
              </div>
            </Link>
            {onDismiss && isDismissible(bill.id) && (
              <button
                onClick={() => onDismiss(bill.id)}
                className="flex-shrink-0 p-1 text-foreground-muted/40 hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                aria-label={`Dismiss ${bill.merchantName} — not a bill`}
                title="Not a bill — dismiss"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">close</span>
              </button>
            )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
