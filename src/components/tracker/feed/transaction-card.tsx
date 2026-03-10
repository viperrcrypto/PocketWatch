"use client"

import type { TrackerTransaction } from "@/lib/tracker/types"
import { formatPrice, formatUsd, formatAmount, getRelativeTime } from "@/lib/tracker/classifier"
import { truncateAddress } from "@/lib/tracker/links"
import { CHAIN_CONFIGS } from "@/lib/tracker/chains"
import TypeBadge from "./type-badge"
import QuickLinksRow from "./quick-links-row"
import QuickTradeRow from "./quick-trade-row"

interface TransactionCardProps {
  tx: TrackerTransaction
}

export default function TransactionCard({ tx }: TransactionCardProps) {
  const chainConfig = CHAIN_CONFIGS[tx.chain]
  const tokenAddress = tx.tokenOutAddress || tx.tokenInAddress || tx.tokenAddress || ""
  const tokenSymbol = tx.type === "BUY"
    ? (tx.tokenOutSymbol || tx.tokenSymbol || "???")
    : tx.type === "SELL"
      ? (tx.tokenInSymbol || tx.tokenSymbol || "???")
      : (tx.tokenSymbol || "???")
  const tokenName = tx.tokenName || tokenSymbol

  // Determine native token amounts for BUY/SELL display
  const nativeSymbols = ["ETH", "WETH", "SOL", "WSOL", "BNB", "WBNB", "MATIC", "WMATIC", "POL", "WPOL"]
  let nativeSymbol = chainConfig.nativeToken
  let nativeAmount: number | undefined
  let tokenAmount: number | undefined

  if (tx.type === "BUY") {
    // Bought tokenOut, spent tokenIn (native)
    tokenAmount = tx.tokenOutAmount || tx.amountFormatted
    if (tx.tokenInSymbol && nativeSymbols.includes(tx.tokenInSymbol.toUpperCase())) {
      nativeSymbol = tx.tokenInSymbol
      nativeAmount = tx.tokenInAmount
    } else {
      nativeAmount = tx.amountFormatted
    }
  } else if (tx.type === "SELL") {
    // Sold tokenIn, received tokenOut (native)
    tokenAmount = tx.tokenInAmount || tx.amountFormatted
    if (tx.tokenOutSymbol && nativeSymbols.includes(tx.tokenOutSymbol.toUpperCase())) {
      nativeSymbol = tx.tokenOutSymbol
      nativeAmount = tx.tokenOutAmount
    } else {
      nativeAmount = tx.amountFormatted
    }
  } else {
    tokenAmount = tx.amountFormatted
    nativeAmount = tx.amountFormatted
  }

  const amountLabel = tx.type === "BUY" ? "SPENT" : tx.type === "SELL" ? "RECEIVED" : "AMOUNT"

  return (
    <div className="card-interactive p-4 space-y-3">
      {/* ─── Top Row: Type, Token, DEX, Wallet, Time ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <TypeBadge type={tx.type} />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-foreground text-sm truncate">
              {tokenName}
            </span>
            <span className="text-foreground-muted text-xs">
              ${tokenSymbol}
            </span>
          </div>
          {tx.dexName && (
            <span className="text-[10px] uppercase tracking-wider text-foreground-muted border border-card-border px-1.5 py-0.5">
              {tx.dexName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tx.walletLabel && (
            <span className="text-[11px] text-foreground-muted border border-card-border px-1.5 py-0.5">
              {tx.walletLabel}
            </span>
          )}
          <span
            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 border"
            style={{
              borderColor: chainConfig.color,
              color: chainConfig.color,
              backgroundColor: `${chainConfig.color}15`,
            }}
          >
            {chainConfig.shortName}
          </span>
          <span className="text-[11px] text-foreground-muted font-mono tabular-nums">
            {getRelativeTime(tx.blockTimestamp)}
          </span>
        </div>
      </div>

      {/* ─── Middle Row: Price / Amount / MCAP ─── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Price */}
        <div className="space-y-1">
          <span className="section-label">Price</span>
          <p className="text-foreground text-sm font-mono tabular-nums">
            {formatPrice(tx.priceUsd)}
          </p>
        </div>

        {/* Amount Spent/Received */}
        <div className="space-y-1">
          <span className="section-label">{amountLabel}</span>
          <div>
            {(tx.type === "BUY" || tx.type === "SELL") && nativeAmount !== undefined ? (
              <>
                <p className="text-foreground text-sm font-mono tabular-nums">
                  {formatAmount(nativeAmount)} {nativeSymbol}
                </p>
                {tx.valueUsd !== undefined && (
                  <p className="text-foreground-muted text-xs font-mono tabular-nums">
                    {formatUsd(tx.valueUsd)}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-foreground text-sm font-mono tabular-nums">
                  {formatAmount(tokenAmount)} {tokenSymbol}
                </p>
                {tx.valueUsd !== undefined && (
                  <p className="text-foreground-muted text-xs font-mono tabular-nums">
                    {formatUsd(tx.valueUsd)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Market Cap */}
        <div className="space-y-1">
          <span className="section-label">MCAP</span>
          <p className="text-foreground text-sm font-mono tabular-nums">
            {formatUsd(tx.marketCap)}
          </p>
        </div>
      </div>

      {/* ─── Bottom Row: Chart Links + Trade Links ─── */}
      {tokenAddress && (
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-card-border flex-wrap">
          <QuickLinksRow chain={tx.chain} tokenAddress={tokenAddress} />
          <QuickTradeRow chain={tx.chain} tokenAddress={tokenAddress} />
        </div>
      )}
    </div>
  )
}
