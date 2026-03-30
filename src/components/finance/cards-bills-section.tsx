"use client"

/**
 * Bills section for the Credit Cards page: hero stats, calendar, and tabbed timeline.
 */

import { useRef, useState, useEffect, useCallback } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { FinanceHeroCard } from "@/components/finance/finance-hero-card"
import { BillsCalendar } from "@/components/finance/bills-calendar"
import { BillAvatar } from "@/components/finance/bill-avatar"
import { BillDetailPanel } from "@/components/finance/bill-detail-panel"
import { getCancelUrl } from "@/lib/finance/cancel-links"
import { useUpcomingBills } from "@/hooks/use-finance"

interface Bill {
  id: string
  merchantName: string
  amount: number
  daysUntil: number
  frequency: string
  nextDueDate: string
  category: string | null
  billType?: string | null
  isPaid?: boolean
  lastTransactionId?: string | null
  logoUrl?: string | null
  accountName?: string | null
  accountMask?: string | null
  institutionName?: string | null
}

interface CardsBillsSectionProps {
  upcomingCount: number
  upcomingTotal: number
  obligationsTotal: number
  cardPaymentsTotal: number
  totalBalance: number
  nextDue: Bill | undefined
  bills: Bill[]
  paidCount?: number
}

export function CardsBillsSection({
  upcomingCount, upcomingTotal, obligationsTotal,
  cardPaymentsTotal, totalBalance, nextDue, bills, paidCount = 0,
}: CardsBillsSectionProps) {
  return (
    <>
      <div>
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>receipt_long</span>
          Upcoming Bills
        </h3>
        <FinanceHeroCard
          label="Coming Up"
          value={`${upcomingCount} upcoming · ${formatCurrency(upcomingTotal)}`}
          footerStats={[
            { label: "Bills & Subscriptions", value: formatCurrency(obligationsTotal) },
            { label: "Card Payments", value: formatCurrency(cardPaymentsTotal) },
            {
              label: "Next Due",
              value: nextDue
                ? (nextDue.daysUntil === 0 ? "Today" : nextDue.daysUntil === 1 ? "Tomorrow" : `${nextDue.daysUntil} days`)
                : "\u2014",
            },
          ]}
        />
      </div>

      <BillsGrid bills={bills} />
    </>
  )
}

const BILL_FILTER_KEY = "pw-bill-filters"
const ALL_BILL_TYPES = ["subscription", "cc_payment", "cc_annual_fee", "insurance", "membership", "bill"]
const FILTER_PILLS = [
  { type: "subscription", label: "Subscriptions" },
  { type: "cc_payment", label: "Card Payments" },
  { type: "cc_annual_fee", label: "Annual Fees" },
  { type: "insurance", label: "Insurance" },
]

function loadFilters(): Set<string> {
  if (typeof window === "undefined") return new Set(ALL_BILL_TYPES)
  try {
    const saved = localStorage.getItem(BILL_FILTER_KEY)
    return saved ? new Set(JSON.parse(saved) as string[]) : new Set(ALL_BILL_TYPES)
  } catch { return new Set(ALL_BILL_TYPES) }
}

