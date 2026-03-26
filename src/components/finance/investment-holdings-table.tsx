"use client"

import { useState, useMemo } from "react"
import { formatCurrency, cn } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────────

interface Holding {
  accountId: string
  securityId: string | null
  quantity: number | null
  costBasis: number | null
  institutionPrice: number | null
  institutionValue: number | null
  accountName: string | null
  accountMask: string | null
  security: {
    name: string | null
    tickerSymbol: string | null
    type: string | null
    isCashEquivalent: boolean
  } | null
}

interface Props {
  holdings: Holding[]
  totalValue: number
}

type SortField = "name" | "type" | "value" | "gainLoss" | "pctOfPortfolio"
type SortDir = "asc" | "desc"

const TYPE_FILTERS = [
  { value: "", label: "All" },
  { value: "equity", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "mutual fund", label: "Fund" },
  { value: "fixed income", label: "Bond" },
  { value: "cash", label: "Cash" },
  { value: "cryptocurrency", label: "Crypto" },
]

// ─── Component ──────────────────────────────────────────────────

export function InvestmentHoldingsTable({ holdings, totalValue }: Props) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [sortField, setSortField] = useState<SortField>("value")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return holdings.filter((h) => {
      if (typeFilter) {
        const t = (h.security?.type ?? "").toLowerCase()
        if (t !== typeFilter) return false
      }
      if (q) {
        const name = (h.security?.name ?? "").toLowerCase()
        const ticker = (h.security?.tickerSymbol ?? "").toLowerCase()
        if (!name.includes(q) && !ticker.includes(q)) return false
      }
      return true
    })
  }, [holdings, search, typeFilter])

  const sorted = useMemo(() => {
    const mult = sortDir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortField) {
        case "name":
          return mult * (a.security?.name ?? "").localeCompare(b.security?.name ?? "")
        case "type":
          return mult * (a.security?.type ?? "").localeCompare(b.security?.type ?? "")
        case "value":
          return mult * ((a.institutionValue ?? 0) - (b.institutionValue ?? 0))
        case "gainLoss": {
          const aGL = (a.institutionValue ?? 0) - (a.costBasis ?? 0)
          const bGL = (b.institutionValue ?? 0) - (b.costBasis ?? 0)
          return mult * (aGL - bGL)
        }
        case "pctOfPortfolio":
          // % of portfolio has the same order as value, intentionally equivalent
          return mult * ((a.institutionValue ?? 0) - (b.institutionValue ?? 0))
        default:
          return 0
      }
    })
  }, [filtered, sortField, sortDir])

  const sortHeader = (field: SortField, label: string, align: "left" | "right" = "right", extra?: string) => (
    <th
      key={field}
      className={cn(
        "py-2.5 text-[10px] font-medium uppercase tracking-widest text-foreground-muted cursor-pointer select-none hover:text-foreground transition-colors",
        align === "left" ? "text-left px-5" : "text-right px-3",
        extra,
      )}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortField === field && (
          <span className="material-symbols-rounded" style={{ fontSize: 12 }}>
            {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
          </span>
        )}
      </span>
    </th>
  )

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      {/* Header with search + filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3 border-b border-card-border/50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>show_chart</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Investment Holdings
          </span>
          <span className="text-[10px] text-foreground-muted/60">({sorted.length})</span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" style={{ fontSize: 14 }}>search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ticker..."
              className="w-full sm:w-56 pl-9 pr-3 py-1.5 text-xs border border-card-border rounded-lg bg-background text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded-md whitespace-nowrap transition-all duration-200",
                  typeFilter === f.value
                    ? "bg-foreground text-background"
                    : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Total value bar */}
      <div className="flex items-center justify-between px-5 py-2 bg-background-secondary/30 border-b border-card-border/30">
        <span className="text-[10px] text-foreground-muted">Total Holdings Value</span>
        <span className="font-data text-sm font-bold text-foreground tabular-nums">{formatCurrency(totalValue)}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px] sm:min-w-[700px]">
          <thead>
            <tr className="border-b border-card-border/30">
              {sortHeader("name", "Name", "left")}
              {sortHeader("type", "Type", "right", "hidden sm:table-cell")}
              <th className="hidden sm:table-cell text-right px-3 py-2.5 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Qty</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Price</th>
              {sortHeader("value", "Value")}
              {sortHeader("pctOfPortfolio", "% Portfolio", "right", "hidden sm:table-cell")}
              {sortHeader("gainLoss", "Gain/Loss")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((h, i) => {
              const gainLoss = h.institutionValue != null && h.costBasis != null
                ? h.institutionValue - h.costBasis : null
              const gainPct = gainLoss != null && h.costBasis != null && h.costBasis !== 0
                ? (gainLoss / Math.abs(h.costBasis)) * 100 : null
              const portfolioPct = totalValue > 0 && h.institutionValue != null
                ? (h.institutionValue / totalValue) * 100 : 0

              return (
                <tr
                  key={`${h.accountId}-${h.securityId}-${i}`}
                  className={cn(
                    "group transition-colors duration-150",
                    i % 2 === 1 ? "bg-background-secondary/20" : "",
                    "hover:bg-primary/[0.03]"
                  )}
                >
                  {/* Name + Account + Ticker */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {h.security?.name ?? "Unknown"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {h.accountName && (
                            <span className="text-[10px] text-foreground-muted truncate">
                              {h.accountName}
                            </span>
                          )}
                          {h.security?.type === "cash" && h.security.isCashEquivalent && h.accountName?.toLowerCase().includes("robinhood") && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-semibold uppercase bg-success/10 text-success rounded">
                              Earning yield
                            </span>
                          )}
                          {h.security?.tickerSymbol && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-primary/8 text-primary rounded">
                              {h.security.tickerSymbol}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="hidden sm:table-cell text-right px-3 py-3">
                    <span className="px-1.5 py-0.5 text-[9px] uppercase bg-background-secondary rounded text-foreground-muted">
                      {h.security?.type ?? "--"}
                    </span>
                  </td>

                  {/* Quantity */}
                  <td className="hidden sm:table-cell text-right px-3 py-3 font-data tabular-nums text-foreground">
                    {h.quantity != null
                      ? h.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })
                      : "--"}
                  </td>

                  {/* Price */}
                  <td className="text-right px-3 py-3 font-data tabular-nums text-foreground">
                    {h.institutionPrice != null ? formatCurrency(h.institutionPrice) : "--"}
                  </td>

                  {/* Value */}
                  <td className="text-right px-3 py-3 font-data tabular-nums font-semibold text-foreground">
                    {h.institutionValue != null ? formatCurrency(h.institutionValue) : "--"}
                  </td>

                  {/* % of Portfolio */}
                  <td className="hidden sm:table-cell text-right px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-background-secondary rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full bg-primary/40 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(portfolioPct, 100)}%` }}
                        />
                      </div>
                      <span className="font-data tabular-nums text-xs text-foreground-muted">
                        {portfolioPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>

                  {/* Gain/Loss */}
                  <td className="text-right px-5 py-3">
                    {gainLoss != null ? (
                      <div>
                        <p className={cn(
                          "font-data tabular-nums text-sm font-medium",
                          gainLoss >= 0 ? "text-success" : "text-error"
                        )}>
                          {gainLoss >= 0 ? "+" : ""}{formatCurrency(gainLoss)}
                        </p>
                        {gainPct != null && (
                          <p className={cn(
                            "text-[10px] font-data tabular-nums",
                            gainLoss >= 0 ? "text-success" : "text-error"
                          )}>
                            {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-foreground-muted">--</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <div className="py-12 text-center">
          <span className="material-symbols-rounded text-foreground-muted/50 block mb-2" style={{ fontSize: 28 }}>search_off</span>
          <p className="text-sm text-foreground-muted">
            {search || typeFilter ? "No holdings match your filters" : "No investment holdings found"}
          </p>
        </div>
      )}
    </div>
  )
}
