"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface BillItem {
  id: string
  merchantName: string
  amount: number
  daysUntil: number
  category: string | null
}

function formatRelativeDate(daysUntil: number): string {
  if (daysUntil === 0) return "Today"
  if (daysUntil === 1) return "Tomorrow"
  if (daysUntil <= 7) return `in ${daysUntil} days`
  const date = new Date()
  date.setDate(date.getDate() + daysUntil)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function getUrgencyColor(daysUntil: number): string {
  if (daysUntil <= 3) return "border-error"
  if (daysUntil <= 7) return "border-warning"
  return "border-foreground-muted/30"
}

export function BudgetSmartBills({ bills }: { bills: BillItem[] }) {
  if (bills.length === 0) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-foreground mb-1">Upcoming</h4>
        <p className="text-[11px] text-foreground-muted">No upcoming bills</p>
      </div>
    )
  }

  const visible = bills.slice(0, 5)
  const total = visible.reduce((s, b) => s + b.amount, 0)

  return (
    <div>
      <h4 className="text-xs font-semibold text-foreground mb-0.5">Upcoming</h4>
      <p className="text-[10px] text-foreground-muted mb-4">
        {bills.length} bill{bills.length !== 1 ? "s" : ""} · {formatCurrency(total)}
      </p>

      <div className="divide-y divide-card-border/20">
        {visible.map((bill) => (
          <div
            key={bill.id}
            className={`flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 border-l-[3px] pl-3 ${getUrgencyColor(bill.daysUntil)}`}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {bill.merchantName}
              </p>
              <p className="text-[10px] text-foreground-muted">
                {formatRelativeDate(bill.daysUntil)}
              </p>
            </div>
            <span className="text-sm font-bold font-data tabular-nums text-foreground flex-shrink-0">
              {formatCurrency(bill.amount)}
            </span>
          </div>
        ))}
      </div>

      {bills.length > 5 && (
        <Link
          href="/finance/bills"
          className="text-[11px] text-primary font-medium hover:underline mt-3 inline-block"
        >
          View all →
        </Link>
      )}
    </div>
  )
}
