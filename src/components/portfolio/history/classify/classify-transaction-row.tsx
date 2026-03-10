import { getChainMeta } from "@/lib/portfolio/chains"
import { formatCryptoAmount, formatFiatValue, shortenAddress } from "@/lib/portfolio/utils"
import {
  getClassificationBadgeStyle,
  formatTimestamp,
  formatClassificationLabel,
  ClassificationBadge,
  DirectionBadge,
  type TransactionRow,
} from "@/components/portfolio/classify-helpers"
import { getExplorerUrl } from "./classify-helpers"

export function ClassifyTransactionRow({
  tx,
  isSelected,
  onToggle,
  onClassify,
}: {
  tx: TransactionRow
  isSelected: boolean
  onToggle: () => void
  onClassify: (rect: DOMRect) => void
}) {
  const chainMeta = getChainMeta(tx.chain)
  const explorerHref = tx.txHash ? getExplorerUrl(tx.chain, `tx/${tx.txHash}`) : null
  const hasOverride = tx.manualClassification != null && tx.manualClassification !== tx.txClassification
  const isIn = tx.direction?.toLowerCase() === "in"

  return (
    <tr
      className={`border-b border-card-border transition-colors last:border-b-0 hover:bg-primary-subtle ${
        isSelected ? "bg-primary-subtle/50" : ""
      }`}
    >
      {/* Checkbox */}
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-card-border-hover accent-primary cursor-pointer"
        />
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <span className="text-foreground font-data text-sm">
          {formatTimestamp(tx.blockTimestamp)}
        </span>
      </td>

      {/* Chain */}
      <td className="px-4 py-3 text-sm whitespace-nowrap hidden md:table-cell">
        <span className="font-data text-xs" style={{ color: chainMeta?.color ?? "var(--foreground-muted)" }}>
          {chainMeta?.name ?? tx.chain}
        </span>
      </td>

      {/* Tx Hash */}
      <td className="px-4 py-3 text-sm whitespace-nowrap hidden lg:table-cell">
        {tx.txHash ? (
          explorerHref ? (
            <a
              href={explorerHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-0.5 font-data text-xs text-foreground-muted hover:text-info transition-colors"
              title={tx.txHash}
            >
              {shortenAddress(tx.txHash, 4)}
              <svg
                className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 transition-opacity"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 1h6v6M9 1L1 9" />
              </svg>
            </a>
          ) : (
            <span className="text-foreground-muted font-data text-xs" title={tx.txHash}>
              {shortenAddress(tx.txHash, 4)}
            </span>
          )
        ) : (
          <span className="text-foreground-muted">--</span>
        )}
      </td>

      {/* Direction */}
      <td className="px-4 py-3 text-sm whitespace-nowrap hidden sm:table-cell">
        {tx.direction ? <DirectionBadge direction={tx.direction} /> : <span className="text-foreground-muted">--</span>}
      </td>

      {/* Asset/Symbol */}
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <span className="text-foreground font-data text-sm">{tx.symbol || tx.asset || "--"}</span>
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-sm whitespace-nowrap text-right hidden sm:table-cell">
        <span className={`font-data text-sm ${isIn ? "text-success" : "text-error"}`}>
          {isIn ? "+" : "-"}
          {formatCryptoAmount(tx.amount, 6)}
        </span>
      </td>

      {/* Value (USD) */}
      <td className="px-4 py-3 text-sm whitespace-nowrap text-right hidden md:table-cell">
        {tx.usdValue != null ? (
          <span className="text-foreground font-data text-sm">{formatFiatValue(tx.usdValue)}</span>
        ) : (
          <span className="text-foreground-muted">--</span>
        )}
      </td>

      {/* Auto Classification */}
      <td className="px-4 py-3 text-sm whitespace-nowrap hidden xl:table-cell">
        {tx.txClassification ? (
          <span
            className={`inline-block px-2 py-0.5 rounded font-data text-[10px] font-semibold tracking-wide uppercase ${
              hasOverride
                ? "line-through opacity-40 " + getClassificationBadgeStyle(tx.txClassification)
                : getClassificationBadgeStyle(tx.txClassification)
            }`}
          >
            {formatClassificationLabel(tx.txClassification)}
          </span>
        ) : (
          <span className="text-foreground-muted text-xs">--</span>
        )}
      </td>

      {/* Manual Classification */}
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        {tx.manualClassification ? (
          <ClassificationBadge classification={tx.manualClassification} isManual />
        ) : (
          <span className="text-foreground-muted text-xs">&mdash;</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClassify((e.currentTarget as HTMLElement).getBoundingClientRect())
          }}
          className="p-1 rounded text-foreground-muted/60 hover:text-foreground hover:bg-primary-subtle transition-colors"
          title="Classify transaction"
        >
          <span className="material-symbols-rounded text-[18px]">more_vert</span>
        </button>
      </td>
    </tr>
  )
}
