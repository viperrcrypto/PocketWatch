"use client"

import { useState, useMemo } from "react"
import { useBlockchainBalances, useAssetMappings, useTrackedAccounts } from "@/hooks/use-portfolio-tracker"
import { shortenAddress } from "@/lib/portfolio/utils"
import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { PortfolioSubNav } from "@/components/portfolio/portfolio-sub-nav"
import { BALANCE_SUB_TABS } from "@/lib/portfolio/nav"
import { fallbackDisplayName } from "@/components/portfolio/balances/balances-helpers"
import { BalanceSearchBar } from "@/components/portfolio/balances/balance-search-bar"
import { BalanceSummaryBar } from "@/components/portfolio/balances/balance-summary-bar"
import { BalanceTableSkeleton } from "@/components/portfolio/balances/balance-table-skeleton"
import { BalanceTable } from "@/components/portfolio/balances/balance-table"
import type { BalanceRow, AssetGroup } from "@/components/portfolio/balances/balances-types"

export default function BlockchainBalancesPage() {
  const { data, isLoading, isError } = useBlockchainBalances()
  const { data: accountsData } = useTrackedAccounts()
  const [sortKey, setSortKey] = useState("usd_value")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [hideSmallBalances, setHideSmallBalances] = useState(true)
  const [search, setSearch] = useState("")
  const [filterWallet, setFilterWallet] = useState("")
  const [filterChain, setFilterChain] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Build wallet label map from tracked accounts: address -> label
  const walletLabels = useMemo(() => {
    const map: Record<string, string> = {}
    if (!accountsData || typeof accountsData !== "object") return map
    for (const [, chainAccounts] of Object.entries(accountsData as Record<string, unknown>)) {
      if (!Array.isArray(chainAccounts)) continue
      for (const account of chainAccounts) {
        const addr = (account?.address as string)?.toLowerCase()
        const label = account?.label as string
        if (addr && label && !map[addr]) {
          map[addr] = label
        }
      }
    }
    return map
  }, [accountsData])

  // Parse per-wallet balances
  const { rows, totalValue, uniqueWallets, uniqueChains } = useMemo(() => {
    if (!data) return { rows: [] as BalanceRow[], totalValue: 0, uniqueWallets: [] as string[], uniqueChains: [] as string[] }

    const allRows: Omit<BalanceRow, "displayName" | "pctOfTotal">[] = []
    const walletSet = new Set<string>()
    const chainSet = new Set<string>()
    const perAccount = (data as Record<string, unknown>).per_account || data

    if (perAccount && typeof perAccount === "object") {
      for (const [chain, chainData] of Object.entries(perAccount as Record<string, unknown>)) {
        if (chain === "totals" || !chainData || typeof chainData !== "object") continue
        chainSet.add(chain)
        for (const [walletAddress, accountData] of Object.entries(chainData as Record<string, unknown>)) {
          const acct = accountData as Record<string, unknown>
          const walletLower = walletAddress.toLowerCase()
          walletSet.add(walletLower)
          if (acct?.assets && typeof acct.assets === "object") {
            for (const [assetId, balanceWrapper] of Object.entries(acct.assets as Record<string, unknown>)) {
              const bw = balanceWrapper as Record<string, unknown>
              const balance = (bw?.address || bw) as Record<string, string>
              const amount = parseFloat(balance?.amount || "0")
              const usd_value = parseFloat(balance?.value || balance?.usd_value || "0")
              if (amount > 0 || usd_value > 0) {
                allRows.push({ asset: assetId, chain, wallet: walletLower, walletLabel: walletLabels[walletLower] || shortenAddress(walletLower, 6), amount, usd_value })
              }
            }
          }
        }
      }
    }

    const total = allRows.reduce((sum, a) => sum + a.usd_value, 0)
    const builtRows: BalanceRow[] = allRows.map((a) => ({
      ...a, displayName: a.asset, pctOfTotal: total > 0 ? (a.usd_value / total) * 100 : 0,
    }))
    const walletTotals = new Map<string, number>()
    for (const r of allRows) walletTotals.set(r.wallet, (walletTotals.get(r.wallet) || 0) + r.usd_value)
    return {
      rows: builtRows,
      totalValue: total,
      uniqueWallets: Array.from(walletSet).sort((a, b) => (walletTotals.get(b) || 0) - (walletTotals.get(a) || 0)),
      uniqueChains: Array.from(chainSet).sort(),
    }
  }, [data, walletLabels])

  // Extract icon URLs from API response
  const iconMap = useMemo(() => {
    const map: Record<string, string> = {}
    const icons = (data as any)?.icons // eslint-disable-line @typescript-eslint/no-explicit-any -- untyped API response
    if (icons && typeof icons === "object") {
      for (const [k, v] of Object.entries(icons)) {
        if (typeof v === "string") { map[k] = v; if (!map[k.toLowerCase()]) map[k.toLowerCase()] = v }
      }
    }
    return map
  }, [data])

  // Resolve CAIP identifiers
  const assetIds = useMemo(() => Array.from(new Set(rows.map((r) => r.asset))), [rows])
  const hasCaipIds = assetIds.some((id) => id.includes("/"))
  const { data: assetMappings, isLoading: mappingsLoading } = useAssetMappings(assetIds)
  const isResolvingNames = hasCaipIds && mappingsLoading

  // Apply resolved names
  const resolvedRows = useMemo(() => {
    const lowerMap: Record<string, { name: string; symbol: string }> = {}
    if (assetMappings) { for (const [key, val] of Object.entries(assetMappings)) lowerMap[key.toLowerCase()] = val }
    return rows.map((r) => {
      const mapping = assetMappings?.[r.asset] || lowerMap[r.asset.toLowerCase()]
      if (mapping?.symbol) return { ...r, displayName: mapping.symbol }
      if (r.asset.includes("/")) return { ...r, displayName: fallbackDisplayName(r.asset) }
      return r
    })
  }, [rows, assetMappings])

  // Apply search and filters
  const filteredRows = useMemo(() => {
    let result = resolvedRows
    if (filterWallet) result = result.filter((r) => r.wallet === filterWallet)
    if (filterChain) result = result.filter((r) => r.chain.toLowerCase() === filterChain.toLowerCase())
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((r) =>
        r.displayName.toLowerCase().includes(q) || r.asset.toLowerCase().includes(q) ||
        r.wallet.toLowerCase().includes(q) || r.walletLabel.toLowerCase().includes(q) || r.chain.toLowerCase().includes(q)
      )
    }
    return result
  }, [resolvedRows, filterWallet, filterChain, search])

  // Sort
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows]
    sorted.sort((a, b) => {
      let aVal: number | string, bVal: number | string
      switch (sortKey) {
        case "asset": aVal = a.displayName.toLowerCase(); bVal = b.displayName.toLowerCase(); break
        case "chain": aVal = a.chain.toLowerCase(); bVal = b.chain.toLowerCase(); break
        case "wallet": aVal = a.walletLabel.toLowerCase(); bVal = b.walletLabel.toLowerCase(); break
        case "amount": aVal = a.amount; bVal = b.amount; break
        case "pctOfTotal": aVal = a.pctOfTotal; bVal = b.pctOfTotal; break
        default: aVal = a.usd_value; bVal = b.usd_value; break
      }
      if (typeof aVal === "string" && typeof bVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return sorted
  }, [filteredRows, sortKey, sortDir])

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
  }

  const displayRows = useMemo(() => hideSmallBalances ? sortedRows.filter((r) => r.usd_value >= 5) : sortedRows, [sortedRows, hideSmallBalances])
  const filteredTotal = useMemo(() => displayRows.reduce((s, r) => s + r.usd_value, 0), [displayRows])
  const hiddenCount = sortedRows.filter((r) => r.usd_value < 5).length
  const hasActiveFilters = !!search || !!filterWallet || !!filterChain

  // Group rows by displayName
  const groupedData = useMemo((): AssetGroup[] => {
    const groupMap = new Map<string, BalanceRow[]>()
    for (const row of displayRows) { const g = groupMap.get(row.displayName) ?? []; g.push(row); groupMap.set(row.displayName, g) }
    const groups: AssetGroup[] = Array.from(groupMap.entries()).map(([name, groupRows]) => {
      const tv = groupRows.reduce((s, r) => s + r.usd_value, 0)
      const ta = groupRows.reduce((s, r) => s + r.amount, 0)
      const rep = groupRows.reduce((best, r) => r.usd_value > best.usd_value ? r : best, groupRows[0])
      return { displayName: name, asset: rep.asset, chain: rep.chain, totalAmount: ta, totalValue: tv, pctOfTotal: tv > 0 && filteredTotal > 0 ? (tv / filteredTotal) * 100 : 0, rows: [...groupRows].sort((a, b) => b.usd_value - a.usd_value) }
    })
    groups.sort((a, b) => {
      let aVal: number | string, bVal: number | string
      switch (sortKey) {
        case "asset": aVal = a.displayName.toLowerCase(); bVal = b.displayName.toLowerCase(); break
        case "amount": aVal = a.totalAmount; bVal = b.totalAmount; break
        case "pctOfTotal": aVal = a.pctOfTotal; bVal = b.pctOfTotal; break
        default: aVal = a.totalValue; bVal = b.totalValue; break
      }
      if (typeof aVal === "string" && typeof bVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return groups
  }, [displayRows, filteredTotal, sortKey, sortDir])

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next })
  }

  const iconForRow = (row: BalanceRow) =>
    iconMap[row.displayName] || iconMap[row.displayName.toLowerCase()] || iconMap[row.asset] || iconMap[row.asset.toLowerCase()]

  return (
    <div className="space-y-0">
      <PortfolioSubNav tabs={BALANCE_SUB_TABS} />
      <PortfolioPageHeader title="Balances" subtitle="View your token holdings across all wallets and chains" />

      {isError && (
        <div className="bg-card border border-card-border p-6 mb-6 rounded-xl">
          <div className="flex items-center gap-3 text-error">
            <span className="material-symbols-rounded">error</span>
            <span className="text-sm">Failed to load blockchain balances. Please try again.</span>
          </div>
        </div>
      )}

      {!isLoading && !isResolvingNames && rows.length > 0 && (
        <BalanceSearchBar
          search={search} onSearchChange={setSearch}
          filterChain={filterChain} onChainChange={setFilterChain}
          filterWallet={filterWallet} onWalletChange={setFilterWallet}
          uniqueChains={uniqueChains} uniqueWallets={uniqueWallets} walletLabels={walletLabels}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => { setSearch(""); setFilterWallet(""); setFilterChain("") }}
        />
      )}

      {!isLoading && !isResolvingNames && rows.length > 0 && (
        <BalanceSummaryBar
          hasActiveFilters={hasActiveFilters} filteredTotal={filteredTotal}
          totalValue={totalValue} displayCount={displayRows.length} totalCount={rows.length}
        />
      )}

      {!isLoading && !isResolvingNames && sortedRows.length > 0 && (
        <div className="flex items-center justify-end mb-2 px-1">
          <button onClick={() => setHideSmallBalances(!hideSmallBalances)} className="flex items-center gap-1.5 text-foreground-muted hover:text-foreground-secondary transition-colors text-[10px] tracking-wide">
            <span className="material-symbols-rounded text-sm">{hideSmallBalances ? "visibility_off" : "visibility"}</span>
            {"< $5"}
          </button>
        </div>
      )}

      {(isLoading || isResolvingNames) ? (
        <BalanceTableSkeleton />
      ) : (
        <BalanceTable
          groupedData={groupedData} expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup} iconForRow={iconForRow}
          sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {hideSmallBalances && hiddenCount > 0 && (
        <div className="mt-2 px-1">
          <button onClick={() => setHideSmallBalances(false)} className="text-foreground-muted hover:text-foreground-secondary transition-colors text-[10px] tracking-wide">
            {hiddenCount} asset{hiddenCount !== 1 ? "s" : ""} hidden (&lt; $5)
          </button>
        </div>
      )}
    </div>
  )
}
