"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useExchangeBalances, useRefreshExchangeBalances } from "@/hooks/use-portfolio-tracker"
import { formatCryptoAmount, formatFiatValue } from "@/lib/portfolio/utils"
import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { PortfolioSubNav } from "@/components/portfolio/portfolio-sub-nav"
import { PortfolioDataTable, Column } from "@/components/portfolio/portfolio-data-table"
import { PortfolioEmpty } from "@/components/portfolio/portfolio-empty"
import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { BALANCE_SUB_TABS } from "@/lib/portfolio/nav"
import { getExchangeLogoUrl, SUPPORTED_EXCHANGES } from "@/lib/portfolio/exchanges"

interface ExchangeBalanceRow {
  exchange: string
  exchangeLabel: string
  exchangeDomain: string
  asset: string
  displayName: string
  amount: number
  free: number
  used: number
  usd_value: number
}

interface ExchangeSummary {
  id: string
  label: string
  totalValue: number
  assetCount: number
  error?: string
}

export default function ExchangeBalancesPage() {
  const { data, isLoading, isError } = useExchangeBalances()
  const refreshExchange = useRefreshExchangeBalances()
  const router = useRouter()
  const [sortKey, setSortKey] = useState("usd_value")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [exchangeFilter, setExchangeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Parse from the new response format: { balances: [...], exchanges: [...], totalValue }
  const { rows, exchanges, totalValue } = useMemo(() => {
    if (!data || typeof data !== "object") {
      return { rows: [] as ExchangeBalanceRow[], exchanges: [] as ExchangeSummary[], totalValue: 0 }
    }

    const balances = (data as any).balances
    const exchangesList = (data as any).exchanges
    const total = (data as any).totalValue || 0

    const items: ExchangeBalanceRow[] = []

    if (Array.isArray(balances)) {
      for (const b of balances) {
        const def = SUPPORTED_EXCHANGES.find((e) => e.id === b.exchange)
        items.push({
          exchange: b.exchange,
          exchangeLabel: b.exchangeLabel || def?.label || b.exchange,
          exchangeDomain: def?.domain || `${b.exchange}.com`,
          asset: b.asset,
          displayName: b.asset,
          amount: b.amount || 0,
          free: b.free || 0,
          used: b.used || 0,
          usd_value: b.usd_value || 0,
        })
      }
    }

    return {
      rows: items,
      exchanges: Array.isArray(exchangesList) ? exchangesList : [],
      totalValue: total,
    }
  }, [data])

  // Unique exchange list for filter dropdown
  const exchangeOptions = useMemo(() => {
    const seen = new Set<string>()
    return exchanges
      .filter((e: ExchangeSummary) => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
      .map((e: ExchangeSummary) => ({ id: e.id, label: e.label }))
  }, [exchanges])

  // Filter and sort rows
  const filteredRows = useMemo(() => {
    let filtered = rows
    if (exchangeFilter !== "all") {
      filtered = filtered.filter((r) => r.exchange === exchangeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter((r) =>
        r.asset.toLowerCase().includes(q) ||
        r.exchangeLabel.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [rows, exchangeFilter, searchQuery])

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows]
    sorted.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      switch (sortKey) {
        case "exchange":
          aVal = a.exchangeLabel.toLowerCase()
          bVal = b.exchangeLabel.toLowerCase()
          break
        case "asset":
          aVal = a.displayName.toLowerCase()
          bVal = b.displayName.toLowerCase()
          break
        case "amount":
          aVal = a.amount
          bVal = b.amount
          break
        case "usd_value":
        default:
          aVal = a.usd_value
          bVal = b.usd_value
          break
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
    return sorted
  }, [filteredRows, sortKey, sortDir])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const columns: Column<ExchangeBalanceRow>[] = [
    {
      key: "exchange",
      header: "Exchange",
      sortable: true,
      accessor: (row) => (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getExchangeLogoUrl(row.exchangeDomain, 28)}
            alt={row.exchangeLabel}
            width={28}
            height={28}
            className="rounded-md"
          />
          <span className="text-foreground text-sm font-medium">
            {row.exchangeLabel}
          </span>
        </div>
      ),
    },
    {
      key: "asset",
      header: "Asset",
      sortable: true,
      accessor: (row) => (
        <div className="flex items-center gap-3">
          <PortfolioAssetIcon asset={row.displayName} assetId={row.asset} size={28} />
          <span className="text-foreground text-sm">
            {row.displayName}
          </span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      accessor: (row) => (
        <span className="text-foreground-muted font-data text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCryptoAmount(row.amount)}
        </span>
      ),
    },
    {
      key: "usd_value",
      header: "Value (USD)",
      sortable: true,
      align: "right",
      accessor: (row) => (
        <span className="text-foreground font-data text-sm font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatFiatValue(row.usd_value)}
        </span>
      ),
    },
  ]

  const hasNoExchanges = !isLoading && !isError && rows.length === 0 && exchanges.length === 0

  return (
    <div className="space-y-0">
      <PortfolioSubNav tabs={BALANCE_SUB_TABS} />

      <PortfolioPageHeader
        title="Exchange Balances"
        subtitle="View your holdings across connected exchanges"
      />

      {/* Cross-link to deposit/withdrawal history */}
      {rows.length > 0 && (
        <Link
          href="/portfolio/history/exchange"
          className="flex items-center gap-3 bg-card border border-card-border hover:border-card-border-hover rounded-xl px-5 py-3 mb-4 group transition-all"
        >
          <span className="material-symbols-rounded text-primary text-lg">swap_vert</span>
          <span className="text-sm text-foreground-muted group-hover:text-foreground transition-colors">
            View Deposit &amp; Withdrawal History
          </span>
          <span className="material-symbols-rounded text-foreground-muted group-hover:text-foreground ml-auto text-sm transition-all group-hover:translate-x-0.5">
            arrow_forward
          </span>
        </Link>
      )}

      {/* Total Value Summary */}
      {totalValue > 0 && (
        <div className="bg-card border border-card-border rounded-xl px-5 py-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-foreground-muted text-xs font-semibold tracking-wider">EXCHANGE TOTAL</p>
            <p className="text-foreground font-data text-2xl font-bold mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatFiatValue(totalValue)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-foreground-muted text-xs">
              {exchanges.length} exchange{exchanges.length !== 1 ? "s" : ""} &middot; {rows.length} asset{rows.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => refreshExchange.mutate()}
              disabled={refreshExchange.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-card-border rounded-lg text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-xs disabled:opacity-50"
            >
              <span
                className="material-symbols-rounded text-sm"
                style={refreshExchange.isPending ? { animation: "spinnerRotate 0.8s linear infinite" } : undefined}
              >
                sync
              </span>
              {refreshExchange.isPending ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      )}

      {/* Exchange errors */}
      {exchanges.filter((e: ExchangeSummary) => e.error).map((e: ExchangeSummary) => {
        const isRateLimit = e.error?.includes("Rate limited") || e.error?.includes("rate limited")
        return (
          <div key={e.id} className={`bg-card border px-4 py-3 mb-4 rounded-xl ${isRateLimit ? "border-warning/25" : "border-error/25"}`}>
            <div className="flex items-center gap-2">
              <span className={`material-symbols-rounded text-sm ${isRateLimit ? "text-warning" : "text-error"}`}>
                {isRateLimit ? "schedule" : "warning"}
              </span>
              <span className={`text-xs ${isRateLimit ? "text-warning" : "text-error"}`}>
                {e.label}: {e.error}
              </span>
            </div>
          </div>
        )
      })}

      {isError && (
        <div className="bg-card border border-card-border p-6 mb-6 rounded-xl">
          <div className="flex items-center gap-3 text-error">
            <span className="material-symbols-rounded">error</span>
            <span className="text-sm">
              Failed to load exchange balances. Please try again.
            </span>
          </div>
        </div>
      )}

      {hasNoExchanges ? (
        <PortfolioEmpty
          icon="swap_horiz"
          title="No Exchanges Connected"
          description="Connect an exchange in Settings to view your exchange balances here."
          action={{
            label: "Go to Settings",
            onClick: () => router.push("/portfolio/settings"),
          }}
        />
      ) : (
        <>
          {/* Filters */}
          {rows.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted text-sm">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search assets..."
                  className="w-full pl-9 pr-3 py-2 bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-foreground placeholder-foreground-muted/40 transition-colors text-sm"
                />
              </div>

              {/* Exchange filter */}
              {exchangeOptions.length > 1 && (
                <select
                  value={exchangeFilter}
                  onChange={(e) => setExchangeFilter(e.target.value)}
                  className="bg-transparent border border-card-border rounded-lg px-3 py-2 text-foreground text-sm outline-none cursor-pointer appearance-none"
                >
                  <option value="all" className="bg-card">All Exchanges</option>
                  {exchangeOptions.map((e: { id: string; label: string }) => (
                    <option key={e.id} value={e.id} className="bg-card">{e.label}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <PortfolioDataTable
            columns={columns}
            data={sortedRows}
            isLoading={isLoading}
            emptyMessage="No exchange balances found"
            emptyIcon="swap_horiz"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </>
      )}
    </div>
  )
}
