"use client"

import { useQuery } from "@tanstack/react-query"
import type { TrackerAnalytics } from "@/lib/tracker/types"
import { trackerFetch, trackerKeys } from "./shared"

// ─── Types ───

export type TokenPositionData = {
  tokenAddress: string
  tokenSymbol: string
  tokenName: string | null
  chain: string
  logoUrl: string | null
  realizedPnl: number
  realizedRoi: number
  unrealizedPnl: number
  unrealizedRoi: number
  totalBoughtUsd: number
  totalBoughtAmount: number
  avgBuyPrice: number
  totalSoldUsd: number
  totalSoldAmount: number
  avgSellPrice: number
  holdingAmount: number
  holdingValueUsd: number
  firstTradeAt: string
  lastTradeAt: string
  buyCount: number
  sellCount: number
  tradeCount: number
  holdTimeSeconds: number
}

export type AnalyticsAggregate = {
  totalBuysUsd: number
  totalSellsUsd: number
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  tradeCount: number
  winCount: number
  winRate: number | null
  tokensTraded: number
  tokenWinRate: number
  medianHoldTimeSeconds: number
}

export type AnalyticsResponse = {
  aggregate: AnalyticsAggregate
  wallets: unknown[]
  tokenPositions: TokenPositionData[]
  tokenHoldings: Array<{
    tokenAddress: string
    tokenSymbol: string
    chain: string
    amount: number
    valueUsd: number
    pnl: number
    portfolioPercent: number
  }>
}

// ─── Hooks ───

export function useTrackerAnalytics(walletId?: string, period?: string, enabled = true) {
  const params = new URLSearchParams()
  if (walletId) params.set("walletId", walletId)
  if (period && period !== "all") params.set("period", period)
  const qs = params.toString() ? `?${params.toString()}` : ""

  return useQuery({
    queryKey: [...trackerKeys.analytics(walletId), period ?? "all"],
    queryFn: () => trackerFetch<AnalyticsResponse>(`/analytics${qs}`),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useWalletPnl(walletId: string) {
  return useQuery({
    queryKey: trackerKeys.walletPnl(walletId),
    queryFn: () => trackerFetch<TrackerAnalytics>(`/wallets/${walletId}/pnl`),
    enabled: !!walletId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useWalletCodexStats(walletId: string, includeChart = false) {
  return useQuery({
    queryKey: trackerKeys.codexStats(walletId),
    queryFn: () =>
      trackerFetch<{
        wallet: { id: string; address: string; label: string | null; chain: string }
        stats: {
          labels: string[]
          botScore: number | null
          scammerScore: number | null
          lastTransactionAt: number
          walletAge: number | null
          firstFunding: unknown
          networkBreakdown?: Array<{
            networkId: number
            nativeTokenBalance: string
            statsDay1?: unknown
            statsWeek1?: unknown
            statsDay30?: unknown
            statsYear1?: unknown
          }>
        } | null
        chart?: {
          resolution: string
          range: { start: number; end: number }
          data: Array<{
            timestamp: number
            volumeUsd: string
            realizedProfitUsd: string
            swaps: number
          }>
        }
      }>(`/wallets/${walletId}/codex-stats${includeChart ? "?chart=true" : ""}`),
    enabled: !!walletId,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  })
}