function BillsGrid({ bills: defaultBills }: { bills: Bill[] }) {
  const calRef = useRef<HTMLDivElement>(null)
  const [calHeight, setCalHeight] = useState<number | null>(null)
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(loadFilters)
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)

  // Track calendar month to re-fetch bills (CC bills are month-specific)
  const now = new Date()
  const [calendarMonth, setCalendarMonth] = useState(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  )
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const isCurrentMonth = calendarMonth === currentMonth

  const { data: monthData } = useUpcomingBills(isCurrentMonth ? undefined : calendarMonth)
  const bills = isCurrentMonth ? defaultBills : (monthData?.bills ?? defaultBills)

  const handleMonthChange = useCallback((year: number, month: number) => {
    setCalendarMonth(`${year}-${String(month + 1).padStart(2, "0")}`)
  }, [])

  const toggleType = useCallback((type: string) => {
    setVisibleTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      localStorage.setItem(BILL_FILTER_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  useEffect(() => {
    const el = calRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setCalHeight(entry.contentRect.height + 40)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const filteredBills = bills.filter((b) => visibleTypes.has(b.billType ?? "bill"))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-start">
      <div ref={calRef} className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Bills Calendar
          </span>
          <a
            href="/finance/budgets"
            className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary-hover transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 13 }}>tune</span>
            Manage Subscriptions
          </a>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {FILTER_PILLS.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors",
                visibleTypes.has(type)
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-card-border/20 text-foreground-muted border-card-border/50 line-through"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <BillsCalendar bills={filteredBills} onSelectBill={setSelectedBill} onMonthChange={handleMonthChange} />
      </div>

      <BillListPanel
        bills={filteredBills}
        maxHeight={calHeight}
        onSelectBill={setSelectedBill}
      />

      <BillDetailPanel bill={selectedBill} onClose={() => setSelectedBill(null)} />
    </div>
  )
}

const BILL_GROUPS: { type: string; label: string; icon: string; color: string }[] = [
  { type: "cc_payment", label: "Card Payments", icon: "credit_card", color: "text-amber-500" },
  { type: "subscription", label: "Subscriptions", icon: "subscriptions", color: "text-violet-500" },
  { type: "insurance", label: "Insurance", icon: "health_and_safety", color: "text-blue-500" },
  { type: "cc_annual_fee", label: "Annual Fees", icon: "calendar_month", color: "text-rose-500" },
  { type: "membership", label: "Memberships", icon: "card_membership", color: "text-emerald-500" },
  { type: "bill", label: "Bills & Utilities", icon: "receipt_long", color: "text-sky-500" },
]

function BillListPanel({
  bills,
  maxHeight,
  onSelectBill,
}: {
  bills: Bill[]
  maxHeight: number | null
  onSelectBill: (bill: Bill) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapse = useCallback((type: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }, [])

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
  }, [])

  useEffect(() => {
    checkScroll()
  }, [bills, checkScroll])

  const grouped = BILL_GROUPS
    .map(g => ({
      ...g,
      items: bills.filter(b => (b.billType ?? "bill") === g.type),
      total: bills.filter(b => (b.billType ?? "bill") === g.type).reduce((s, b) => s + b.amount, 0),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div
      className="bg-card border border-card-border rounded-xl overflow-hidden flex flex-col"
      style={maxHeight ? { maxHeight: maxHeight - 8 } : undefined}
    >
      <div className="px-4 py-3 border-b border-card-border/50 flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          {bills.length} Payment{bills.length !== 1 ? "s" : ""} This Month
        </span>
      </div>

      <div className="relative flex flex-col flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="overflow-y-auto flex-1 min-h-0"
        >
          {bills.length === 0 ? (
            <p className="text-sm text-foreground-muted text-center py-8">No bills match your filters</p>
          ) : grouped.map(group => (
            <div key={group.type}>
              <button
                type="button"
                onClick={() => toggleCollapse(group.type)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-background-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 14 }}>
                    {collapsed.has(group.type) ? "chevron_right" : "expand_more"}
                  </span>
                  <span className={cn("material-symbols-rounded", group.color)} style={{ fontSize: 14 }}>
                    {group.icon}
                  </span>
                  <span className="text-xs font-semibold text-foreground">{group.label}</span>
                  <span className="text-[10px] text-foreground-muted">({group.items.length})</span>
                </div>
                <span className="text-xs font-semibold tabular-nums text-foreground-muted">
                  {formatCurrency(group.total)}
                </span>
              </button>
              {!collapsed.has(group.type) && (
                <div className="divide-y divide-card-border/30">
                  {group.items.map(bill => (
                    <BillRow key={bill.id} bill={bill} onClick={() => onSelectBill(bill)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {!isAtBottom && bills.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none flex items-end justify-center pb-1">
            <span className="material-symbols-rounded text-foreground-muted/50 animate-bounce" style={{ fontSize: 14 }}>
              keyboard_arrow_down
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function BillRow({ bill, onClick }: { bill: Bill; onClick: () => void }) {
  const cancelInfo = getCancelUrl(bill.merchantName)
  const isSubscription = bill.billType !== "cc_payment"

  return (
    <div
      className={cn(
        "px-5 py-2.5 cursor-pointer hover:bg-background-secondary/50 transition-colors",
        bill.isPaid && "opacity-60"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <BillAvatar merchantName={bill.merchantName} logoUrl={bill.logoUrl} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{bill.merchantName}</p>
            <p className="text-[10px] text-foreground-muted">
              {bill.isPaid ? `Paid ${new Date(bill.nextDueDate + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` :
               bill.daysUntil === 0 ? "Due today" :
               bill.daysUntil === 1 ? "Tomorrow" :
               `In ${bill.daysUntil} days`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {bill.isPaid && (
            <span className="material-symbols-rounded text-success" style={{ fontSize: 14 }}>check_circle</span>
          )}
          <span className={cn(
            "font-data text-sm font-semibold tabular-nums",
            bill.isPaid ? "text-foreground-muted" : "text-foreground"
          )}>
            {formatCurrency(bill.amount)}
          </span>
        </div>
      </div>

      {/* Quick actions — cancel link for subscriptions */}
      {!bill.isPaid && isSubscription && cancelInfo && (
        <div className="flex items-center gap-2 mt-1.5 ml-10">
          <a
            href={cancelInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium text-primary hover:bg-primary-muted rounded transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 11 }}>open_in_new</span>
            Cancel Now
          </a>
          {cancelInfo.note && (
            <span className="text-[9px] text-foreground-muted/60 truncate max-w-[180px]" title={cancelInfo.note}>
              {cancelInfo.note}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
