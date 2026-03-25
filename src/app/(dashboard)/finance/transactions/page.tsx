"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  useFinanceTransactions, useFinanceAccounts,
  useAutoCategorize, useFinanceDeepInsights,
  useUpdateTransactionCategory,
} from "@/hooks/use-finance"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { FinanceTableSkeleton } from "@/components/finance/finance-loading"
import { TransactionRow } from "@/components/finance/transaction-row"
import { getCategoryMeta, FINANCE_CATEGORIES } from "@/lib/finance/categories"
import { cn } from "@/lib/utils"
import Link from "next/link"

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
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState(searchParams.get("category") ?? "")
  const [accountId, setAccountId] = useState(searchParams.get("account") ?? "")
  const [dateRange, setDateRange] = useState(category ? "all" : "this-month")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

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
  })
  const { data: institutions } = useFinanceAccounts()
  const { data: deep } = useFinanceDeepInsights()
  const autoCategorize = useAutoCategorize()
  const updateCategory = useUpdateTransactionCategory()
  const total = data?.pagination.total ?? 0
  const totalPages = data?.pagination.totalPages ?? 1
  const from = total > 0 ? (page - 1) * 50 + 1 : 0
  const to = Math.min(page * 50, total)

  const hasFilters = search || category || accountId || dateRange !== "this-month"
  const uncategorizedCount = deep?.uncategorizedCount ?? 0

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Transactions"
        subtitle={isLoading ? undefined : `${total.toLocaleString()} transactions`}
      />

      {/* Uncategorized Alert */}
      {uncategorizedCount > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <span className="material-symbols-rounded text-warning" style={{ fontSize: 20 }}>label_off</span>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {uncategorizedCount} uncategorized transaction{uncategorizedCount > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-foreground-muted">Categorize for better insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                try {
                  autoCategorize.mutate(undefined, {
                    onSuccess: (result) => {
                      if (result.categorized > 0) {
                        toast.success(`Categorized ${result.categorized} transaction${result.categorized > 1 ? "s" : ""}${result.remaining > 0 ? ` (${result.remaining} remaining)` : ""}`)
                      } else {
                        toast.info("No matches found. Try Manual Review or AI Categorize.")
                      }
                    },
                    onError: (err) => toast.error(err.message ?? "Auto-categorize failed"),
                  })
                } catch {
                  toast.error("Auto-categorize failed to start")
                }
              }}
              disabled={autoCategorize.isPending}
              className="px-3 py-1.5 text-xs border border-warning/30 rounded-lg hover:bg-warning/10 transition-colors disabled:opacity-50"
            >
              <span className="font-medium text-warning">
                {autoCategorize.isPending ? "Working..." : "Quick Fix"}
              </span>
              <span className="block text-[10px] text-warning/60">Local rules — instant</span>
            </button>
            <Link
              href="/finance/categorize"
              className="px-3 py-1.5 text-xs border border-card-border rounded-lg hover:bg-background-secondary transition-colors text-center"
            >
              <span className="font-medium text-foreground">Review Manually</span>
              <span className="block text-[10px] text-foreground-muted">One at a time</span>
            </Link>
            <Link
              href="/finance/categorize?mode=ai"
              className="px-3 py-1.5 text-xs border border-primary/30 bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors text-center flex flex-col items-center"
            >
              <span className="font-medium text-primary flex items-center gap-1">
                <span className="material-symbols-rounded" style={{ fontSize: 12 }}>auto_awesome</span>
                AI Categorize All
              </span>
              <span className="block text-[10px] text-primary/60">Uses AI — reviews all at once</span>
            </Link>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe pills */}
          <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg">
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

          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-rounded absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted" style={{ fontSize: 16 }}>
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search merchants, descriptions..."
              className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-background-secondary border border-card-border text-xs text-foreground placeholder:text-foreground-muted/50"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(1) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
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
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {/* Elevated Header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-card-border bg-card-elevated text-[10px] text-foreground-muted font-medium uppercase tracking-widest">
            <div className="w-16">Date</div>
            <div className="flex-1">Description</div>
            <div className="w-28 hidden md:block">Category</div>
            <div className="w-24 text-right">Amount</div>
            <div className="w-5" />
          </div>

          {data.transactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              id={tx.id}
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
          ))}
        </div>
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
        <div className="flex items-center justify-between">
          <p className="text-xs text-foreground-muted tabular-nums">
            Showing {from}–{to} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30"
              title="First page"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>first_page</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs font-data tabular-nums text-foreground-muted">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30"
              title="Last page"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>last_page</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
