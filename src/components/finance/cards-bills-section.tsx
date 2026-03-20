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
  logoUrl?: string | null
  accountName?: string | null
  accountMask?: string | null
  institutionName?: string | null
}

interface CardsBillsSectionProps {
  upcomingCount: number
  upcomingTotal: number
  monthlyBillsTotal: number
  totalBalance: number
  nextDue: Bill | undefined
  bills: Bill[]
  paidCount?: number
}

export function CardsBillsSection({
  upcomingCount, upcomingTotal, monthlyBillsTotal,
  totalBalance, nextDue, bills, paidCount = 0,
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
            { label: "Monthly Bills", value: formatCurrency(monthlyBillsTotal) },
            { label: "Paid", value: `${paidCount} bill${paidCount !== 1 ? "s" : ""}`, color: paidCount > 0 ? "success" : undefined },
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

type BillTab = "subscriptions" | "card_payments"

function BillsGrid({ bills: defaultBills }: { bills: Bill[] }) {
  const calRef = useRef<HTMLDivElement>(null)
  const [calHeight, setCalHeight] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<BillTab>("subscriptions")
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

  useEffect(() => {
    const el = calRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setCalHeight(entry.contentRect.height + 40)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const subscriptions = bills.filter((b) => b.billType !== "cc_payment")
  const cardPayments = bills.filter((b) => b.billType === "cc_payment")
  const activeBills = activeTab === "subscriptions" ? subscriptions : cardPayments

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-start">
      <div ref={calRef} className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
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
        <BillsCalendar bills={bills} onSelectBill={setSelectedBill} onMonthChange={handleMonthChange} />
      </div>

      <TabbedBillPanel
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bills={activeBills}
        subsCount={subscriptions.length}
        ccCount={cardPayments.length}
        maxHeight={calHeight}
        onSelectBill={setSelectedBill}
      />

      <BillDetailPanel bill={selectedBill} onClose={() => setSelectedBill(null)} />
    </div>
  )
}

function TabbedBillPanel({
  activeTab,
  onTabChange,
  bills,
  subsCount,
  ccCount,
  maxHeight,
  onSelectBill,
}: {
  activeTab: BillTab
  onTabChange: (tab: BillTab) => void
  bills: Bill[]
  subsCount: number
  ccCount: number
  maxHeight: number | null
  onSelectBill: (bill: Bill) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
  }, [])

  useEffect(() => {
    checkScroll()
  }, [bills, checkScroll])

  // Reset scroll position on tab change
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = 0
  }, [activeTab])

  const emptyText = activeTab === "subscriptions"
    ? "No subscriptions this month"
    : "No card payments this month"

  return (
    <div
      className="bg-card border border-card-border rounded-xl overflow-hidden flex flex-col"
      style={maxHeight ? { maxHeight: maxHeight - 8 } : undefined}
    >
      {/* Header with tabs + manage link */}
      <div className="px-4 py-3 border-b border-card-border/50 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => onTabChange("subscriptions")}
            className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
              activeTab === "subscriptions"
                ? "bg-primary text-white shadow-sm"
                : "bg-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            Subscriptions ({subsCount})
          </button>
          <button
            type="button"
            onClick={() => onTabChange("card_payments")}
            className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
              activeTab === "card_payments"
                ? "bg-primary text-white shadow-sm"
                : "bg-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            Card Payments ({ccCount})
          </button>
        </div>
        {activeTab === "subscriptions" && (
          <a
            href="/finance/budgets"
            className="text-[10px] font-medium text-primary hover:text-primary-hover transition-colors whitespace-nowrap"
          >
            Manage Subscriptions
          </a>
        )}
      </div>

      {/* Scrollable bill list */}
      <div className="relative flex flex-col flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="divide-y divide-card-border/30 overflow-y-auto flex-1 min-h-0"
        >
          {bills.length === 0 ? (
            <p className="text-sm text-foreground-muted text-center py-8">{emptyText}</p>
          ) : bills.map((bill) => (
            <BillRow key={bill.id} bill={bill} onClick={() => onSelectBill(bill)} />
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
