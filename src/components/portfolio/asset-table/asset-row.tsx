"use client"

import type { AggregatedAsset } from "@/lib/portfolio/aggregated-assets"
import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { ChainBadge } from "@/components/portfolio/chain-badge"
import { formatCryptoAmount, formatFiatValue } from "@/lib/portfolio/utils"
import { getExchangeLogoUrl } from "@/lib/portfolio/exchanges"
import { BlurredValue } from "@/components/portfolio/blurred-value"

const TABULAR_NUMS = { fontVariantNumeric: "tabular-nums" as const }

export function AssetRow({
  asset,
  displayName,
  iconUrl,
  assetChain,
  price,
  pct,
  isExpandable,
  isExpanded,
  onToggle,
  lookupWalletLabel,
  isHidden,
}: {
  asset: AggregatedAsset
  displayName: string
  iconUrl?: string | null
  assetChain?: string
  price?: number
  pct: number
  isExpandable: boolean
  isExpanded: boolean
  onToggle: () => void
  lookupWalletLabel: (address: string) => string
  isHidden?: boolean
}) {
  return (
    <>
      <tr
        className={`hover:bg-[rgba(0,0,0,0.02)] transition-colors duration-150 ${isExpandable ? "cursor-pointer" : ""}`}
        onClick={isExpandable ? onToggle : undefined}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            {isExpandable ? (
              <span
                className={`material-symbols-rounded text-foreground-muted text-base transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
              >
                chevron_right
              </span>
            ) : (
              <span className="w-[20px]" />
            )}
            <PortfolioAssetIcon
              asset={displayName}
              assetId={asset.assetId}
              chain={assetChain}
              iconUrl={iconUrl}
              size={32}
            />
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-foreground font-data text-sm font-medium truncate min-w-0">
                {displayName}
              </span>
              {isExpandable && (
                <span className="text-[9px] font-data text-foreground-muted bg-background border border-card-border px-1.5 py-0.5 rounded">
                  {asset.sourceCount}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="text-right px-6 py-4 text-foreground-muted hidden sm:table-cell font-data text-sm" style={TABULAR_NUMS}>
          <BlurredValue isHidden={!!isHidden}>
            {price ? formatFiatValue(price) : "--"}
          </BlurredValue>
        </td>
        <td className="text-right px-6 py-4 text-foreground-muted font-data text-sm" style={TABULAR_NUMS}>
          {formatCryptoAmount(asset.totalAmount)}
        </td>
        <td className="text-right px-6 py-4 text-foreground font-data text-sm font-medium" style={TABULAR_NUMS}>
          <BlurredValue isHidden={!!isHidden}>
            {formatFiatValue(asset.totalValue)}
          </BlurredValue>
        </td>
        <td className="text-right px-6 py-4 hidden md:table-cell font-data text-xs" style={TABULAR_NUMS}>
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-[2px] bg-card-border overflow-hidden flex-shrink-0 rounded-full">
              <div
                className="h-full bg-foreground/40 transition-[width] duration-500"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-foreground-muted w-10 text-right">{pct.toFixed(1)}%</span>
          </div>
        </td>
      </tr>

      {/* Expanded sub-rows */}
      {isExpandable && isExpanded && asset.sources.map((source, i) => (
        <tr
          key={`${asset.symbol}-${source.type}-${source.id}-${i}`}
          className="bg-background/40"
        >
          <td className="px-6 py-3" colSpan={2}>
            <div className="flex items-center gap-3 pl-[52px] border-l-2 border-primary/20 ml-2.5">
              {source.type === "exchange" ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getExchangeLogoUrl(source.exchangeDomain ?? `${source.id}.com`, 32)}
                    alt={source.label ?? source.id}
                    width={18}
                    height={18}
                    className="rounded-sm flex-shrink-0"
                  />
                  <span className="text-foreground-secondary font-data text-xs">
                    {source.label ?? source.id}
                  </span>
                </>
              ) : (
                <>
                  {source.chain && <ChainBadge chainId={source.chain} size="sm" />}
                  <span className="text-foreground-secondary font-data text-xs font-mono">
                    {lookupWalletLabel(source.id)}
                  </span>
                </>
              )}
            </div>
          </td>
          <td className="text-right px-6 py-3 text-foreground-muted font-data text-xs" style={TABULAR_NUMS}>
            {formatCryptoAmount(source.amount)}
          </td>
          <td className="text-right px-6 py-3 text-foreground-muted font-data text-xs" style={TABULAR_NUMS}>
            <BlurredValue isHidden={!!isHidden}>
              {formatFiatValue(source.usd_value)}
            </BlurredValue>
          </td>
          <td className="hidden md:table-cell" />
        </tr>
      ))}
    </>
  )
}
