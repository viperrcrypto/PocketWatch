"use client"

import type { TokenHolding } from "@/lib/tracker/types"
import { formatUsd, formatAmount } from "@/lib/tracker/classifier"
import { CHAIN_CONFIGS } from "@/lib/tracker/chains"

interface TokenHoldingsProps {
  holdings: TokenHolding[]
  isLoading?: boolean
}

function HoldingsSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border bg-background-secondary">
        <div className="h-3 w-24 bg-card-border animate-pulse" />
      </div>
      <div className="divide-y divide-card-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4 animate-pulse">
            <div className="h-4 w-16 bg-card-border" />
            <div className="h-4 w-20 bg-card-border" />
            <div className="h-4 w-16 bg-card-border" />
            <div className="h-4 w-14 bg-card-border" />
            <div className="h-4 w-12 bg-card-border" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TokenHoldings({ holdings, isLoading }: TokenHoldingsProps) {
  if (isLoading) {
    return <HoldingsSkeleton />
  }

  if (!holdings || holdings.length === 0) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center text-center space-y-2">
        <span
          className="material-symbols-rounded text-card-border"
          style={{ fontSize: 36 }}
        >
          token
        </span>
        <p className="text-sm text-foreground-muted">No token holdings found</p>
      </div>
    )
  }

  // Sort by portfolio percentage descending
  const sorted = [...holdings].sort((a, b) => b.portfolioPercent - a.portfolioPercent)

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-card-border bg-background-secondary">
            <th className="text-left px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              Token
            </th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              Chain
            </th>
            <th className="text-right px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              Amount
            </th>
            <th className="text-right px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              Value
            </th>
            <th className="text-right px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              PnL
            </th>
            <th className="text-right px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              % Portfolio
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((holding) => {
            const chainConfig = CHAIN_CONFIGS[holding.chain]
            const pnlColor = holding.pnl > 0 ? "var(--success)" : holding.pnl < 0 ? "var(--error)" : "var(--foreground-muted)"

            return (
              <tr
                key={`${holding.chain}:${holding.tokenAddress}`}
                className="border-b border-card-border last:border-b-0 table-row-hover transition-colors"
              >
                {/* Token */}
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-foreground font-medium">
                      {holding.tokenSymbol}
                    </span>
                    {holding.tokenName && holding.tokenName !== holding.tokenSymbol && (
                      <span className="text-[11px] text-foreground-muted truncate max-w-[140px]">
                        {holding.tokenName}
                      </span>
                    )}
                  </div>
                </td>

                {/* Chain */}
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border"
                    style={{
                      borderColor: chainConfig.color,
                      color: chainConfig.color,
                      backgroundColor: `${chainConfig.color}15`,
                      borderRadius: 0,
                    }}
                  >
                    {chainConfig.shortName}
                  </span>
                </td>

                {/* Amount */}
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-foreground font-mono tabular-nums">
                    {formatAmount(holding.amount)}
                  </span>
                </td>

                {/* Value */}
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-foreground font-mono tabular-nums">
                    {formatUsd(holding.valueUsd)}
                  </span>
                </td>

                {/* PnL */}
                <td className="px-4 py-3 text-right">
                  <span
                    className="text-sm font-mono tabular-nums"
                    style={{ color: pnlColor }}
                  >
                    {holding.pnl > 0 ? "+" : ""}
                    {formatUsd(holding.pnl)}
                  </span>
                </td>

                {/* Portfolio % */}
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm text-foreground font-mono tabular-nums">
                      {holding.portfolioPercent.toFixed(1)}%
                    </span>
                    <div className="w-16 h-1 bg-card-border">
                      <div
                        className="h-full bg-white transition-all"
                        style={{ width: `${Math.min(100, holding.portfolioPercent)}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
