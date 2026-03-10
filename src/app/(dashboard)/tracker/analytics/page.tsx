"use client"

import { useState } from "react"
import {
  useTrackerAnalytics,
  useTrackerWallets,
  type AnalyticsResponse,
  type TokenPositionData,
} from "@/hooks/use-tracker"
import PnlOverview from "@/components/tracker/analytics/pnl-overview"
import TokenHoldings from "@/components/tracker/analytics/token-holdings"
import { formatUsd } from "@/lib/tracker/classifier"
import type { TrackerAnalytics, TokenHolding, TrackerChain } from "@/lib/tracker/types"

/** Convert the analytics aggregate to the shape PnlOverview expects */
function toTrackerAnalytics(data: AnalyticsResponse): TrackerAnalytics {
  return {
    totalPnl: data.aggregate.totalPnl,
    realizedPnl: data.aggregate.realizedPnl,
    unrealizedPnl: data.aggregate.unrealizedPnl,
    winRate: data.aggregate.winRate ?? 0,
    totalTrades: data.aggregate.tradeCount,
    winningTrades: data.aggregate.winCount,
    avgHoldTimeSeconds: data.aggregate.medianHoldTimeSeconds,
    portfolioHistory: [],
    tokenHoldings: data.tokenHoldings.map((h) => ({
      ...h,
      chain: h.chain as TrackerChain,
    })),
  }
}

function PositionsTable({ positions }: { positions: TokenPositionData[] }) {
  if (positions.length === 0) return null

  const sorted = [...positions].sort(
    (a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl)
  )

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border bg-background-secondary">
        <h3 className="text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
          Token Positions
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left px-4 py-2 text-[10px] font-mono text-foreground-muted uppercase tracking-widest">Token</th>
              <th className="text-right px-4 py-2 text-[10px] font-mono text-foreground-muted uppercase tracking-widest">Bought</th>
              <th className="text-right px-4 py-2 text-[10px] font-mono text-foreground-muted uppercase tracking-widest">Sold</th>
              <th className="text-right px-4 py-2 text-[10px] font-mono text-foreground-muted uppercase tracking-widest">Holding</th>
              <th className="text-right px-4 py-2 text-[10px] font-mono text-foreground-muted uppercase tracking-widest">Realized PnL</th>
              <th className="text-right px-4 py-2 text-[10px] font-mono text-foreground-muted uppercase tracking-widest">ROI</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((pos) => {
              const pnlColor = pos.realizedPnl > 0
                ? "var(--success)"
                : pos.realizedPnl < 0
                  ? "var(--error)"
                  : "var(--foreground-muted)"

              return (
                <tr
                  key={`${pos.chain}:${pos.tokenAddress}`}
                  className="border-b border-card-border last:border-b-0 table-row-hover transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-foreground">
                      {pos.tokenSymbol || pos.tokenAddress.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono tabular-nums text-foreground">
                      {formatUsd(pos.totalBoughtUsd)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono tabular-nums text-foreground">
                      {formatUsd(pos.totalSoldUsd)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono tabular-nums text-foreground">
                      {formatUsd(pos.holdingValueUsd)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono tabular-nums" style={{ color: pnlColor }}>
                      {pos.realizedPnl > 0 ? "+" : ""}{formatUsd(pos.realizedPnl)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono tabular-nums" style={{ color: pnlColor }}>
                      {pos.realizedRoi > 0 ? "+" : ""}{pos.realizedRoi.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function TrackerAnalyticsPage() {
  const [selectedWallet, setSelectedWallet] = useState<string | undefined>()
  const { data: walletsData } = useTrackerWallets()
  const { data, isLoading } = useTrackerAnalytics(selectedWallet)

  const wallets = walletsData?.wallets ?? []
  const analytics = data ? toTrackerAnalytics(data) : null
  const holdings: TokenHolding[] = data?.tokenHoldings?.map((h) => ({
    ...h,
    chain: h.chain as TrackerChain,
    tokenName: undefined,
  })) ?? []

  return (
    <div className="space-y-6">
      {/* Header + wallet filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-foreground-muted mt-0.5">
            PnL breakdown across your tracked wallets
          </p>
        </div>
        {wallets.length > 1 && (
          <select
            value={selectedWallet ?? ""}
            onChange={(e) => setSelectedWallet(e.target.value || undefined)}
            className="h-9 px-3 text-sm bg-background border border-card-border text-foreground
              font-mono focus:border-foreground transition-colors"
            style={{ borderRadius: 0 }}
          >
            <option value="">All Wallets</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label || w.address.slice(0, 10)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* PnL Overview Cards */}
      <PnlOverview analytics={analytics} isLoading={isLoading} />

      {/* Token Positions Table */}
      {data?.tokenPositions && data.tokenPositions.length > 0 && (
        <PositionsTable positions={data.tokenPositions} />
      )}

      {/* Current Holdings */}
      <div>
        <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider mb-3">
          Current Holdings
        </h2>
        <TokenHoldings holdings={holdings} isLoading={isLoading} />
      </div>
    </div>
  )
}
