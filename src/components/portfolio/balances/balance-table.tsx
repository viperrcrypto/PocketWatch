import { formatCryptoAmount, formatFiatValue } from "@/lib/portfolio/utils"
import { ChainBadge } from "@/components/portfolio/chain-badge"
import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { BalanceGroupRows } from "./balance-group-rows"
import type { AssetGroup, BalanceRow } from "./balances-types"

function SortHeader({
  label,
  colKey,
  align,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string
  colKey: string
  align?: "left" | "right"
  sortKey: string
  sortDir: "asc" | "desc"
  onSort: (key: string) => void
}) {
  const isSorted = sortKey === colKey
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors ${align === "right" ? "text-right" : ""}`}
      onClick={() => onSort(colKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {isSorted ? (
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            {sortDir === "asc" ? <path d="M12 19V5m-5 5 5-5 5 5" /> : <path d="M12 5v14m-5-5 5 5 5-5" />}
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 10 5-5 5 5M7 14l5 5 5-5" />
          </svg>
        )}
      </span>
    </th>
  )
}

export function BalanceTable({
  groupedData,
  expandedGroups,
  onToggleGroup,
  iconForRow,
  sortKey,
  sortDir,
  onSort,
  hasActiveFilters,
}: {
  groupedData: AssetGroup[]
  expandedGroups: Set<string>
  onToggleGroup: (name: string) => void
  iconForRow: (row: BalanceRow) => string | undefined
  sortKey: string
  sortDir: "asc" | "desc"
  onSort: (key: string) => void
  hasActiveFilters: boolean
}) {
  if (groupedData.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl py-16 text-center">
        <span className="material-symbols-rounded text-5xl text-foreground-muted block mb-3">
          {hasActiveFilters ? "search_off" : "account_balance_wallet"}
        </span>
        <p className="text-sm text-foreground-muted">
          {hasActiveFilters ? "No assets match your search or filters." : "No blockchain balances found. Add an account to get started."}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border bg-card-elevated">
              <SortHeader label="Asset" colKey="asset" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <th className="px-4 py-3 text-xs font-medium text-foreground-muted">Wallet</th>
              <th className="px-4 py-3 text-xs font-medium text-foreground-muted">Chain</th>
              <SortHeader label="Amount" colKey="amount" align="right" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Value (USD)" colKey="usd_value" align="right" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="% of Total" colKey="pctOfTotal" align="right" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {groupedData.map((group) => {
              const isMulti = group.rows.length > 1
              const isExpanded = expandedGroups.has(group.displayName)

              return isMulti ? (
                <BalanceGroupRows
                  key={group.displayName}
                  group={group}
                  isExpanded={isExpanded}
                  onToggle={() => onToggleGroup(group.displayName)}
                  iconUrl={iconForRow(group.rows[0])}
                />
              ) : (
                <tr
                  key={`${group.rows[0].asset}-${group.rows[0].wallet}-${group.rows[0].chain}`}
                  className="border-b border-card-border last:border-b-0 hover:bg-primary-subtle transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-5 shrink-0" />
                      <PortfolioAssetIcon asset={group.displayName} assetId={group.asset} chain={group.chain} iconUrl={iconForRow(group.rows[0])} size={28} />
                      <span className="text-foreground font-data text-sm font-medium">{group.displayName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-foreground-muted font-data text-xs" title={group.rows[0].wallet}>{group.rows[0].walletLabel}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ChainBadge chainId={group.rows[0].chain} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-foreground-muted font-data text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCryptoAmount(group.totalAmount)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-foreground font-data text-sm font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{formatFiatValue(group.totalValue)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-foreground-muted font-data text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>{group.pctOfTotal.toFixed(1)}%</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
