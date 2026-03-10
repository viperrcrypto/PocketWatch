"use client"

import { useMemo, useCallback } from "react"
import type { Column } from "@/components/portfolio/portfolio-data-table"
import { PortfolioAmountDisplay } from "@/components/portfolio/portfolio-amount-display"
import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { formatCryptoAmount, shortenAddress } from "@/lib/portfolio/utils"
import { OUTGOING_TYPES } from "./history-constants"
import { formatTimestamp, getExplorerUrl } from "./history-helpers"
import { EventTypeCell } from "./history-event-type-cell"

type LabelTarget = { address: string; chain?: string; rect: DOMRect }
type PriceTarget = { symbol: string; chain: string; asset: string; rect: DOMRect }

export function useHistoryColumns({
  addressNames,
  ownAddresses,
  sentTokens,
  goplusScores,
  hideSpam,
  expandedSwapRows,
  flagTransaction,
  whitelistTransaction,
  setLabelTarget,
  setPriceTarget,
}: {
  addressNames: Map<string, string>
  ownAddresses: Set<string>
  sentTokens: Set<string>
  goplusScores: Map<string, number>
  hideSpam: boolean
  expandedSwapRows: Set<string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flagTransaction: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whitelistTransaction: any
  setLabelTarget: (target: LabelTarget | null) => void
  setPriceTarget: (target: PriceTarget | null) => void
}) {
  const renderAddress = useCallback(
    (addr: string | undefined, chain: string | undefined, onClick?: (e: React.MouseEvent) => void) => {
      if (!addr) return <span className="text-foreground-muted">--</span>
      const lc = addr.toLowerCase()
      const label = addressNames.get(lc)
      const isOwn = ownAddresses.has(lc)
      const display = label || shortenAddress(addr, 6)

      const inner = (
        <span className={`font-data text-xs inline-flex items-center gap-1 ${isOwn ? "text-info" : "text-foreground-muted"}`}>
          {display}
          {isOwn && <span className="text-[9px] opacity-60">(you)</span>}
        </span>
      )

      return (
        <button
          onClick={onClick}
          className="hover:underline cursor-pointer"
          title={label ? `Click to rename: ${label}` : `Click to label: ${addr}`}
        >
          {inner}
        </button>
      )
    },
    [addressNames, ownAddresses]
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Column<any>[] = useMemo(
    () => [
      {
        key: "timestamp",
        header: "Date / Time",
        sortable: true,
        accessor: (row) => (
          <span className="text-foreground font-data text-sm">
            {formatTimestamp(row.timestamp)}
          </span>
        ),
      },
      {
        key: "tx_hash",
        header: "Tx",
        accessor: (row) => {
          const hash = row.tx_hash
          if (!hash) return <span className="text-foreground-muted">--</span>
          const explorerHref = getExplorerUrl(row.chain, `tx/${hash}`)
          return explorerHref ? (
            <a
              href={explorerHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-0.5 font-data text-xs text-foreground-muted hover:text-info transition-colors"
              title={hash}
            >
              {shortenAddress(hash, 4)}
              <svg className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 transition-opacity" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 1h6v6M9 1L1 9"/></svg>
            </a>
          ) : (
            <span className="text-foreground-muted font-data text-xs" title={hash}>{shortenAddress(hash, 4)}</span>
          )
        },
      },
      {
        key: "event_type",
        header: "Type",
        sortable: true,
        accessor: (row) => (
          <EventTypeCell
            row={row} sentTokens={sentTokens} goplusScores={goplusScores}
            hideSpam={hideSpam} expandedSwapRows={expandedSwapRows}
            whitelistTransaction={whitelistTransaction}
          />
        ),
      },
      {
        key: "source",
        header: "Source",
        sortable: true,
        accessor: (row) => (
          <div className="font-data text-xs text-foreground-muted">
            {row.source === "exchange"
              ? (row.exchangeLabel ?? row.exchangeId ?? "Exchange")
              : (row.chain ?? "On-Chain")}
          </div>
        ),
      },
      {
        key: "asset",
        header: "Asset",
        sortable: true,
        accessor: (row) => {
          const assetName = row.asset ?? "--"
          return (
            <div className="flex items-center gap-2">
              {assetName !== "--" && <PortfolioAssetIcon asset={assetName} assetId={row.contract_address ?? row.asset} chain={row.chain} size={22} showChainBadge={false} />}
              <span className="text-foreground font-data text-sm">
                {assetName}
              </span>
            </div>
          )
        },
      },
      {
        key: "amount",
        header: "Amount",
        sortable: true,
        align: "right" as const,
        accessor: (row) => {
          const direction = typeof row.direction === "string" ? row.direction.toLowerCase() : null
          // Use direction field directly — falls back to event_type only when direction is missing
          const evtType = (row.event_type ?? row.type ?? "").toLowerCase()
          const isOutgoing = direction === "out" || (!direction && OUTGOING_TYPES.has(evtType))
          return (
            <span className={`font-data text-sm ${isOutgoing ? "text-error" : "text-success"}`}>
              {isOutgoing ? "-" : "+"}
              {formatCryptoAmount(row.balance?.amount ?? row.amount ?? 0, 6)}
            </span>
          )
        },
      },
      {
        key: "from_to",
        header: "From / To",
        accessor: (row) => {
          const direction = typeof row.direction === "string" ? row.direction.toLowerCase() : null
          const chain = row.chain as string | undefined
          const userAddr = row.address as string | undefined
          const counterAddr = row.counterparty as string | undefined

          const handleAddrClick = (addr: string) => (e: React.MouseEvent) => {
            e.preventDefault()
            setLabelTarget({ address: addr, chain, rect: (e.target as HTMLElement).getBoundingClientRect() })
          }

          if (direction === "out") {
            return (
              <div className="flex items-center gap-1 font-data text-xs">
                {renderAddress(userAddr, chain, userAddr ? handleAddrClick(userAddr) : undefined)}
                <span className="text-foreground-muted mx-0.5">{"\u2192"}</span>
                {renderAddress(counterAddr, chain, counterAddr ? handleAddrClick(counterAddr) : undefined)}
              </div>
            )
          }

          if (direction === "in") {
            return (
              <div className="flex items-center gap-1 font-data text-xs">
                {renderAddress(counterAddr, chain, counterAddr ? handleAddrClick(counterAddr) : undefined)}
                <span className="text-foreground-muted mx-0.5">{"\u2192"}</span>
                {renderAddress(userAddr, chain, userAddr ? handleAddrClick(userAddr) : undefined)}
              </div>
            )
          }

          // Null direction (some exchange trades) — show counterparty or address
          const primary = counterAddr || userAddr
          return (
            <div className="font-data text-xs">
              {renderAddress(primary, chain, primary ? handleAddrClick(primary) : undefined)}
            </div>
          )
        },
      },
      {
        key: "value",
        header: "Value (USD)",
        sortable: true,
        align: "right" as const,
        accessor: (row) => {
          const usdValue = row.balance?.usd_value ?? row.usd_value ?? null
          if (usdValue === null || usdValue === undefined) {
            if (row.source === "exchange") {
              return <span className="text-foreground-muted">--</span>
            }
            const symbol = row.asset ?? row.symbol
            const chain = row.chain
            const asset = row.contract_address ?? row.asset_address ?? "native"
            return (
              <button
                onClick={(e) => {
                  if (symbol && chain) {
                    setPriceTarget({
                      symbol,
                      chain,
                      asset,
                      rect: (e.target as HTMLElement).getBoundingClientRect(),
                    })
                  }
                }}
                className="text-foreground-muted hover:text-warning transition-colors cursor-pointer"
                title={`Set price for ${symbol ?? "unknown"}`}
              >
                --
              </button>
            )
          }
          return (
            <PortfolioAmountDisplay
              amount={usdValue}
              currency="$"
              decimals={2}
              className="text-foreground"
            />
          )
        },
      },
      {
        key: "flag",
        header: "",
        align: "right" as const,
        accessor: (row) => {
          if (row.source !== "onchain" || row.direction !== "in") return null
          const isFlagged = row.isFlagged === true
          const isPending = flagTransaction.isPending && flagTransaction.variables?.txHash === row.tx_hash
          return (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!row.tx_hash || !row.chain || !row.address) return
                flagTransaction.mutate({
                  txHash: row.tx_hash,
                  chain: row.chain,
                  walletAddress: row.address,
                  flagged: !isFlagged,
                })
              }}
              disabled={isPending}
              title={isFlagged ? "Unflag transaction" : "Flag as suspicious"}
              className={`cursor-pointer p-1 rounded transition-colors disabled:opacity-50 ${
                isFlagged
                  ? "text-error hover:text-error/70"
                  : "text-foreground-muted/40 hover:text-foreground-muted"
              }`}
            >
              {isPending ? (
                <span className="material-symbols-rounded text-[15px] animate-spin">progress_activity</span>
              ) : (
                <span className={`material-symbols-rounded text-[15px] ${isFlagged ? "" : "font-light"}`}
                  style={{ fontVariationSettings: isFlagged ? "'FILL' 1" : "'FILL' 0" }}>
                  flag
                </span>
              )}
            </button>
          )
        },
      },
    ],
    [addressNames, ownAddresses, renderAddress, sentTokens, goplusScores, hideSpam, flagTransaction, whitelistTransaction, expandedSwapRows, setLabelTarget, setPriceTarget]
  )

  return columns
}
