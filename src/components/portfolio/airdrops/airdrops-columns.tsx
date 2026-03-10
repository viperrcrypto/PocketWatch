"use client"

import { formatCryptoAmount, formatFiatValue } from "@/lib/portfolio/utils"
import { ChainBadge } from "@/components/portfolio/chain-badge"
import { getChainMeta } from "@/lib/portfolio/chains"
import { Column } from "@/components/portfolio/portfolio-data-table"
import { STATUS_STYLES, type ViewTab } from "./airdrops-constants"
import type { AirdropResult } from "@/lib/portfolio/airdrop-types"

export function getAirdropColumns(activeView: ViewTab): Column<AirdropResult>[] {
  return [
    {
      key: "protocol",
      header: activeView === "vesting" ? "Platform" : "Protocol",
      sortable: true,
      accessor: (row) => (
        <div className="flex items-center gap-3">
          {row.iconUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={row.iconUrl}
              alt={row.protocol}
              className="w-7 h-7 object-contain rounded"
              onError={(e) => {
                e.currentTarget.style.display = "none"
                const next = e.currentTarget.nextElementSibling as HTMLElement | null
                if (next) next.style.display = "flex"
              }}
            />
          ) : null}
          <div
            className="w-7 h-7 bg-card-elevated items-center justify-center rounded text-foreground-muted"
            style={{
              display: row.iconUrl ? "none" : "flex",
              fontSize: 9,
              fontWeight: 600,
            }}
          >
            {row.protocol.slice(0, 3).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-foreground font-data text-sm font-medium">
              {row.protocol}
            </span>
            {row.source === "vesting" && (
              <span className="text-primary text-[9px] font-semibold tracking-wide">
                VESTING
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "token",
      header: "Token",
      accessor: (row) => (
        <span className="text-foreground-muted font-data text-sm">
          {row.token}
        </span>
      ),
    },
    {
      key: "chain",
      header: "Chain",
      sortable: true,
      accessor: (row) => <ChainBadge chainId={row.chain} size="sm" />,
    },
    {
      key: "wallet",
      header: "Wallet",
      accessor: (row) => {
        if (!row.address) return <span className="text-foreground-muted font-data text-xs">--</span>
        const chainMeta = getChainMeta(row.chain)
        const explorerBase = chainMeta?.explorerUrl ?? "https://etherscan.io"
        const path = row.chain === "SOL" ? "account" : "address"
        const explorerUrl = `${explorerBase}/${path}/${row.address}`
        const short = `${row.address.slice(0, 6)}...${row.address.slice(-4)}`
        return (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={row.address}
            className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors font-data text-xs"
            style={{ fontVariantNumeric: "tabular-nums" }}
            onClick={(e) => e.stopPropagation()}
          >
            {short}
            <span className="material-symbols-rounded text-foreground-muted hover:text-foreground-secondary" style={{ fontSize: 12 }}>open_in_new</span>
          </a>
        )
      },
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      accessor: (row) => (
        <span
          className="text-foreground font-data text-sm"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {row.amount > 0 ? formatCryptoAmount(row.amount) : "--"}
        </span>
      ),
    },
    {
      key: "usdValue",
      header: "Value",
      sortable: true,
      align: "right",
      accessor: (row) => (
        <span
          className="text-foreground-muted font-data text-sm"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {row.usdValue != null && row.usdValue > 0 ? formatFiatValue(row.usdValue) : "--"}
        </span>
      ),
    },
    {
      key: "deadline",
      header: activeView === "vesting" ? "Vest End" : "Deadline",
      sortable: true,
      align: "center",
      accessor: (row) => {
        if (!row.deadline) {
          return <span className="text-foreground-muted font-data text-xs">--</span>
        }
        const days = row.deadlineDaysLeft
        const isUrgent = days != null && days >= 0 && days < 7
        const isExpired = days != null && days < 0
        const isPermanent = days != null && days > 36500
        return (
          <div className="flex flex-col items-center gap-0.5">
            {isPermanent ? (
              <>
                <span className="text-foreground-muted font-data text-xs">Permanent</span>
                <span className="text-foreground-muted text-[9px] font-semibold tracking-wide">LOCKED</span>
              </>
            ) : (
              <>
                <span
                  className={`font-data text-xs ${isExpired ? "text-error" : isUrgent ? "text-warning" : "text-foreground-muted"}`}
                >
                  {new Date(row.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {days != null && days >= 0 && (
                  <span
                    className={`text-[9px] font-semibold tracking-wide ${isUrgent ? "text-warning" : "text-foreground-muted"}`}
                  >
                    {days}d left
                  </span>
                )}
                {isExpired && (
                  <span className="text-error text-[9px] font-semibold tracking-wide">
                    {activeView === "vesting" ? "VESTED" : "EXPIRED"}
                  </span>
                )}
              </>
            )}
          </div>
        )
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      align: "center",
      accessor: (row) => {
        const displayStatus = row.source === "vesting" && row.status === "unclaimed" ? "locked" : row.status
        const style = STATUS_STYLES[displayStatus] || STATUS_STYLES.unknown
        return (
          <span
            className={`inline-block px-2.5 py-0.5 rounded-sm ${style.bg} ${style.text} font-data text-[10px] font-semibold tracking-wide`}
          >
            {style.label}
          </span>
        )
      },
    },
    {
      key: "link",
      header: "Claim",
      align: "right",
      accessor: (row) =>
        row.claimUrl ? (
          <a
            href={row.claimUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors font-data text-xs font-semibold tracking-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>open_in_new</span>
            Claim
          </a>
        ) : (
          <span className="text-foreground-muted text-sm">--</span>
        ),
    },
  ]
}
