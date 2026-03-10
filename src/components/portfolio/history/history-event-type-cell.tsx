"use client"

import { EventBadge } from "./history-helpers"
import { getSpamAssessment } from "./history-spam"

/**
 * Renders the event type column cell: badge + swap chevron + spam/whitelist indicators + flag icon.
 */
export function EventTypeCell({
  row,
  sentTokens,
  goplusScores,
  hideSpam,
  expandedSwapRows,
  whitelistTransaction,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any
  sentTokens: Set<string>
  goplusScores: Map<string, number>
  hideSpam: boolean
  expandedSwapRows: Set<string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whitelistTransaction: any
}) {
  const { score, reasons } = getSpamAssessment(row as Record<string, unknown>, sentTokens, goplusScores)
  const isRowSpam = score >= 50 && row.isWhitelisted !== true
  const isRowWhitelisted = row.isWhitelisted === true
  const label = row.event_type ?? row.type ?? "unknown"
  const isSwapRow = (row.classification === "swap" || label === "swap") && row.grouped_transfers?.length >= 2
  const swapRowKey = row.tx_hash ? `${row.tx_hash}-${row.direction ?? ""}-${row.asset ?? ""}` : null
  const isSwapExpanded = swapRowKey ? expandedSwapRows.has(swapRowKey) : false
  const isWhitelistPending = whitelistTransaction.isPending && whitelistTransaction.variables?.txHash === row.tx_hash

  return (
    <div className="flex items-center gap-1.5">
      {isSwapRow && (
        <span
          className={`material-symbols-rounded text-[14px] text-foreground-muted/60 transition-transform ${isSwapExpanded ? "rotate-90" : ""}`}
          title="Click row to see swap details"
        >
          chevron_right
        </span>
      )}
      <EventBadge type={label} />
      {isRowSpam && !hideSpam && row.source === "onchain" && row.direction === "in" && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!row.tx_hash || !row.chain || !row.address) return
            whitelistTransaction.mutate({
              txHash: row.tx_hash, chain: row.chain, walletAddress: row.address, whitelisted: true,
            })
          }}
          disabled={isWhitelistPending}
          className="cursor-pointer text-warning hover:text-success transition-colors disabled:opacity-50"
          title={`Spam detected (score ${score}): ${reasons.join(", ")} — click to mark as not spam`}
        >
          <span className={`material-symbols-rounded text-[13px] ${isWhitelistPending ? "animate-spin" : ""}`}>
            {isWhitelistPending ? "progress_activity" : "warning"}
          </span>
        </button>
      )}
      {isRowSpam && !hideSpam && (row.source !== "onchain" || row.direction !== "in") && (
        <span
          className="material-symbols-rounded text-[13px] text-warning cursor-help"
          title={`Spam detected (score ${score}): ${reasons.join(", ")}`}
        >
          warning
        </span>
      )}
      {isRowWhitelisted && score >= 50 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!row.tx_hash || !row.chain || !row.address) return
            whitelistTransaction.mutate({
              txHash: row.tx_hash, chain: row.chain, walletAddress: row.address, whitelisted: false,
            })
          }}
          disabled={isWhitelistPending}
          className="cursor-pointer text-success hover:text-warning transition-colors disabled:opacity-50"
          title="Marked as not spam — click to undo"
        >
          <span className={`material-symbols-rounded text-[13px] ${isWhitelistPending ? "animate-spin" : ""}`}>
            {isWhitelistPending ? "progress_activity" : "verified_user"}
          </span>
        </button>
      )}
      {row.isFlagged && (
        <span className="material-symbols-rounded text-[13px] text-error" title="Flagged as suspicious">
          flag
        </span>
      )}
    </div>
  )
}
