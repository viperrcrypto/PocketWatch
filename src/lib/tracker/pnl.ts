// PnL (Profit & Loss) calculation engine for the Wallet Tracker.
// Uses FIFO (First In, First Out) cost basis tracking.

import type { TrackerChain } from "./types"

interface TradeRecord {
  tokenAddress: string
  chain: TrackerChain
  type: "BUY" | "SELL"
  amount: number
  valueUsd: number
  priceUsd: number
  timestamp: Date
}

interface TokenPosition {
  tokenAddress: string
  chain: TrackerChain
  totalBought: number
  totalSold: number
  totalBuyUsd: number
  totalSellUsd: number
  currentHolding: number
  avgBuyPrice: number
  realizedPnl: number
  trades: number
  wins: number
}

export interface PnlResult {
  totalBuysUsd: number
  totalSellsUsd: number
  realizedPnl: number
  unrealizedPnl: number
  winRate: number
  tradeCount: number
  winCount: number
  positions: TokenPosition[]
}

/**
 * Calculate PnL for a set of trades using FIFO cost basis.
 * @param trades - Array of buy/sell trade records, sorted chronologically
 * @param currentPrices - Map of tokenAddress -> current USD price
 */
export function calculatePnl(
  trades: TradeRecord[],
  currentPrices: Map<string, number>
): PnlResult {
  // Group trades by token
  const positions = new Map<string, TokenPosition>()

  // FIFO cost basis queue per token: Array of { amount, priceUsd }
  const costBasis = new Map<string, { amount: number; priceUsd: number }[]>()

  let totalBuysUsd = 0
  let totalSellsUsd = 0
  let totalRealizedPnl = 0
  let totalTrades = 0
  let totalWins = 0

  for (const trade of trades) {
    const key = `${trade.chain}:${trade.tokenAddress}`

    if (!positions.has(key)) {
      positions.set(key, {
        tokenAddress: trade.tokenAddress,
        chain: trade.chain,
        totalBought: 0,
        totalSold: 0,
        totalBuyUsd: 0,
        totalSellUsd: 0,
        currentHolding: 0,
        avgBuyPrice: 0,
        realizedPnl: 0,
        trades: 0,
        wins: 0,
      })
      costBasis.set(key, [])
    }

    const pos = positions.get(key)!
    const queue = costBasis.get(key)!

    if (trade.type === "BUY") {
      pos.totalBought += trade.amount
      pos.totalBuyUsd += trade.valueUsd
      pos.currentHolding += trade.amount
      totalBuysUsd += trade.valueUsd

      // Add to FIFO queue
      queue.push({ amount: trade.amount, priceUsd: trade.priceUsd })

      // Update average buy price
      if (pos.totalBought > 0) {
        pos.avgBuyPrice = pos.totalBuyUsd / pos.totalBought
      }
    } else if (trade.type === "SELL") {
      pos.totalSold += trade.amount
      pos.totalSellUsd += trade.valueUsd
      pos.currentHolding = Math.max(0, pos.currentHolding - trade.amount)
      totalSellsUsd += trade.valueUsd
      pos.trades++
      totalTrades++

      // FIFO cost basis calculation
      let remainingToSell = trade.amount
      let costBasisForSale = 0

      while (remainingToSell > 0 && queue.length > 0) {
        const oldest = queue[0]
        const consumed = Math.min(remainingToSell, oldest.amount)

        costBasisForSale += consumed * oldest.priceUsd
        remainingToSell -= consumed

        const EPSILON = 1e-10
        const remaining = oldest.amount - consumed
        if (remaining <= EPSILON) {
          queue.shift()
        } else {
          queue[0] = { ...oldest, amount: remaining }
        }
      }

      // If we sold more than our tracked buys (e.g. transfers in not captured),
      // use the sell price as imputed cost basis for the excess to avoid
      // inflating realized PnL with zero-cost phantom gains.
      if (remainingToSell > 0 && trade.amount > 0) {
        const sellPricePerUnit = trade.valueUsd / trade.amount
        costBasisForSale += remainingToSell * sellPricePerUnit
      }

      const realizedPnlForTrade = trade.valueUsd - costBasisForSale
      pos.realizedPnl += realizedPnlForTrade
      totalRealizedPnl += realizedPnlForTrade

      if (realizedPnlForTrade > 0) {
        pos.wins++
        totalWins++
      }
    }
  }

  // Calculate unrealized PnL
  let totalUnrealizedPnl = 0
  for (const [key, pos] of positions) {
    if (pos.currentHolding > 0) {
      const currentPrice = currentPrices.get(pos.tokenAddress) ?? 0
      const currentValue = pos.currentHolding * currentPrice

      // Remaining cost basis from queue
      const queue = costBasis.get(key) ?? []
      const remainingCost = queue.reduce((sum, lot) => sum + lot.amount * lot.priceUsd, 0)

      totalUnrealizedPnl += currentValue - remainingCost
    }
  }

  return {
    totalBuysUsd,
    totalSellsUsd,
    realizedPnl: totalRealizedPnl,
    unrealizedPnl: totalUnrealizedPnl,
    winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
    tradeCount: totalTrades,
    winCount: totalWins,
    positions: Array.from(positions.values()),
  }
}
