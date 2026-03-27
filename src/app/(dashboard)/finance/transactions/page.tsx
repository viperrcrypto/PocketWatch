"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  useFinanceTransactions, useFinanceAccounts,
  useAutoCategorize, useFinanceDeepInsights,
  useUpdateTransactionCategory, useReviewCount,
} from "@/hooks/use-finance"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { FinanceTableSkeleton } from "@/components/finance/finance-loading"
import { TransactionRow } from "@/components/finance/transaction-row"
import { getCategoryMeta, FINANCE_CATEGORIES } from "@/lib/finance/categories"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { BulkActionBar } from "@/components/finance/bulk-action-bar"

const DATE_PRESETS = [
  { key: "this-month", label: "This Month" },
  { key: "last-month", label: "Last Month" },
  { key: "3-months", label: "3M" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All" },
] as const

function getDateRange(preset: string): { start?: string; end?: string } {
  const now = new Date()
  switch (preset) {
    case "this-month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0] }
    case "last-month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: s.toISOString().split("T")[0], end: e.toISOString().split("T")[0] }
    }
    case "3-months":
      return { start: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split("T")[0] }
    case "ytd":
      return { start: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0] }
    case "all":
    default:
      return {}
  }
}

const categoryKeys = Object.keys(FINANCE_CATEGORIES)

