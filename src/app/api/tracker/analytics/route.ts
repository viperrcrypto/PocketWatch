import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { calculatePnl } from "@/lib/tracker/pnl"
import { getTokenPricesBatch } from "@/lib/tracker/enricher"
import type { TrackerChain } from "@/lib/tracker/types"
import type { AnalyticsResponse } from "@/hooks/use-tracker"

/** GET /api/tracker/analytics — aggregate PnL across all (or one) wallet(s) */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("T8001", "Authentication required", 401)

  const { searchParams } = request.nextUrl
  const walletId = searchParams.get("walletId")

  try {
    // Get wallet IDs
    const wallets = await db.trackedWallet.findMany({
      where: {
        userId: user.id,
        ...(walletId ? { id: walletId } : {}),
      },
      select: { id: true },
    })

    const walletIds = wallets.map((w) => w.id)

    if (walletIds.length === 0) {
      const empty: AnalyticsResponse = {
        aggregate: {
          totalBuysUsd: 0, totalSellsUsd: 0, realizedPnl: 0, unrealizedPnl: 0,
          totalPnl: 0, tradeCount: 0, winCount: 0, winRate: null,
          tokensTraded: 0, tokenWinRate: 0, medianHoldTimeSeconds: 0,
        },
        wallets: [],
        tokenPositions: [],
        tokenHoldings: [],
      }
      return NextResponse.json(empty)
    }

    // Fetch all buy/sell transactions
    const trades = await db.trackerTx.findMany({
      where: {
        walletId: { in: walletIds },
        type: { in: ["BUY", "SELL"] },
        tokenAddress: { not: null },
      },
      orderBy: { blockTimestamp: "asc" },
    })

    // Build trade records
    const tradeRecords = trades
      .filter((t) => t.tokenAddress && t.amountFormatted)
      .map((t) => ({
        tokenAddress: t.tokenAddress!,
        chain: t.chain as TrackerChain,
        type: t.type as "BUY" | "SELL",
        amount: t.type === "BUY"
          ? (t.tokenOutAmount ?? t.amountFormatted ?? 0)
          : (t.tokenInAmount ?? t.amountFormatted ?? 0),
        valueUsd: t.valueUsd ?? 0,
        priceUsd: t.priceUsd ?? 0,
        timestamp: t.blockTimestamp,
      }))

    // Fetch current prices
    const uniqueTokens = [
      ...new Set(tradeRecords.map((t) => `${t.chain}:${t.tokenAddress}`)),
    ].map((key) => {
      const [chain, address] = key.split(":")
      return { chain: chain as TrackerChain, address }
    })

    const pricesMap = await getTokenPricesBatch(uniqueTokens)
    const currentPrices = new Map<string, number>()
    for (const [key, data] of pricesMap) {
      const address = key.split(":")[1]
      if (data.priceUsd) currentPrices.set(address, data.priceUsd)
    }

    const pnl = calculatePnl(tradeRecords, currentPrices)

    // Build token positions for the response
    const tokenPositions = pnl.positions.map((pos) => ({
      tokenAddress: pos.tokenAddress,
      tokenSymbol: "",
      tokenName: null as string | null,
      chain: pos.chain,
      logoUrl: null as string | null,
      realizedPnl: pos.realizedPnl,
      realizedRoi: pos.totalBuyUsd > 0 ? (pos.realizedPnl / pos.totalBuyUsd) * 100 : 0,
      unrealizedPnl: 0,
      unrealizedRoi: 0,
      totalBoughtUsd: pos.totalBuyUsd,
      totalBoughtAmount: pos.totalBought,
      avgBuyPrice: pos.avgBuyPrice,
      totalSoldUsd: pos.totalSellUsd,
      totalSoldAmount: pos.totalSold,
      avgSellPrice: pos.totalSold > 0 ? pos.totalSellUsd / pos.totalSold : 0,
      holdingAmount: pos.currentHolding,
      holdingValueUsd: pos.currentHolding * (currentPrices.get(pos.tokenAddress) ?? 0),
      firstTradeAt: "",
      lastTradeAt: "",
      buyCount: 0,
      sellCount: pos.trades,
      tradeCount: pos.trades,
      holdTimeSeconds: 0,
    }))

    // Build holdings
    const totalHoldingsValue = tokenPositions.reduce((s, p) => s + p.holdingValueUsd, 0)
    const tokenHoldings = tokenPositions
      .filter((p) => p.holdingAmount > 0.0001)
      .map((p) => ({
        tokenAddress: p.tokenAddress,
        tokenSymbol: p.tokenSymbol,
        chain: p.chain,
        amount: p.holdingAmount,
        valueUsd: p.holdingValueUsd,
        pnl: p.realizedPnl,
        portfolioPercent: totalHoldingsValue > 0 ? (p.holdingValueUsd / totalHoldingsValue) * 100 : 0,
      }))

    const result: AnalyticsResponse = {
      aggregate: {
        totalBuysUsd: pnl.totalBuysUsd,
        totalSellsUsd: pnl.totalSellsUsd,
        realizedPnl: pnl.realizedPnl,
        unrealizedPnl: pnl.unrealizedPnl,
        totalPnl: pnl.realizedPnl + pnl.unrealizedPnl,
        tradeCount: pnl.tradeCount,
        winCount: pnl.winCount,
        winRate: pnl.tradeCount > 0 ? pnl.winRate : null,
        tokensTraded: pnl.positions.length,
        tokenWinRate: 0,
        medianHoldTimeSeconds: 0,
      },
      wallets: [],
      tokenPositions,
      tokenHoldings,
    }

    return NextResponse.json(result)
  } catch (error) {
    return apiError("T8002", "Failed to load analytics", 500, error)
  }
}
