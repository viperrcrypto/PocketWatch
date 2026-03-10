"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useExchangeTransactions, useRefreshExchangeTransactions } from "@/hooks/use-portfolio-tracker"
import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { PortfolioSubNav } from "@/components/portfolio/portfolio-sub-nav"
import { PortfolioDataTable } from "@/components/portfolio/portfolio-data-table"
import { PortfolioEmpty } from "@/components/portfolio/portfolio-empty"
import { HISTORY_SUB_TABS } from "@/lib/portfolio/nav"
import type { ExchangeTransaction, ExchangeCapability } from "@/components/portfolio/history/exchange/exchange-types"
import { useExchangeColumns } from "@/components/portfolio/history/exchange/exchange-columns"
import { ExchangeFilterBar } from "@/components/portfolio/history/exchange/exchange-filter-bar"
import {
  UnsupportedExchangeBanners,
  ErroredExchangeBanners,
  ExchangeSyncStatusBar,
  ExchangeErrorBanner,
  ExchangeRefreshBanner,
} from "@/components/portfolio/history/exchange/exchange-status-banners"

export default function ExchangeHistoryPage() {
  const { data, isLoading, isError, error } = useExchangeTransactions()
  const refreshTransactions = useRefreshExchangeTransactions()
  const refreshExchangeHistory = refreshTransactions.mutate
  const router = useRouter()
  const autoRefreshTriggeredRef = useRef(false)

  // Filter state
  const [exchangeFilter, setExchangeFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [assetFilter, setAssetFilter] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  // Parse response
  const { transactions, capabilities } = useMemo(() => {
    if (!data || typeof data !== "object") {
      return { transactions: [] as ExchangeTransaction[], capabilities: [] as ExchangeCapability[] }
    }
    return {
      transactions: Array.isArray((data as any).transactions) ? (data as any).transactions : [],
      capabilities: Array.isArray((data as any).capabilities) ? (data as any).capabilities : [],
    }
  }, [data])

  // Unique exchanges for filter dropdown
  const exchangeOptions = useMemo(() => {
    const seen = new Set<string>()
    return capabilities
      .filter((c: ExchangeCapability) => { if (seen.has(c.id)) return false; seen.add(c.id); return true })
      .map((c: ExchangeCapability) => ({ id: c.id, label: c.label }))
  }, [capabilities])

  // Exchanges that don't support history / errored
  const unsupportedExchanges = useMemo(
    () => capabilities.filter((c: ExchangeCapability) => c.syncStatus === "unsupported"),
    [capabilities],
  )
  const erroredExchanges = useMemo(
    () => capabilities.filter((c: ExchangeCapability) => c.syncStatus === "error" && !!c.error),
    [capabilities],
  )
  const hasIdleExchanges = useMemo(
    () => capabilities.some((c: ExchangeCapability) => !c.syncStatus || c.syncStatus === "idle"),
    [capabilities],
  )

  useEffect(() => {
    if (autoRefreshTriggeredRef.current) return
    if (isLoading || isError || refreshTransactions.isPending) return
    if (capabilities.length === 0) return
    if (!hasIdleExchanges) return

    autoRefreshTriggeredRef.current = true
    refreshExchangeHistory(undefined)
  }, [capabilities.length, hasIdleExchanges, isError, isLoading, refreshExchangeHistory, refreshTransactions.isPending])

  // Client-side filtering
  const filteredTransactions = useMemo(() => {
    let filtered = transactions
    if (exchangeFilter !== "all") {
      filtered = filtered.filter((t: ExchangeTransaction) => t.exchange === exchangeFilter)
    }
    if (typeFilter !== "all") {
      filtered = filtered.filter((t: ExchangeTransaction) => t.type === typeFilter)
    }
    if (assetFilter.trim()) {
      const q = assetFilter.toLowerCase()
      filtered = filtered.filter((t: ExchangeTransaction) => t.currency.toLowerCase().includes(q))
    }
    if (fromDate) {
      const fromMs = new Date(fromDate).getTime()
      filtered = filtered.filter((t: ExchangeTransaction) => t.timestamp >= fromMs)
    }
    if (toDate) {
      const toMs = new Date(toDate + "T23:59:59").getTime()
      filtered = filtered.filter((t: ExchangeTransaction) => t.timestamp <= toMs)
    }
    return filtered
  }, [transactions, exchangeFilter, typeFilter, assetFilter, fromDate, toDate])

  const hasActiveFilters =
    exchangeFilter !== "all" ||
    typeFilter !== "all" ||
    assetFilter.trim() !== "" ||
    fromDate !== "" ||
    toDate !== ""

  const handleClearFilters = () => {
    setExchangeFilter("all")
    setTypeFilter("all")
    setAssetFilter("")
    setFromDate("")
    setToDate("")
  }

  const columns = useExchangeColumns()
  const hasNoExchanges = !isLoading && !isError && transactions.length === 0 && capabilities.length === 0

  return (
    <div className="space-y-0">
      <PortfolioSubNav tabs={HISTORY_SUB_TABS} />

      <PortfolioPageHeader
        title="Exchange History"
        subtitle="Deposits, withdrawals, and trades from connected exchanges"
        actions={
          <button
            onClick={() => refreshExchangeHistory(exchangeFilter !== "all" ? { exchangeId: exchangeFilter } : undefined)}
            disabled={refreshTransactions.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors disabled:opacity-50 rounded-xl text-xs font-medium tracking-wide"
          >
            <span
              className="material-symbols-rounded text-sm"
              style={refreshTransactions.isPending ? { animation: "spinnerRotate 0.8s linear infinite" } : undefined}
            >
              sync
            </span>
            {refreshTransactions.isPending ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      {/* Cross-link to current balances */}
      <Link
        href="/portfolio/balances/exchange"
        className="flex items-center gap-3 bg-card border border-card-border hover:border-card-border-hover rounded-xl px-5 py-3 mb-3 group transition-all"
      >
        <span className="material-symbols-rounded text-primary text-lg">account_balance_wallet</span>
        <span className="text-sm text-foreground-muted group-hover:text-foreground transition-colors">
          View Current Exchange Balances
        </span>
        <span className="material-symbols-rounded text-foreground-muted group-hover:text-foreground ml-auto text-sm transition-all group-hover:translate-x-0.5">
          arrow_forward
        </span>
      </Link>

      <UnsupportedExchangeBanners exchanges={unsupportedExchanges} />
      <ErroredExchangeBanners exchanges={erroredExchanges} />
      <ExchangeSyncStatusBar capabilities={capabilities} />
      <ExchangeErrorBanner error={isError ? (error as Error) : null} />
      <ExchangeRefreshBanner
        isSuccess={refreshTransactions.isSuccess}
        isError={refreshTransactions.isError}
        error={refreshTransactions.error as Error | null}
        transactionCount={filteredTransactions.length}
      />

      {hasNoExchanges ? (
        <PortfolioEmpty
          icon="swap_horiz"
          title="No Exchanges Connected"
          description="Connect an exchange in Settings to view deposit, withdrawal, and trade history here."
          action={{
            label: "Go to Settings",
            onClick: () => router.push("/portfolio/settings"),
          }}
        />
      ) : (
        <>
          <ExchangeFilterBar
            exchangeFilter={exchangeFilter}
            typeFilter={typeFilter}
            assetFilter={assetFilter}
            fromDate={fromDate}
            toDate={toDate}
            hasActiveFilters={hasActiveFilters}
            exchangeOptions={exchangeOptions}
            onExchangeChange={setExchangeFilter}
            onTypeChange={setTypeFilter}
            onAssetChange={setAssetFilter}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            onClearFilters={handleClearFilters}
          />

          {/* Active filters indicator */}
          {hasActiveFilters && !isLoading && (
            <div className="bg-card border border-card-border px-4 py-2 mb-4 flex items-center gap-3 rounded-xl">
              <span className="material-symbols-rounded text-foreground-muted text-sm">filter_list</span>
              <p className="text-xs text-foreground-muted">
                Showing {filteredTransactions.length} of {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}

          {/* Data table or empty states */}
          {!isLoading && filteredTransactions.length === 0 && transactions.length > 0 ? (
            <div className="bg-card border border-card-border flex flex-col items-center justify-center py-16 gap-4 rounded-xl">
              <span className="material-symbols-rounded text-4xl text-foreground-muted">filter_list_off</span>
              <p className="text-foreground text-base font-semibold">No Matching Transactions</p>
              <p className="text-foreground-muted text-center max-w-md text-sm">
                No transactions match the current filters. Try adjusting or clearing the filters.
              </p>
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-2 px-5 py-2.5 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors rounded-xl text-xs font-semibold tracking-wide"
              >
                <span className="material-symbols-rounded text-sm">filter_list_off</span>
                Clear Filters
              </button>
            </div>
          ) : !isLoading && filteredTransactions.length === 0 && transactions.length === 0 && capabilities.length > 0 ? (
            <div className="bg-card border border-card-border flex flex-col items-center justify-center py-16 gap-4 rounded-xl">
              <span className="material-symbols-rounded text-4xl text-foreground-muted">history</span>
              <p className="text-foreground text-base font-semibold">No Transactions Found</p>
              <p className="text-foreground-muted text-center max-w-md text-sm">
                Your connected exchanges have no deposit, withdrawal, or trade history, or the exchange API does not expose this data.
              </p>
            </div>
          ) : (
            <PortfolioDataTable
              columns={columns}
              data={filteredTransactions}
              isLoading={isLoading}
              emptyMessage="No exchange transactions found"
              emptyIcon="swap_horiz"
            />
          )}
        </>
      )}
    </div>
  )
}
