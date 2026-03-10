"use client"

import { useState } from "react"
import { useNFTPortfolio, useNFTOverride } from "@/hooks/use-portfolio-tracker"

function formatUsd(value: number | null): string {
  if (value == null || value === 0) return "--"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function formatEth(value: number | null): string {
  if (value == null) return "--"
  return `${value.toFixed(4)} ETH`
}

const CHAIN_COLORS: Record<string, string> = {
  ETHEREUM: "bg-blue-500/15 text-blue-400",
  BASE:     "bg-sky-500/15 text-sky-400",
  POLYGON:  "bg-purple-500/15 text-purple-400",
  ARBITRUM: "bg-blue-600/15 text-blue-300",
  OPTIMISM: "bg-red-500/15 text-red-400",
  ZORA:     "bg-orange-500/15 text-orange-400",
  BLAST:    "bg-yellow-500/15 text-yellow-400",
  ZKSYNC:   "bg-indigo-500/15 text-indigo-300",
  AVAX:     "bg-red-500/15 text-red-300",
  LINEA:    "bg-cyan-500/15 text-cyan-300",
  BSC:      "bg-amber-500/15 text-amber-400",
}

function CollectionCard({
  col,
  expanded,
  onToggle,
  overrideAction,
  overrideLabel,
  onOverride,
  dimmed,
}: {
  col: any
  expanded: boolean
  onToggle: () => void
  overrideAction: "show" | "hide"
  overrideLabel: string
  onOverride: () => void
  dimmed?: boolean
}) {
  const collectionValue = (col.floorPriceUsd ?? 0) * col.totalBalance
  const chainColor = CHAIN_COLORS[col.chain] ?? "bg-foreground/10 text-foreground-muted"
  const nfts: any[] = col.nfts ?? []

  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${dimmed ? "opacity-60" : ""}`}>
      {/* Collection row */}
      <button
        className="w-full flex items-center gap-4 p-4 hover:bg-foreground/[0.03] transition-colors text-left"
        onClick={onToggle}
      >
        {col.imageUrl ? (
          <img src={col.imageUrl} alt={col.name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-foreground/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-rounded text-foreground-muted text-xl">image</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{col.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${chainColor}`}>
              {col.chainName}
            </span>
            {dimmed && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-400">
                Likely spam
              </span>
            )}
          </div>
          <div className="text-xs text-foreground-muted mt-0.5">
            {col.totalBalance} NFT{col.totalBalance !== 1 ? "s" : ""}
            {col.floorPrice != null && ` · Floor: ${formatEth(col.floorPrice)}`}
          </div>
          {dimmed && col.spamReasons && col.spamReasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {col.spamReasons.map((reason: string) => (
                <span
                  key={reason}
                  className="text-[10px] leading-tight px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/90 border border-red-500/20"
                >
                  {reason}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="text-right flex-shrink-0 mr-2">
          <div className="font-semibold">{collectionValue > 0 ? formatUsd(collectionValue) : "--"}</div>
          {col.floorPriceUsd != null && (
            <div className="text-xs text-foreground-muted">{formatUsd(col.floorPriceUsd)} / NFT</div>
          )}
        </div>

        <span className={`material-symbols-rounded text-foreground-muted text-xl flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {/* Expanded NFT grid */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {/* Links + override button */}
          <div className="flex items-center gap-3 mb-3">
            {col.openSeaUrl && (
              <a
                href={col.openSeaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-foreground-muted hover:text-foreground flex items-center gap-1"
              >
                <span className="material-symbols-rounded text-sm">open_in_new</span>
                View on OpenSea
              </a>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onOverride() }}
              className="ml-auto text-xs px-2 py-1 rounded-md border border-border hover:bg-foreground/5 text-foreground-muted hover:text-foreground transition-colors"
            >
              {overrideLabel}
            </button>
          </div>

          {/* Individual NFT grid */}
          {nfts.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {nfts.map((nft: any) => (
                <div key={nft.tokenId} className="group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-foreground/5 border border-border">
                    {nft.imageUrl ? (
                      <img
                        src={nft.imageUrl}
                        alt={nft.name ?? `#${nft.tokenId}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-rounded text-foreground-muted">image</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-foreground-muted mt-1 truncate">
                    {nft.name ?? `#${nft.tokenId}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">No metadata available for this collection.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function NFTsPage() {
  const { data, isLoading, error } = useNFTPortfolio()
  const overrideMutation = useNFTOverride()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showSpam, setShowSpam] = useState(false)

  const collections = data?.collections ?? []
  const spamCollections = data?.spamCollections ?? []
  const totalValue = data?.totalValueUsd ?? 0
  const nftCount = data?.nftCount ?? 0
  const collectionCount = data?.collectionCount ?? 0
  const spamCount = data?.spamCount ?? 0

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">NFT Portfolio</h1>
          <p className="text-sm text-foreground-muted mt-1">NFT holdings with floor price valuations via OpenSea.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-36 rounded-xl border border-border bg-card animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">NFT Portfolio</h1>
        </div>
        <div className="rounded-xl border border-border bg-card p-8 text-center text-foreground-muted">
          <span className="material-symbols-rounded text-3xl block mb-2">error_outline</span>
          Failed to load NFT portfolio. Make sure your Alchemy API key is configured in Settings.
        </div>
      </div>
    )
  }

  const handleOverride = (contractAddress: string, action: "show" | "hide") => {
    overrideMutation.mutate({ contractAddress, action })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">NFT Portfolio</h1>
        <p className="text-sm text-foreground-muted mt-1">
          NFT holdings across 11 EVM chains via Alchemy.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-foreground-muted">Estimated Value</p>
          <p className="text-xl font-bold mt-1">{formatUsd(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-foreground-muted">NFTs Owned</p>
          <p className="text-xl font-bold mt-1">{nftCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-foreground-muted">Collections</p>
          <p className="text-xl font-bold mt-1">{collectionCount}</p>
        </div>
      </div>

      {/* Verified Collections */}
      {collections.length === 0 && spamCollections.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-foreground-muted">
          <span className="material-symbols-rounded text-4xl block mb-3">collections</span>
          <p className="font-medium">No NFTs found</p>
          <p className="text-sm mt-1">No NFTs found across your tracked wallets on any supported EVM chain.</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-foreground-muted">
          <span className="material-symbols-rounded text-3xl block mb-2">filter_alt</span>
          <p className="font-medium">All NFTs flagged as likely spam</p>
          <p className="text-sm mt-1">Check the hidden section below — if any are real, click "Not spam" to move them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map((col: any) => {
            const key = col.contractAddress + col.chain
            return (
              <CollectionCard
                key={key}
                col={col}
                expanded={expanded === key}
                onToggle={() => setExpanded(expanded === key ? null : key)}
                overrideAction="hide"
                overrideLabel="Hide"
                onOverride={() => handleOverride(col.contractAddress, "hide")}
              />
            )
          })}
        </div>
      )}

      {/* Spam Section */}
      {spamCollections.length > 0 && (
        <div>
          <button
            onClick={() => setShowSpam(!showSpam)}
            className="flex items-center gap-2 w-full text-left px-1 py-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            <span className={`material-symbols-rounded text-base transition-transform ${showSpam ? "rotate-180" : ""}`}>
              expand_more
            </span>
            <span className="font-medium">
              Hidden — {spamCount} likely spam NFT{spamCount !== 1 ? "s" : ""} in {spamCollections.length} collection{spamCollections.length !== 1 ? "s" : ""}
            </span>
          </button>

          {showSpam && (
            <div className="space-y-3 mt-2">
              {spamCollections.map((col: any) => {
                const key = col.contractAddress + col.chain
                return (
                  <CollectionCard
                    key={key}
                    col={col}
                    expanded={expanded === key}
                    onToggle={() => setExpanded(expanded === key ? null : key)}
                    overrideAction="show"
                    overrideLabel="Not spam"
                    onOverride={() => handleOverride(col.contractAddress, "show")}
                    dimmed
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Per-wallet breakdown (multi-wallet only) */}
      {(data?.wallets ?? []).length > 1 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide">By Wallet</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(data.wallets as any[]).map((w: any) => (
              <div key={w.address} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {w.label ?? `${w.address.slice(0, 6)}…${w.address.slice(-4)}`}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {w.collectionCount} collection{w.collectionCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold flex-shrink-0 ml-3">{formatUsd(w.totalValueUsd)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-foreground-muted text-center">
        Values estimated using collection floor prices from OpenSea. Individual NFTs may differ.
        Alchemy NFT API · No separate OpenSea key required.
      </p>
    </div>
  )
}