export default function FinanceTransactionsPage() {
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get("search") ?? ""
  const highlightId = searchParams.get("highlight") ?? ""
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(initialSearch)
  const [category, setCategory] = useState(searchParams.get("category") ?? "")
  const [accountId, setAccountId] = useState(searchParams.get("account") ?? "")
  const [dateRange, setDateRange] = useState(category || initialSearch ? "all" : "this-month")
  const [txType, setTxType] = useState("")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Clear selections when page/filters change — track previous data identity
  const prevDataRef = useRef<string>("")
  useEffect(() => {
    const key = `${page}-${dateRange}-${category}-${accountId}-${txType}-${search}`
    if (prevDataRef.current && prevDataRef.current !== key) {
      setSelectedIds(new Set())
    }
    prevDataRef.current = key
  }, [page, dateRange, category, accountId, txType, search])

  const dates = dateRange === "custom"
    ? { start: customStart || undefined, end: customEnd || undefined }
    : getDateRange(dateRange)
  const { data, isLoading, isError } = useFinanceTransactions({
    page,
    limit: 50,
    search: search || undefined,
    category: category || undefined,
    accountId: accountId || undefined,
    startDate: dates.start,
    endDate: dates.end,
    txType: txType || undefined,
  })
  const { data: institutions } = useFinanceAccounts()
  const { data: deep } = useFinanceDeepInsights()
  const autoCategorize = useAutoCategorize()
  const updateCategory = useUpdateTransactionCategory()
  const total = data?.pagination.total ?? 0
  const totalPages = data?.pagination.totalPages ?? 1
  const from = total > 0 ? (page - 1) * 50 + 1 : 0
  const to = Math.min(page * 50, total)

  const { data: reviewData } = useReviewCount()

  // Scroll to highlighted transaction (from subscription proof link)
  useEffect(() => {
    if (!highlightId || !data?.transactions) return
    const el = document.getElementById(`tx-${highlightId}`)
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300)
    }
  }, [highlightId, data?.transactions])
  const reviewCount = reviewData?.count ?? 0
  const hasFilters = search || category || accountId || txType || dateRange !== "this-month"
  const uncategorizedCount = deep?.uncategorizedCount ?? 0
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <FinancePageHeader
          title="Transactions"
          subtitle={isLoading ? undefined : (
            <>
              {total.toLocaleString()} transactions
              {uncategorizedCount > 0 && (
                <> &middot; <span className="text-amber-500 font-semibold">{uncategorizedCount} need categorizing</span></>
              )}
            </>
          )}
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          {uncategorizedCount > 0 && (
            <Link
              href="/finance/categorize"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>checklist</span>
              Review
            </Link>
          )}
          <Link
            href="/finance/categorize?mode=rebuild"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-card-border rounded-lg hover:bg-background-secondary transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>auto_awesome</span>
            AI Categorize
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Timeframe pills */}
          <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg overflow-x-auto flex-shrink-0">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => { setDateRange(preset.key); setPage(1) }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150",
                  dateRange === preset.key
                    ? "bg-primary text-white shadow-sm"
                    : "bg-transparent text-foreground-muted hover:text-foreground"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Transaction type filter */}
          <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg overflow-x-auto flex-shrink-0">
            {([
              { key: "", label: "All" },
              { key: "charges", label: "Charges" },
              { key: "refunds", label: "Refunds" },
              { key: "pending", label: "Pending" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => { setTxType(opt.key); setPage(1) }}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-150",
                  txType === opt.key
                    ? "bg-primary text-white shadow-sm"
                    : "bg-transparent text-foreground-muted hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customStart}
              onChange={(e) => { setCustomStart(e.target.value); setDateRange("custom"); setPage(1) }}
              className="px-2 py-1.5 rounded-lg bg-background-secondary border border-card-border text-xs text-foreground"
              placeholder="From"
            />
            <span className="text-xs text-foreground-muted">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => { setCustomEnd(e.target.value); setDateRange("custom"); setPage(1) }}
              className="px-2 py-1.5 rounded-lg bg-background-secondary border border-card-border text-xs text-foreground"
              placeholder="To"
            />
          </div>

          {/* Category dropdown with color dots */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1) }}
              className="appearance-none px-3 py-1.5 pr-7 rounded-lg bg-background-secondary border border-card-border text-xs text-foreground cursor-pointer"
            >
              <option value="">All Categories</option>
              {categoryKeys.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <span className="material-symbols-rounded absolute right-1.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" style={{ fontSize: 14 }}>
              expand_more
            </span>
          </div>

          {/* Active category indicator */}
          {category && (
            <button
              onClick={() => { setCategory(""); setPage(1) }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-foreground border transition-colors hover:bg-background-secondary"
              style={{
                borderColor: getCategoryMeta(category).hex,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getCategoryMeta(category).hex }}
              />
              {category}
              <span className="material-symbols-rounded" style={{ fontSize: 12 }}>close</span>
            </button>
          )}

          <div className="relative">
            <select
              value={accountId}
              onChange={(e) => { setAccountId(e.target.value); setPage(1) }}
              className="appearance-none px-3 py-1.5 pr-7 rounded-lg bg-background-secondary border border-card-border text-xs text-foreground cursor-pointer"
            >
              <option value="">All Accounts</option>
              {institutions?.map((inst) =>
                inst.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.mask ? ` ••${a.mask}` : ""} ({inst.institutionName})
                  </option>
                ))
              )}
            </select>
            <span className="material-symbols-rounded absolute right-1.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" style={{ fontSize: 14 }}>
              expand_more
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0 sm:min-w-[180px] px-3 py-1.5 rounded-lg bg-background-secondary border border-card-border">
            <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 16 }}>search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search merchants, descriptions..."
              className="flex-1 min-w-0 bg-transparent border-0 text-xs text-foreground placeholder:text-foreground-muted/50 outline-none"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(1) }}
                className="text-foreground-muted hover:text-foreground transition-colors flex-shrink-0"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      {isLoading ? (
        <FinanceTableSkeleton rows={8} />
      ) : isError ? (
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load transactions. Please try again.</p>
        </div>
      ) : data?.transactions.length ? (
        <>
        <BulkActionBar selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} />
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {/* Elevated Header */}
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-card-border bg-card-elevated text-[10px] text-foreground-muted font-semibold uppercase tracking-widest">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 rounded accent-primary flex-shrink-0"
              checked={data.transactions.length > 0 && data.transactions.every((tx) => selectedIds.has(tx.id))}
              onChange={(e) => {
                const next = new Set(selectedIds)
                if (e.target.checked) data.transactions.forEach((tx) => next.add(tx.id))
                else data.transactions.forEach((tx) => next.delete(tx.id))
                setSelectedIds(next)
              }}
              title="Select all on this page"
            />
            <div className="w-10 sm:w-16">Date</div>
            <div className="flex-1">Description</div>
            <div className="w-28 hidden md:block">Category</div>
            <div className="w-24 text-right">Amount</div>
            <div className="w-5" />
          </div>

          {data.transactions.map((tx) => (
            <div key={tx.id} className="flex items-center">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 rounded accent-primary flex-shrink-0 ml-3 sm:ml-4"
                checked={selectedIds.has(tx.id)}
                onChange={(e) => {
                  const next = new Set(selectedIds)
                  if (e.target.checked) next.add(tx.id)
                  else next.delete(tx.id)
                  setSelectedIds(next)
                }}
              />
              <div className="flex-1 min-w-0">
            <TransactionRow
              key={tx.id}
              id={tx.id}
              isHighlighted={tx.id === highlightId}
              date={tx.date}
              merchantName={tx.merchantName}
              name={tx.name}
              amount={tx.amount}
              category={tx.category}
              subcategory={tx.subcategory}
              notes={tx.notes}
              isPending={tx.isPending}
              accountName={tx.account.name}
              accountMask={tx.account.mask}
              paymentChannel={tx.paymentChannel}
              authorizedDate={tx.authorizedDate}
              logoUrl={tx.logoUrl}
              website={tx.website}
              location={tx.location}
              counterparties={tx.counterparties}
              needsReview={tx.needsReview}
              onCategoryChange={(newCategory, createRule) =>
                updateCategory.mutate({
                  transactionId: tx.id,
                  category: newCategory,
                  createRule,
                })
              }
            />
              </div>
            </div>
          ))}
        </div>
        </>
      ) : (
        <FinanceEmpty
          icon={hasFilters ? "filter_list_off" : "receipt_long"}
          title={hasFilters ? "No transactions match your filters" : "No transactions yet"}
          description={
            hasFilters
              ? "Try adjusting your date range, category, or search terms."
              : "Connect a bank account and sync to import transactions."
          }
          linkTo={hasFilters ? undefined : { label: "Connect accounts", href: "/finance/accounts" }}
        />
      )}

      {/* Pagination */}
      {total > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
          <p className="text-xs text-foreground-muted tabular-nums">
            Showing {from}–{to} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="hidden sm:inline-flex px-2 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30" title="First page">
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>first_page</span>
            </button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 sm:px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30">
              <span className="material-symbols-rounded sm:hidden" style={{ fontSize: 14 }}>chevron_left</span>
              <span className="hidden sm:inline">Previous</span>
            </button>
            <span className="px-3 py-1.5 text-xs font-data tabular-nums text-foreground-muted">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 sm:px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30">
              <span className="material-symbols-rounded sm:hidden" style={{ fontSize: 14 }}>chevron_right</span>
              <span className="hidden sm:inline">Next</span>
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="hidden sm:inline-flex px-2 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30" title="Last page">
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>last_page</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
