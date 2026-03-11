"use client"

import { useState, useEffect, useMemo } from "react"
import { useFinanceSubscriptions, useUpdateSubscription, useDetectSubscriptions, useUpcomingBills } from "@/hooks/use-finance"
import { formatCurrency, cn } from "@/lib/utils"
import { FinanceHeroCard } from "@/components/finance/finance-hero-card"
import { FinanceStatCard } from "@/components/finance/stat-card"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { SubscriptionCard } from "@/components/finance/subscription-card"
import { BillsCalendar } from "@/components/finance/bills-calendar"
import { CancelGuidanceDrawer } from "@/components/finance/cancel-guidance-drawer"
import { SubscriptionPagination } from "@/components/finance/subscription-pagination"
import { BillsImmediateActions } from "@/components/finance/bills-immediate-actions"

interface CancelTarget {
  id: string
  merchantName: string
  amount: number
  frequency: string
}

const PAGE_SIZE = 10
const FREQUENCY_ORDER = ["weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"] as const
const FREQUENCY_GROUP_LABELS: Record<string, string> = {
  weekly: "Weekly", biweekly: "Biweekly", monthly: "Monthly",
  quarterly: "Quarterly", semi_annual: "Semi-Annual", yearly: "Yearly",
}

export function BudgetSubscriptionsSection() {
  const { data, isLoading, isError } = useFinanceSubscriptions()
  const updateSub = useUpdateSubscription()
  const detectSubs = useDetectSubscriptions()
  const { data: billsData } = useUpcomingBills()
  const [showBanner, setShowBanner] = useState(false)
  const [groupBy, setGroupBy] = useState<"all" | "active" | "paused" | "cancelled" | "flagged">("all")
  const [sortBy, setSortBy] = useState<"flat" | "frequency">("flat")
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (detectSubs.isSuccess) {
      setShowBanner(true)
      const timer = setTimeout(() => setShowBanner(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [detectSubs.isSuccess])

  const subs = data?.subscriptions ?? []
  const activeSubs = subs.filter((s) => s.status === "active")
  const pausedSubs = subs.filter((s) => s.status === "paused")
  const cancelledSubs = subs.filter((s) => s.status === "cancelled")
  const flaggedSubs = subs.filter((s) => !s.isWanted && s.status === "active")
  const potentialSavings = flaggedSubs.reduce((sum, s) => sum + s.amount, 0)

  const filteredSubs = groupBy === "all" ? subs
    : groupBy === "active" ? activeSubs
    : groupBy === "paused" ? pausedSubs
    : groupBy === "flagged" ? flaggedSubs
    : cancelledSubs

  const { paginatedItems, totalPages, totalItems } = useMemo(() => {
    if (sortBy === "frequency") {
      const allOrdered = FREQUENCY_ORDER.flatMap((freq) =>
        filteredSubs.filter((s) => s.frequency === freq).map((s) => ({ ...s, _freq: freq }))
      )
      const total = allOrdered.length
      const pages = Math.ceil(total / PAGE_SIZE)
      const slice = allOrdered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      return { paginatedItems: slice, totalPages: pages, totalItems: total }
    }
    const total = filteredSubs.length
    const pages = Math.ceil(total / PAGE_SIZE)
    const slice = filteredSubs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    return { paginatedItems: slice, totalPages: pages, totalItems: total }
  }, [filteredSubs, sortBy, page])

  const paginatedGroups = useMemo(() => {
    if (sortBy !== "frequency") return null
    const groups: Record<string, typeof paginatedItems> = {}
    for (const item of paginatedItems) {
      const freq = (item as typeof paginatedItems[number] & { _freq: string })._freq
      if (!groups[freq]) groups[freq] = []
      groups[freq].push(item)
    }
    return groups
  }, [paginatedItems, sortBy])

  const GROUP_OPTIONS = [
    { key: "all", label: "All", count: subs.length },
    { key: "active", label: "Active", count: activeSubs.length },
    { key: "paused", label: "Paused", count: pausedSubs.length },
    { key: "cancelled", label: "Cancelled", count: cancelledSubs.length },
    { key: "flagged", label: "Flagged", count: flaggedSubs.length },
  ] as const

  function handleFilterChange(key: typeof groupBy) {
    setGroupBy(key)
    setPage(1)
  }

  function renderSubCard(sub: (typeof subs)[number]) {
    return (
      <SubscriptionCard
        key={sub.id}
        id={sub.id}
        merchantName={sub.merchantName}
        nickname={sub.nickname}
        amount={sub.amount}
        frequency={sub.frequency}
        status={sub.status}
        isWanted={sub.isWanted}
        nextChargeDate={sub.nextChargeDate}
        category={sub.category}
        logoUrl={sub.logoUrl}
        detectionMethod={sub.detectionMethod}
        averageAmount={sub.averageAmount}
        accountName={sub.accountName}
        accountMask={sub.accountMask}
        accountType={sub.accountType}
        institutionName={sub.institutionName}
        recentTransactions={sub.recentTransactions}
        onUpdateStatus={(id, status) => updateSub.mutate({ subscriptionId: id, status })}
        onToggleWanted={(id, isWanted) => updateSub.mutate({ subscriptionId: id, isWanted })}
        onRequestCancel={setCancelTarget}
        onUpdateNickname={(id, nickname) => updateSub.mutate({ subscriptionId: id, nickname })}
        onUpdateFrequency={(id, frequency) => updateSub.mutate({ subscriptionId: id, frequency })}
        onUpdateCategory={(id, category) => updateSub.mutate({ subscriptionId: id, category })}
        onDismiss={(id) => updateSub.mutate({ subscriptionId: id, status: "dismissed" })}
      />
    )
  }

  if (isError) {
    return (
      <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
        <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
        <p className="text-sm text-error">Failed to load subscriptions.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Detect button */}
      <div className="flex items-center justify-between">
        <p className="text-foreground-muted text-sm">
          {isLoading ? "" : `${activeSubs.length} active subscriptions`}
        </p>
        <button
          onClick={() => detectSubs.mutate()}
          disabled={detectSubs.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            {detectSubs.isPending ? "hourglass_top" : "search"}
          </span>
          {detectSubs.isPending ? "Detecting..." : "Detect New"}
        </button>
      </div>

      {/* Detection Banner */}
      {showBanner && detectSubs.data && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-success" style={{ fontSize: 20 }}>check_circle</span>
            <p className="text-sm text-success">
              Found {detectSubs.data.detected} recurring charges, added {detectSubs.data.newlyAdded} new
              {detectSubs.data.updated > 0 && `, updated ${detectSubs.data.updated} existing`}.
            </p>
          </div>
          <button onClick={() => setShowBanner(false)} className="text-success/60 hover:text-success transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {/* Hero + Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <FinanceCardSkeleton key={i} />)}
        </div>
      ) : data && subs.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <FinanceStatCard label="Active" value={String(activeSubs.length)} icon="autorenew" accentColor="var(--success)" />
          <FinanceStatCard label="Monthly Total" value={formatCurrency(data.monthlyTotal)} icon="calendar_month" accentColor="var(--primary)" />
          <FinanceStatCard label="Annual Total" value={formatCurrency(data.yearlyTotal)} icon="event" />
          <FinanceStatCard label="Potential Savings" value={formatCurrency(potentialSavings)} icon="savings" accentColor={potentialSavings > 0 ? "var(--warning)" : undefined} />
        </div>
      ) : null}

      {/* Immediate Actions */}
      {billsData && <BillsImmediateActions bills={billsData.bills} />}

      {/* Two-column: Subscriptions + Bills Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Group Filter */}
          {subs.length > 0 && (
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-background-secondary border border-card-border p-0.5 rounded-lg w-fit">
              {GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleFilterChange(opt.key as typeof groupBy)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-medium rounded-md transition-all duration-150",
                    groupBy === opt.key
                      ? "bg-primary text-white shadow-sm"
                      : "bg-transparent text-foreground-muted hover:text-foreground"
                  )}
                >
                  {opt.label}
                  {opt.count > 0 && (
                    <span className={cn("ml-1 tabular-nums", groupBy === opt.key ? "text-white/70" : "text-foreground-muted/50")}>
                      {opt.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Sort toggle */}
          {filteredSubs.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-foreground-muted">Group by:</span>
              <button
                onClick={() => { setSortBy(sortBy === "flat" ? "frequency" : "flat"); setPage(1) }}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium rounded-lg border transition-colors",
                  sortBy === "frequency"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-card-border text-foreground-muted hover:text-foreground"
                )}
              >
                {sortBy === "frequency" ? "Frequency" : "None"}
              </button>
            </div>
          )}

          {!isLoading && filteredSubs.length > 0 ? (
            <>
              {paginatedGroups ? (
                <div className="space-y-4">
                  {FREQUENCY_ORDER.map((freq) => {
                    const items = paginatedGroups[freq]
                    if (!items || items.length === 0) return null
                    return (
                      <div key={freq}>
                        <h4 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
                          {FREQUENCY_GROUP_LABELS[freq] ?? freq}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {items.map(renderSubCard)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paginatedItems.map(renderSubCard)}
                </div>
              )}
              <SubscriptionPagination
                page={page}
                totalPages={totalPages}
                total={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          ) : !isLoading ? (
            <FinanceEmpty
              icon="autorenew"
              title={groupBy === "all" ? "No subscriptions detected" : `No ${groupBy} subscriptions`}
              description={groupBy === "all" ? "Click 'Detect New' to scan your transactions for recurring charges." : "No subscriptions match this filter."}
              action={groupBy === "all" ? { label: "Detect Subscriptions", onClick: () => detectSubs.mutate() } : undefined}
            />
          ) : null}
        </div>

        {/* Bills Calendar Widget */}
        {billsData && billsData.bills.length > 0 && (
          <div className="space-y-4">
            <div className="bg-card border border-card-border rounded-xl p-5">
              <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                Upcoming Bills
              </span>
              <div className="mt-3">
                <BillsCalendar bills={billsData.bills} />
              </div>
            </div>

            {billsData.countDueThisWeek > 0 && (
              <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center">
                    <span className="material-symbols-rounded text-amber-600 dark:text-amber-500" style={{ fontSize: 16 }}>schedule</span>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Due This Week</span>
                </div>
                <div className="space-y-2">
                  {billsData.bills.filter((b) => b.daysUntil <= 7).map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", bill.daysUntil <= 3 ? "bg-amber-500" : "bg-foreground-muted/30")} />
                        <span className="text-xs text-foreground truncate max-w-[180px]">{bill.merchantName}</span>
                      </div>
                      <span className="font-data text-xs font-medium text-foreground tabular-nums">{formatCurrency(bill.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-amber-500/10 flex justify-between">
                  <span className="text-[10px] text-foreground-muted">Total</span>
                  <span className="font-data text-xs font-semibold text-amber-500 tabular-nums">{formatCurrency(billsData.totalDueThisWeek)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recurring Income */}
      {data?.inflows && data.inflows.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <span className="material-symbols-rounded text-success" style={{ fontSize: 18 }}>trending_up</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Recurring Income</span>
          </div>
          <div className="divide-y divide-card-border/50">
            {data.inflows.map((stream) => (
              <div key={stream.streamId} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{stream.merchantName}</p>
                  <p className="text-[10px] text-foreground-muted">{stream.frequency}</p>
                </div>
                <div className="text-right">
                  <span className="font-data text-sm font-semibold text-success tabular-nums">+{formatCurrency(stream.amount)}</span>
                  {stream.averageAmount != null && Math.abs(stream.averageAmount - stream.amount) > 0.01 && (
                    <p className="text-[10px] text-foreground-muted tabular-nums">avg {formatCurrency(stream.averageAmount)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CancelGuidanceDrawer target={cancelTarget} onClose={() => setCancelTarget(null)} />
    </div>
  )
}
