"use client"

import type { TrackerChain, TrackerWalletData } from "@/lib/tracker/types"

export interface FeedFilterValues {
  chain?: TrackerChain
  type?: string
  walletId?: string
}

interface FeedFiltersProps {
  filters: FeedFilterValues
  onFilterChange: (filters: FeedFilterValues) => void
  wallets: TrackerWalletData[]
}

const CHAIN_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Chains" },
  { value: "ETHEREUM", label: "ETH" },
  { value: "SOLANA", label: "SOL" },
  { value: "ARBITRUM", label: "ARB" },
  { value: "BASE", label: "BASE" },
  { value: "POLYGON", label: "POL" },
  { value: "BSC", label: "BSC" },
]

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
  { value: "TRANSFER_IN", label: "Transfer In" },
  { value: "TRANSFER_OUT", label: "Transfer Out" },
  { value: "SWAP", label: "Swap" },
]

export default function FeedFilters({
  filters,
  onFilterChange,
  wallets,
}: FeedFiltersProps) {
  const handleChange = (key: keyof FeedFilterValues, value: string) => {
    onFilterChange({
      ...filters,
      [key]: value || undefined,
    })
  }

  const selectClass =
    "h-9 px-3 text-[12px] uppercase tracking-wider font-mono " +
    "bg-background border border-card-border text-foreground-muted " +
    "hover:border-card-border-hover focus:border-foreground focus:text-foreground " +
    "transition-colors cursor-pointer appearance-none"

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="section-label mr-1">Filters</span>

      {/* Chain filter */}
      <select
        value={filters.chain || ""}
        onChange={(e) => handleChange("chain", e.target.value)}
        className={selectClass}
        style={{ borderRadius: 0 }}
      >
        {CHAIN_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Type filter */}
      <select
        value={filters.type || ""}
        onChange={(e) => handleChange("type", e.target.value)}
        className={selectClass}
        style={{ borderRadius: 0 }}
      >
        {TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Wallet filter */}
      <select
        value={filters.walletId || ""}
        onChange={(e) => handleChange("walletId", e.target.value)}
        className={selectClass}
        style={{ borderRadius: 0 }}
      >
        <option value="">All Wallets</option>
        {wallets.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label || `${w.address.slice(0, 6)}...${w.address.slice(-4)}`}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {(filters.chain || filters.type || filters.walletId) && (
        <button
          onClick={() => onFilterChange({})}
          className="btn-ghost h-9 text-[11px] gap-1"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            close
          </span>
          Clear
        </button>
      )}
    </div>
  )
}
