import { shortenAddress } from "@/lib/portfolio/utils"

export function BalanceSearchBar({
  search,
  onSearchChange,
  filterChain,
  onChainChange,
  filterWallet,
  onWalletChange,
  uniqueChains,
  uniqueWallets,
  walletLabels,
  hasActiveFilters,
  onClearFilters,
}: {
  search: string
  onSearchChange: (value: string) => void
  filterChain: string
  onChainChange: (value: string) => void
  filterWallet: string
  onWalletChange: (value: string) => void
  uniqueChains: string[]
  uniqueWallets: string[]
  walletLabels: Record<string, string>
  hasActiveFilters: boolean
  onClearFilters: () => void
}) {
  return (
    <div className="bg-card border border-card-border p-4 mb-4 rounded-xl">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <span className="material-symbols-rounded absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" style={{ fontSize: 16 }}>search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by asset, wallet, or chain..."
            className="w-full pl-9 pr-8 py-2 bg-transparent border border-card-border focus:border-card-border-hover outline-none text-foreground placeholder-foreground-muted transition-colors rounded-lg text-sm"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
            </button>
          )}
        </div>

        {/* Chain Filter */}
        <div className="relative">
          <select
            value={filterChain}
            onChange={(e) => onChainChange(e.target.value)}
            className="appearance-none bg-transparent border border-card-border focus:border-card-border-hover outline-none px-3 py-2 pr-8 text-foreground transition-colors cursor-pointer min-w-[140px] rounded-lg text-sm"
          >
            <option value="" className="bg-card">All Chains</option>
            {uniqueChains.map((c) => (
              <option key={c} value={c} className="bg-card">
                {c}
              </option>
            ))}
          </select>
          <span className="material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted text-sm pointer-events-none">
            expand_more
          </span>
        </div>

        {/* Wallet Filter */}
        <div className="relative">
          <select
            value={filterWallet}
            onChange={(e) => onWalletChange(e.target.value)}
            className="appearance-none bg-transparent border border-card-border focus:border-card-border-hover outline-none px-3 py-2 pr-8 text-foreground transition-colors cursor-pointer min-w-[160px] rounded-lg text-sm"
          >
            <option value="" className="bg-card">All Wallets</option>
            {uniqueWallets.map((w) => (
              <option key={w} value={w} className="bg-card">
                {walletLabels[w] || shortenAddress(w, 6)}
              </option>
            ))}
          </select>
          <span className="material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted text-sm pointer-events-none">
            expand_more
          </span>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1.5 px-3 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors flex-shrink-0 rounded-lg text-xs"
          >
            <span className="material-symbols-rounded text-sm">filter_list_off</span>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
