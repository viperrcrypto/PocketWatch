import { TYPE_FILTER_OPTIONS } from "./exchange-constants"

export function ExchangeFilterBar({
  exchangeFilter,
  typeFilter,
  assetFilter,
  fromDate,
  toDate,
  hasActiveFilters,
  exchangeOptions,
  onExchangeChange,
  onTypeChange,
  onAssetChange,
  onFromDateChange,
  onToDateChange,
  onClearFilters,
}: {
  exchangeFilter: string
  typeFilter: string
  assetFilter: string
  fromDate: string
  toDate: string
  hasActiveFilters: boolean
  exchangeOptions: Array<{ id: string; label: string }>
  onExchangeChange: (value: string) => void
  onTypeChange: (value: string) => void
  onAssetChange: (value: string) => void
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  onClearFilters: () => void
}) {
  return (
    <div className="bg-card border border-card-border p-4 mb-6 rounded-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
        {/* Exchange dropdown */}
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">
            Exchange
          </label>
          <select
            value={exchangeFilter}
            onChange={(e) => onExchangeChange(e.target.value)}
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground transition-colors appearance-none cursor-pointer rounded-lg text-sm"
          >
            <option value="all" className="bg-card text-foreground">All Exchanges</option>
            {exchangeOptions.map((e) => (
              <option key={e.id} value={e.id} className="bg-card text-foreground">{e.label}</option>
            ))}
          </select>
        </div>

        {/* Type filter */}
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">
            Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground transition-colors appearance-none cursor-pointer rounded-lg text-sm"
          >
            {TYPE_FILTER_OPTIONS.map((t) => (
              <option key={t.value} value={t.value} className="bg-card text-foreground">{t.label}</option>
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
            onChange={(e) => onFromDateChange(e.target.value)}
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
            onChange={(e) => onToDateChange(e.target.value)}
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground transition-colors rounded-lg text-sm"
          />
        </div>

        {/* Asset search */}
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">
            Asset
          </label>
          <input
            type="text"
            value={assetFilter}
            onChange={(e) => onAssetChange(e.target.value)}
            placeholder="e.g. BTC, ETH"
            className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 text-foreground placeholder-foreground-muted transition-colors rounded-lg text-sm"
          />
        </div>

        {/* Clear filters */}
        <div className="flex items-end">
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
