"use client"

import { EVENT_TYPES, SOURCE_TYPES, type SourceType, type AppliedFilters } from "./history-constants"

export function HistoryFilterBar({
  search,
  setSearch,
  eventType,
  setEventType,
  sourceType,
  setSourceType,
  exchangeIdFilter,
  setExchangeIdFilter,
  walletFilter,
  setWalletFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  asset,
  setAsset,
  isFetching,
  hasActiveFilters,
  connectedExchangeOptions,
  walletOptions,
  onApplyFilters,
  onClearFilters,
  setAppliedFilters,
  setOffset,
}: {
  search: string
  setSearch: (v: string) => void
  eventType: string
  setEventType: (v: string) => void
  sourceType: SourceType
  setSourceType: (v: SourceType) => void
  exchangeIdFilter: string
  setExchangeIdFilter: (v: string) => void
  walletFilter: string
  setWalletFilter: (v: string) => void
  fromDate: string
  setFromDate: (v: string) => void
  toDate: string
  setToDate: (v: string) => void
  asset: string
  setAsset: (v: string) => void
  isFetching: boolean
  hasActiveFilters: boolean
  connectedExchangeOptions: Array<{ id: string; label: string }>
  walletOptions: Array<{ address: string; label: string }>
  onApplyFilters: () => void
  onClearFilters: () => void
  setAppliedFilters: (fn: (f: AppliedFilters) => AppliedFilters) => void
  setOffset: (v: number) => void
}) {
  return (
    <div className="bg-card border border-card-border p-4 mb-6 rounded-xl space-y-4">
      {/* Search row */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApplyFilters()
            if (e.key === "Escape") { setSearch(""); setAppliedFilters((f) => { const { search: _, ...rest } = f; return rest }) }
          }}
          placeholder="Search by tx hash, wallet address, or counterparty..."
          className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-4 pr-9 text-foreground placeholder-foreground-muted transition-colors rounded-lg text-sm font-data"
        />
        {search && (
          <button
            onClick={() => { setSearch(""); setAppliedFilters((f) => { const { search: _, ...rest } = f; return rest }); setOffset(0) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
            title="Clear search"
          >
            <span className="material-symbols-rounded text-[16px]">close</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-4 items-end">
        {/* Event type */}
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">
            Event Type
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground transition-colors appearance-none cursor-pointer rounded-lg text-sm"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-card text-foreground">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Source type */}
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">
            Source
          </label>
          <select
            value={sourceType}
            onChange={(e) => {
              const next = e.target.value as SourceType
              setSourceType(next)
              if (next === "onchain") setExchangeIdFilter("all")
            }}
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground transition-colors appearance-none cursor-pointer rounded-lg text-sm"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-card text-foreground">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Exchange filter */}
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">
            Exchange
          </label>
          <select
            value={exchangeIdFilter}
            onChange={(e) => setExchangeIdFilter(e.target.value)}
            disabled={sourceType === "onchain"}
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground transition-colors appearance-none cursor-pointer rounded-lg text-sm disabled:opacity-50"
          >
            <option value="all" className="bg-card text-foreground">All Exchanges</option>
            {connectedExchangeOptions.map((exchange) => (
              <option key={exchange.id} value={exchange.id} className="bg-card text-foreground">
                {exchange.label}
              </option>
            ))}
          </select>
        </div>

        {/* Wallet filter */}
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">
            Wallet
          </label>
          <select
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
            disabled={sourceType === "exchange"}
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground transition-colors appearance-none cursor-pointer rounded-lg text-sm disabled:opacity-50"
          >
            <option value="all" className="bg-card text-foreground">All Wallets</option>
            {walletOptions.map((w) => (
              <option key={w.address} value={w.address} className="bg-card text-foreground">
                {w.label}
              </option>
            ))}
          </select>
        </div>

        {/* From date */}
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground transition-colors rounded-lg text-sm"
          />
        </div>

        {/* To date */}
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground transition-colors rounded-lg text-sm"
          />
        </div>

        {/* Asset filter */}
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">
            Asset
          </label>
          <input
            type="text"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            placeholder="e.g. ETH, USDC"
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground placeholder-foreground-muted transition-colors rounded-lg text-sm"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onApplyFilters}
            disabled={isFetching}
            className="btn-primary flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl disabled:opacity-50 text-xs font-semibold tracking-wide"
          >
            {isFetching && (
              <span className="material-symbols-rounded text-sm animate-spin">progress_activity</span>
            )}
            {isFetching ? "Loading..." : "Apply"}
          </button>
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors rounded-xl text-xs tracking-wide"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
