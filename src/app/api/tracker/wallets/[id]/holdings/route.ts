import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { getTokenPricesBatch } from "@/lib/tracker/enricher"
import type { TrackerChain, TokenHolding } from "@/lib/tracker/types"

/** GET /api/tracker/wallets/:id/holdings — current token holdings for a wallet */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return apiError("T5001", "Authentication required", 401)

  const { id } = await params

  try {
    const wallet = await db.trackedWallet.findFirst({
      where: { id, userId: user.id },
      select: { id: true, primaryChain: true },
    })

    if (!wallet) {
      return apiError("T5002", "Wallet not found", 404)
    }

    // Get all buy/sell transactions grouped by token
    const txs = await db.trackerTx.findMany({
      where: {
        walletId: id,
        type: { in: ["BUY", "SELL"] },
        tokenAddress: { not: null },
      },
      orderBy: { blockTimestamp: "asc" },
      select: {
        type: true,
        chain: true,
        tokenAddress: true,
        tokenSymbol: true,
        tokenName: true,
        amountFormatted: true,
        tokenInAmount: true,
        tokenOutAmount: true,
        tokenInSymbol: true,
        tokenOutSymbol: true,
      },
    })

    // Calculate holdings per token
    const holdingMap = new Map<string, {
      tokenAddress: string
      tokenSymbol: string
      tokenName: string | null
      chain: TrackerChain
      bought: number
      sold: number
      totalBuyUsd: number
    }>()

    for (const tx of txs) {
      // Determine the traded token address and amount
      let tokenAddr: string
      let tokenSym: string
      let amount: number

      if (tx.type === "BUY") {
        tokenAddr = tx.tokenAddress!
        tokenSym = tx.tokenOutSymbol ?? tx.tokenSymbol ?? "???"
        amount = tx.tokenOutAmount ?? tx.amountFormatted ?? 0
      } else {
        tokenAddr = tx.tokenAddress!
        tokenSym = tx.tokenInSymbol ?? tx.tokenSymbol ?? "???"
        amount = tx.tokenInAmount ?? tx.amountFormatted ?? 0
      }

      const key = `${tx.chain}:${tokenAddr}`
      const existing = holdingMap.get(key) ?? {
        tokenAddress: tokenAddr,
        tokenSymbol: tokenSym,
        tokenName: tx.tokenName,
        chain: tx.chain as TrackerChain,
        bought: 0,
        sold: 0,
        totalBuyUsd: 0,
      }

      if (tx.type === "BUY") {
        existing.bought += amount
      } else {
        existing.sold += amount
      }

      holdingMap.set(key, existing)
    }

    // Filter to tokens with positive holdings
    const activeHoldings = Array.from(holdingMap.values())
      .filter((h) => h.bought - h.sold > 0.0001)

    if (activeHoldings.length === 0) {
      return NextResponse.json({ holdings: [] })
    }

    // Fetch current prices
    const priceTokens = activeHoldings.map((h) => ({
      chain: h.chain,
      address: h.tokenAddress,
    }))
    const prices = await getTokenPricesBatch(priceTokens)

    // Build holdings with current values
    let totalValue = 0
    const holdingsWithValue = activeHoldings.map((h) => {
      const holdingAmount = h.bought - h.sold
      const priceData = prices.get(`${h.chain}:${h.tokenAddress}`)
      const currentPrice = priceData?.priceUsd ?? 0
      const valueUsd = holdingAmount * currentPrice
      totalValue += valueUsd
      return { ...h, holdingAmount, valueUsd, currentPrice }
    })

    const holdings: TokenHolding[] = holdingsWithValue
      .sort((a, b) => b.valueUsd - a.valueUsd)
      .map((h) => ({
        tokenAddress: h.tokenAddress,
        tokenSymbol: h.tokenSymbol,
        tokenName: h.tokenName ?? undefined,
        chain: h.chain,
        amount: h.holdingAmount,
        valueUsd: h.valueUsd,
        pnl: 0, // PnL calculated in analytics endpoint
        portfolioPercent: totalValue > 0 ? (h.valueUsd / totalValue) * 100 : 0,
      }))

    return NextResponse.json({ holdings })
  } catch (error) {
    return apiError("T5003", "Failed to load holdings", 500, error)
  }
}
