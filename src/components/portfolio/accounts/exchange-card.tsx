"use client"

import Link from "next/link"
import { formatFiatValue } from "@/lib/portfolio/utils"
import { getExchangeLogoUrl } from "@/lib/portfolio/exchanges"

interface ExchangeCardProps {
  exchange: { id: string; label: string; domain: string }
  totals: { totalValue: number; assetCount: number } | undefined
  onConfirmRemove: (exchangeId: string) => void
}

export function ExchangeCard({ exchange, totals, onConfirmRemove }: ExchangeCardProps) {
  return (
    <div className="group/card bg-card border border-card-border p-6 hover:border-card-border-hover transition-colors rounded-xl">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getExchangeLogoUrl(exchange.domain)}
            alt={exchange.label}
            width={40}
            height={40}
            className="rounded-lg"
            style={{ imageRendering: "auto" }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-sm font-medium">
              {exchange.label}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
              Exchange
            </span>
          </div>
          <p className="text-foreground-muted mt-0.5 text-xs">
            {totals ? `${totals.assetCount} asset${totals.assetCount !== 1 ? "s" : ""}` : "Loading..."}
          </p>
        </div>

        {/* Total Balance */}
        {totals && totals.totalValue > 0 && (
          <div className="flex-shrink-0 text-right mr-2">
            <span className="text-foreground font-data text-base font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatFiatValue(totals.totalValue)}
            </span>
            <p className="text-foreground-muted mt-0.5 text-xs">
              Total Balance
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            href="/portfolio/balances/exchange"
            className="p-2 text-foreground-muted hover:text-foreground transition-colors"
            title="View exchange balances"
          >
            <span className="material-symbols-rounded text-base">visibility</span>
          </Link>
          <button
            onClick={() => onConfirmRemove(exchange.id)}
            className="p-2 text-foreground-muted hover:text-error transition-colors"
            title="Disconnect exchange"
          >
            <span className="material-symbols-rounded text-base">delete</span>
          </button>
        </div>
      </div>
    </div>
  )
}
