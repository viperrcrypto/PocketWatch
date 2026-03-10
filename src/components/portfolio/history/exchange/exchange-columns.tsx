import { useMemo } from "react"
import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { formatCryptoAmount, shortenAddress } from "@/lib/portfolio/utils"
import { getExchangeLogoUrl, SUPPORTED_EXCHANGES } from "@/lib/portfolio/exchanges"
import type { Column } from "@/components/portfolio/portfolio-data-table"
import type { ExchangeTransaction } from "./exchange-types"
import { formatTimestamp } from "./exchange-constants"
import { StatusBadge, TypeBadge } from "./exchange-badges"

export function useExchangeColumns(): Column<ExchangeTransaction>[] {
  return useMemo(
    () => [
      {
        key: "timestamp",
        header: "Date / Time",
        accessor: (row) => (
          <span className="text-foreground font-data text-sm">
            {formatTimestamp(row.timestamp)}
          </span>
        ),
      },
      {
        key: "type",
        header: "Type",
        accessor: (row) => <TypeBadge type={row.type} side={row.side} />,
      },
      {
        key: "exchange",
        header: "Exchange",
        accessor: (row) => {
          const def = SUPPORTED_EXCHANGES.find((e) => e.id === row.exchange)
          const domain = def?.domain ?? `${row.exchange}.com`
          return (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getExchangeLogoUrl(domain, 22)}
                alt={row.exchangeLabel}
                width={22}
                height={22}
                className="rounded-md"
              />
              <span className="text-foreground text-sm">
                {row.exchangeLabel}
              </span>
            </div>
          )
        },
      },
      {
        key: "currency",
        header: "Asset",
        accessor: (row) => (
          <div className="flex items-center gap-2">
            <PortfolioAssetIcon asset={row.currency} assetId={row.currency} size={22} />
            <span className="text-foreground font-data text-sm">
              {row.currency}
            </span>
            {row.network && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-foreground-muted/10 text-foreground-muted font-data">
                {row.network}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        align: "right" as const,
        accessor: (row) => {
          const isTrade = row.type === "trade"
          const isOutgoing = row.type === "withdrawal" || (isTrade && row.side === "sell")
          const amountClass = isTrade
            ? (row.side === "buy" ? "text-success" : row.side === "sell" ? "text-error" : "text-info")
            : (row.type === "deposit" ? "text-success" : "text-error")
          const sign = isTrade
            ? (row.side === "buy" ? "+" : row.side === "sell" ? "-" : "")
            : (isOutgoing ? "-" : "+")
          return (
            <span className={`font-data text-sm ${amountClass}`}>
              {sign}{formatCryptoAmount(row.amount, 6)}
            </span>
          )
        },
      },
      {
        key: "status",
        header: "Status",
        accessor: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "address",
        header: "Address / TxID",
        accessor: (row) => {
          const display = row.txid || row.address
          if (!display) return <span className="text-foreground-muted">--</span>
          return (
            <span className="text-foreground-muted font-data text-xs" title={display}>
              {shortenAddress(display, 6)}
            </span>
          )
        },
      },
    ],
    [],
  )
}
