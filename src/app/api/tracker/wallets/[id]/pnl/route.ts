import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { calculatePnl } from "@/lib/tracker/pnl"
import { getTokenPricesBatch } from "@/lib/tracker/enricher"
import type { TrackerChain, TrackerAnalytics } from "@/lib/tracker/types"

/** GET /api/tracker/wallets/:id/pnl — PnL analytics for a single wallet */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return apiError("T6001", "Authentication required", 401)

  const { id } = await params

  try {
    const wallet = await db.trackedWallet.findFirst({
      where: { id, userId: user.id },
    })

    if (!wallet) {
      return apiError("T6002", "Wallet not found", 404)
    }

    // Get all buy/sell trades sorted chronologically
    const trades = await db.trackerTx.findMany({
      where: {
        walletId: id,
        type: { in: ["BUY", "SELL"] },
        tokenAddress: { not: null },
      },
      orderBy: { blockTimestamp: "asc" },
    })

    if (trades.length === 0) {
      const empty: TrackerAnalytics = {
        totalPnl: 0,
        realizedPnl: 0,
        unrealizedPnl: 0,
        winRate: 0,
        totalTrades: 0,
        winningTrades: 0,
        avgHoldTimeSeconds: 0,
        portfolioHistory: [],
        tokenHoldings: [],
      }
      return NextResponse.json(empty)
    }

    // Build trade records for PnL calculation
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

    // Fetch current prices for held tokens
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

    const result: TrackerAnalytics = {
      totalPnl: pnl.realizedPnl + pnl.unrealizedPnl,
      realizedPnl: pnl.realizedPnl,
      unrealizedPnl: pnl.unrealizedPnl,
      winRate: pnl.winRate,
      totalTrades: pnl.tradeCount,
      winningTrades: pnl.winCount,
      avgHoldTimeSeconds: 0,
      portfolioHistory: [],
      tokenHoldings: [],
    }

    return NextResponse.json(result)
  } catch (error) {
    return apiError("T6003", "Failed to calculate PnL", 500, error)
  }
}
