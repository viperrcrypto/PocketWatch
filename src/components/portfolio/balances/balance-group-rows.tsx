import { formatCryptoAmount, formatFiatValue } from "@/lib/portfolio/utils"
import { ChainBadge } from "@/components/portfolio/chain-badge"
import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import type { AssetGroup } from "./balances-types"

export function BalanceGroupRows({
  group,
  isExpanded,
  onToggle,
  iconUrl,
  onHideToken,
}: {
  group: AssetGroup
  isExpanded: boolean
  onToggle: () => void
  iconUrl: string | undefined
  onHideToken?: (symbol: string) => void
}) {
  return (
    <>
      {/* Parent row */}
      <tr
        className="border-b border-card-border hover:bg-primary-subtle transition-colors cursor-pointer group/row"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span className={`material-symbols-rounded text-foreground-muted text-sm w-5 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
              chevron_right
            </span>
            <PortfolioAssetIcon asset={group.displayName} assetId={group.asset} chain={group.chain} iconUrl={iconUrl} size={28} />
            <span className="text-foreground font-data text-sm font-medium truncate min-w-0">{group.displayName}</span>
            <span className="inline-flex items-center justify-center bg-card-border/50 text-foreground-muted text-[10px] font-semibold font-data rounded px-1.5 py-0.5 min-w-[20px]">
              {group.rows.length}
            </span>
          </div>
        </td>
        <td className="px-4 py-3" />
        <td className="px-4 py-3" />
        <td className="px-4 py-3 text-right">
          <span className="text-foreground-muted font-data text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCryptoAmount(group.totalAmount)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-foreground font-data text-sm font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatFiatValue(group.totalValue)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-foreground-muted font-data text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            {group.pctOfTotal.toFixed(1)}%
          </span>
        </td>
        {onHideToken && (
          <td className="px-1 py-3 text-center">
            <button
              onClick={(e) => { e.stopPropagation(); onHideToken(group.displayName) }}
              className="opacity-0 group-hover/row:opacity-100 p-1 rounded hover:bg-card-border/40 text-foreground-muted hover:text-foreground transition-all"
              title={`Hide ${group.displayName}`}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>visibility_off</span>
            </button>
          </td>
        )}
      </tr>

      {/* Child rows */}
      {isExpanded && group.rows.map((row) => (
        <tr
          key={`${row.asset}-${row.wallet}-${row.chain}`}
          className="border-b border-card-border/50 last:border-b-0 bg-background-secondary/30"
        >
          <td className="px-4 py-2.5" colSpan={3}>
            <div className="flex items-center gap-3" style={{ paddingLeft: 28 }}>
              <div className="w-px h-6 bg-card-border/60 shrink-0" />
              <ChainBadge chainId={row.chain} size="sm" />
              <span className="text-foreground-muted font-data text-xs truncate min-w-0" title={row.wallet}>
                {row.walletLabel}
              </span>
            </div>
          </td>
          <td className="px-4 py-2.5 text-right">
            <span className="text-foreground-muted font-data text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCryptoAmount(row.amount)}
            </span>
          </td>
          <td className="px-4 py-2.5 text-right">
            <span className="text-foreground-muted font-data text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatFiatValue(row.usd_value)}
            </span>
          </td>
          <td className="px-4 py-2.5" />
          {onHideToken && <td />}
        </tr>
      ))}
    </>
  )
}
