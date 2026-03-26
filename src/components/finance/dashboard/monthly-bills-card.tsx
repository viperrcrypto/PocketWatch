"use client"

import { useState } from "react"
import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import { MerchantIcon } from "@/components/finance/merchant-icon"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { useUpcomingBills } from "@/hooks/use-finance"

const BILL_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  cc_annual_fee: { label: "Credit Card Annual Fees", icon: "credit_card" },
  cc_payment: { label: "Credit Card Payments", icon: "credit_card" },
  insurance: { label: "Insurance", icon: "shield" },
  membership: { label: "Memberships", icon: "card_membership" },
  subscription: { label: "Subscriptions", icon: "subscriptions" },
  bill: { label: "Other Bills", icon: "receipt_long" },
}

/** Display order for bill type groups */
const GROUP_ORDER = ["cc_payment", "cc_annual_fee", "insurance", "membership", "subscription", "bill"]

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number)
  const date = new Date(y, m - 1, 1)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

interface MonthlyBillsCardProps {
  isHidden: boolean
}

export function MonthlyBillsCard({ isHidden }: MonthlyBillsCardProps) {
  const [month, setMonth] = useState(currentMonth)
  const { data: billsData } = useUpcomingBills(month)

  const groups = billsData?.groups ?? {}
  const monthTotal = billsData?.monthTotal ?? 0

  // Filter to groups that have items, in display order
  const activeGroups = GROUP_ORDER.filter((key) => (groups[key]?.length ?? 0) > 0)

  return (
    <div className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      {/* Header with month navigation */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/30">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>receipt_long</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">{formatMonthLabel(month)} Bills</span>
        </div>
        <span className="font-data text-xs font-medium bg-warning/10 text-warning px-2 py-0.5 rounded-full tabular-nums">
          <BlurredValue isHidden={isHidden}>{formatCurrency(monthTotal)}</BlurredValue>
        </span>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-center gap-3 py-2 border-b border-card-border/20">
        <button
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="p-0.5 rounded hover:bg-background-secondary transition-colors"
        >
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>chevron_left</span>
        </button>
        <span className="text-xs font-medium text-foreground min-w-[120px] text-center">
          {formatMonthLabel(month)}
        </span>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="p-0.5 rounded hover:bg-background-secondary transition-colors"
        >
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>chevron_right</span>
        </button>
      </div>

      {/* Grouped bills */}
      <div className="max-h-[400px] overflow-y-auto">
        {activeGroups.length > 0 ? (
          activeGroups.map((groupKey) => {
            const items = groups[groupKey] ?? []
            const meta = BILL_TYPE_LABELS[groupKey] ?? { label: groupKey, icon: "receipt_long" }
            return (
              <div key={groupKey}>
                <div className="flex items-center gap-2 px-5 py-1.5 bg-background-secondary/50">
                  <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 14 }}>{meta.icon}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">{meta.label}</span>
                </div>
                <div className="divide-y divide-card-border/20">
                  {items.map((bill, idx) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between px-5 py-2 hover:bg-primary-subtle transition-colors animate-slide-in-right"
                      style={{ animationDelay: `${idx * 0.04}s` }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MerchantIcon category={bill.category} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{bill.merchantName}</p>
                          <p className="text-[10px] text-foreground-muted">
                            {bill.isPaid ? "Paid" : bill.daysUntil < 0 ? `${Math.abs(bill.daysUntil)}d overdue` : bill.daysUntil === 0 ? "Due today" : bill.daysUntil === 1 ? "Tomorrow" : `In ${bill.daysUntil} days`}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "font-data text-sm font-semibold tabular-nums flex-shrink-0 ml-2",
                        bill.isPaid ? "text-success" : bill.daysUntil <= 1 ? "text-warning animate-gentle-pulse" : "text-foreground"
                      )}>
                        <BlurredValue isHidden={isHidden}>{formatCurrency(bill.amount)}</BlurredValue>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-sm text-foreground-muted text-center py-8">No bills for {formatMonthLabel(month)}</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-card-border/30">
        <Link href="/finance/budgets" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
          View all subscriptions & bills
        </Link>
      </div>
    </div>
  )
}
