"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import Link from "next/link"
import type { AggregatedAsset } from "@/lib/portfolio/aggregated-assets"
import { formatFiatValue } from "@/lib/portfolio/utils"
import { parseCaip19 } from "@/lib/portfolio/token-image"
import { shortenAddress } from "@/lib/portfolio/utils"
import { AssetRow } from "./asset-table/asset-row"
import { AssetTableEmptyState } from "./asset-table/asset-empty-state"

// ─── Types ───

interface WalletInfo {
  address: string
  label?: string
}

interface ExpandableAssetTableProps {
  assets: readonly AggregatedAsset[]
  totalValue: number
  iconMap: Record<string, string>
  pricesMap: Record<string, number>
  assetMappings?: Record<string, { name: string; symbol: string }> | null
  wallets?: readonly WalletInfo[]
  isLoading?: boolean
  isResolvingNames?: boolean
  overview?: any
  blockchainData?: any
  trackedAccounts?: any
  balancesError?: boolean
  overviewError?: any
  onRefresh?: () => void
  isRefreshing?: boolean
  refreshCooldown?: boolean
  isHidden?: boolean
}

// ─── Styles ───

const TH_STYLE = {
  fontSize: 10,
  fontWeight: 500 as const,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
}

// ─── Component ───

export function ExpandableAssetTable({
  assets,
  totalValue,
  iconMap,
  pricesMap,
  assetMappings,
  wallets,
  isLoading,
  isResolvingNames,
  overview,
  blockchainData,
  trackedAccounts,
  balancesError,
  overviewError,
  onRefresh,
  isRefreshing,
  refreshCooldown,
  isHidden,
}: ExpandableAssetTableProps) {
  const [hideSmallBalances, setHideSmallBalances] = useState(true)
  const [expandedSymbols, setExpandedSymbols] = useState<ReadonlySet<string>>(new Set())

  // Clean up stale expanded state when assets change
  useEffect(() => {
    setExpandedSymbols((prev) => {
      if (prev.size === 0) return prev
      const validSymbols = new Set(assets.map((a) => a.symbol))
      let changed = false
      for (const s of prev) {
        if (!validSymbols.has(s)) { changed = true; break }
      }
      if (!changed) return prev
      const next = new Set<string>()
      for (const s of prev) {
        if (validSymbols.has(s)) next.add(s)
      }
      return next
    })
  }, [assets])

  const walletLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!wallets) return map
    for (const w of wallets) {
      if (w.label) map.set(w.address.toLowerCase(), w.label)
    }
    return map
  }, [wallets])

  const visibleAssets = useMemo(
    () => (hideSmallBalances ? assets.filter((a) => a.totalValue >= 5) : assets),
    [assets, hideSmallBalances],
  )

  const hiddenCount = useMemo(
    () => (hideSmallBalances ? assets.filter((a) => a.totalValue < 5).length : 0),
    [assets, hideSmallBalances],
  )

  const toggleExpand = useCallback((symbol: string) => {
    setExpandedSymbols((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) {
        next.delete(symbol)
      } else {
        next.add(symbol)
      }
      return next
    })
  }, [])

  const resolveDisplayName = useCallback((asset: AggregatedAsset) => {
    if (!assetMappings) return asset.symbol
    const mapping = assetMappings[asset.assetId] ?? assetMappings[asset.assetId.toLowerCase()]
    return mapping?.symbol ?? asset.symbol
  }, [assetMappings])

  const lookupWalletLabel = useCallback((address: string): string => {
    return walletLabelMap.get(address.toLowerCase()) ?? shortenAddress(address)
  }, [walletLabelMap])

  return (
    <div className="bg-card border border-card-border overflow-hidden rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-background/60 border-b border-card-border">
        <div className="flex items-center gap-4">
          <span className="text-foreground-muted text-[10px] font-semibold tracking-widest">
            All Assets
          </span>
          <button
            onClick={() => setHideSmallBalances((prev) => !prev)}
            className="flex items-center gap-1.5 text-foreground-muted hover:text-foreground-secondary transition-colors text-[10px] tracking-wide"
          >
            <span className="material-symbols-rounded text-sm">
              {hideSmallBalances ? "visibility_off" : "visibility"}
            </span>
            {"< $5"}
          </button>
        </div>
        <Link
          href="/portfolio/balances"
          className="text-foreground-muted hover:text-foreground transition-colors flex items-center gap-1 text-[10px] tracking-wide"
        >
          View All
          <span className="material-symbols-rounded text-xs">arrow_forward</span>
        </Link>
      </div>

      {/* Loading skeleton */}
      {(isLoading || isResolvingNames) && assets.length === 0 ? (
        <div className="p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-9 h-9 animate-shimmer is-circle" />
              <div className="flex-1 h-4 animate-shimmer rounded" />
              <div className="w-24 h-4 animate-shimmer rounded" />
            </div>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <AssetTableEmptyState
          overview={overview}
          blockchainData={blockchainData}
          trackedAccounts={trackedAccounts}
          balancesError={balancesError}
          overviewError={overviewError}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          refreshCooldown={refreshCooldown}
        />
      ) : (
        <div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border">
                <th className="text-left px-6 py-3.5 text-foreground-muted font-data" style={TH_STYLE}>Asset</th>
                <th className="text-right px-6 py-3.5 text-foreground-muted hidden sm:table-cell font-data" style={TH_STYLE}>Price</th>
                <th className="text-right px-6 py-3.5 text-foreground-muted font-data" style={TH_STYLE}>Amount</th>
                <th className="text-right px-6 py-3.5 text-foreground-muted font-data" style={TH_STYLE}>Value</th>
                <th className="text-right px-6 py-3.5 text-foreground-muted hidden md:table-cell font-data" style={TH_STYLE}>%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {visibleAssets.map((asset) => {
                const displayName = resolveDisplayName(asset)
                const isExpandable = asset.sourceCount > 1
                const isExpanded = expandedSymbols.has(asset.symbol)
                const pct = totalValue > 0 ? (asset.totalValue / totalValue) * 100 : 0
                const caipParsed = parseCaip19(asset.assetId)
                const assetChain = caipParsed?.chainKey ?? asset.chain ?? undefined
                const price = pricesMap[asset.assetId]
                  ?? pricesMap[asset.assetId.toLowerCase()]
                  ?? pricesMap[displayName]
                  ?? pricesMap[displayName.toLowerCase()]
                  ?? (asset.totalAmount > 0 && asset.totalValue > 0
                    ? asset.totalValue / asset.totalAmount
                    : undefined)
                const iconUrl = iconMap[displayName]
                  ?? iconMap[displayName.toLowerCase()]
                  ?? iconMap[asset.assetId]
                  ?? iconMap[asset.assetId.toLowerCase()]
                  ?? asset.iconUrl

                return (
                  <AssetRow
                    key={asset.symbol}
                    asset={asset}
                    displayName={displayName}
                    iconUrl={iconUrl}
                    assetChain={assetChain}
                    price={price}
                    pct={pct}
                    isExpandable={isExpandable}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(asset.symbol)}
                    lookupWalletLabel={lookupWalletLabel}
                    isHidden={isHidden}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hidden count footer */}
      {hideSmallBalances && hiddenCount > 0 && (
        <div className="px-6 py-3 border-t border-card-border">
          <button
            onClick={() => setHideSmallBalances(false)}
            className="text-foreground-muted hover:text-foreground-secondary transition-colors text-[10px] tracking-wide"
          >
            {hiddenCount} asset{hiddenCount !== 1 ? "s" : ""} hidden ({"< $5"})
          </button>
        </div>
      )}
    </div>
  )
}
