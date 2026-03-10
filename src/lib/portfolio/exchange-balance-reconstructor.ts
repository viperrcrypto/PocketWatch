/**
 * Reconstructs historical exchange balance from exchange transactions.
 * Walks backward from the current known exchange balance through deposits
 * and withdrawals to estimate the balance at each past date.
 *
 * Uses DeFiLlama historical prices when available, falling back to
 * approximate prices. Stablecoins are valued at $1.
 */

import { db } from "@/lib/db"
import { getHistoricalPrices } from "@/lib/defillama/prices"

const DAY_SEC = 86400

const STABLECOINS = new Set(["USDC", "USDT", "BUSD", "DAI", "PYUSD", "FDUSD", "TUSD", "USD"])

// Fallback prices when DeFiLlama is unavailable
const APPROX_PRICES: Record<string, number> = {
  ETH: 2500, BTC: 85000, SOL: 85, MOVE: 0.50, MON: 1.0,
  AVAX: 9, LINK: 9, DOT: 1.5, ADA: 0.26, XRP: 1.4,
  BNB: 640, DOGE: 0.10, MATIC: 0.35, ARB: 0.35,
}

// CoinGecko IDs for DeFiLlama price lookups
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  ETH: "coingecko:ethereum", BTC: "coingecko:bitcoin", SOL: "coingecko:solana",
  BNB: "coingecko:binancecoin", AVAX: "coingecko:avalanche-2", LINK: "coingecko:chainlink",
  DOT: "coingecko:polkadot", ADA: "coingecko:cardano", XRP: "coingecko:ripple",
  DOGE: "coingecko:dogecoin", MATIC: "coingecko:matic-network", ARB: "coingecko:arbitrum",
  MOVE: "coingecko:movement", MON: "coingecko:monad",
}

/**
 * Fetch historical prices for exchange currencies at specific timestamps.
 * Returns a map of "SYMBOL:day" → USD price.
 */
async function fetchHistoricalPricesForTransactions(
  transactions: Array<{ timestamp: number; currency: string }>,
): Promise<Map<string, number>> {
  const priceCache = new Map<string, number>()
  const needed = new Map<number, Set<string>>() // day → Set<coingecko_id>
  const symbolByDay = new Map<string, string>() // "SYMBOL:day" → coingecko_id

  for (const tx of transactions) {
    const symbol = tx.currency.toUpperCase()
    if (STABLECOINS.has(symbol)) continue
    const cgId = SYMBOL_TO_COINGECKO[symbol]
    if (!cgId) continue

    const day = Math.floor(tx.timestamp / DAY_SEC)
    const key = `${symbol}:${day}`
    if (symbolByDay.has(key)) continue

    symbolByDay.set(key, cgId)
    const daySet = needed.get(day) ?? new Set()
    daySet.add(cgId)
    needed.set(day, daySet)
  }

  // Batch by unique day timestamps (DeFiLlama accepts one timestamp per call)
  // Limit to 50 API calls to avoid excessive requests
  const dayEntries = Array.from(needed.entries()).slice(0, 50)

  const results = await Promise.allSettled(
    dayEntries.map(async ([day, cgIds]) => {
      const timestamp = day * DAY_SEC + DAY_SEC / 2 // midday
      const tokens = Array.from(cgIds).map((id) => {
        const [chain, address] = id.split(":")
        return { chain, address }
      })
      const resp = await getHistoricalPrices(timestamp, tokens)
      return { day, resp }
    })
  )

  for (const result of results) {
    if (result.status !== "fulfilled") continue
    const { day, resp } = result.value
    for (const [key, data] of Object.entries(resp.coins)) {
      if (data?.price && data.price > 0) {
        // Find which symbols map to this coingecko ID
        for (const [symDay, cgId] of symbolByDay.entries()) {
          if (cgId === key && symDay.endsWith(`:${day}`)) {
            priceCache.set(symDay, data.price)
          }
        }
      }
    }
  }

  return priceCache
}

function estimateUsdValue(
  currency: string,
  amount: number,
  timestamp: number,
  historicalPrices: Map<string, number>,
): number {
  const symbol = currency.toUpperCase()
  if (STABLECOINS.has(symbol)) return amount

  // Try historical price first
  const day = Math.floor(timestamp / DAY_SEC)
  const historicalKey = `${symbol}:${day}`
  const historicalPrice = historicalPrices.get(historicalKey)
  if (historicalPrice && historicalPrice > 0) return amount * historicalPrice

  // Fall back to approximate current prices
  const approxPrice = APPROX_PRICES[symbol]
  if (approxPrice) return amount * approxPrice

  return 0
}

export async function reconstructExchangeBalanceHistory(userId: string): Promise<number> {
  // Check if reconstruction is needed by comparing transaction count
  // (not timestamps — timestamps can be semantically mismatched between
  // ExchangeTransactionCache.timestamp and ExchangeBalanceSnapshot.createdAt)
  const [snapshotCount, transactionCount, earliestSnapshot, earliestTransaction] = await Promise.all([
    db.exchangeBalanceSnapshot.count({ where: { userId } }),
    db.exchangeTransactionCache.count({ where: { userId } }),
    db.exchangeBalanceSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.exchangeTransactionCache.findFirst({
      where: { userId },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    }),
  ])

  // Skip if we already have snapshots covering the full transaction range
  if (snapshotCount > 0 && transactionCount > 0 && earliestSnapshot && earliestTransaction) {
    const earliestSnapshotTs = Math.floor(earliestSnapshot.createdAt.getTime() / 1000)
    const earliestTxTs = earliestTransaction.timestamp
    // If snapshots already cover from before the earliest transaction, and
    // transaction count hasn't changed, skip reconstruction
    if (earliestSnapshotTs <= earliestTxTs + DAY_SEC) {
      // Quick check: has the transaction count changed since last reconstruction?
      // Use snapshot count as a rough proxy — if close to tx day count, no rebuild needed
      const txDaySpan = Math.max(1, Math.ceil(
        (Date.now() / 1000 - earliestTxTs) / DAY_SEC
      ))
      if (snapshotCount >= Math.floor(txDaySpan * 0.8)) {
        return snapshotCount
      }
    }
  }

  // Get current exchange balance from recent live_refresh snapshots.
  const recentSnapshots = await db.portfolioSnapshot.findMany({
    where: { userId, source: "live_refresh" },
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  let currentExchangeBalance = 0
  let latestLiveSnapshot: typeof recentSnapshots[0] | null = null

  for (const snapshot of recentSnapshots) {
    if (!snapshot.metadata) continue
    const meta = typeof snapshot.metadata === "string"
      ? (() => { try { return JSON.parse(snapshot.metadata as string) } catch { return null } })()
      : typeof snapshot.metadata === "object" ? snapshot.metadata : null
    if (!meta) continue

    const exchangeVal = typeof (meta as Record<string, unknown>).exchangeTotalValue === "number"
      ? (meta as Record<string, unknown>).exchangeTotalValue as number
      : (() => {
          const onchain = typeof (meta as Record<string, unknown>).onchainTotalValue === "number"
            ? (meta as Record<string, unknown>).onchainTotalValue as number : 0
          return onchain > 0 ? snapshot.totalValue - onchain : 0
        })()

    if (exchangeVal > 0) {
      currentExchangeBalance = exchangeVal
      latestLiveSnapshot = snapshot
      break
    }
  }

  if (currentExchangeBalance <= 0 || !latestLiveSnapshot) return 0

  // Get all exchange transactions sorted by timestamp descending (newest first)
  const transactions = await db.exchangeTransactionCache.findMany({
    where: { userId },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true, type: true, currency: true, amount: true },
  })

  if (transactions.length === 0) return 0

  // Fetch historical prices for non-stablecoin transactions
  const historicalPrices = await fetchHistoricalPricesForTransactions(transactions)
    .catch((err) => {
      console.warn("[exchange-reconstructor] Historical price fetch failed, using approx:", err)
      return new Map<string, number>()
    })

  // Walk backward from current balance
  const latestTs = Math.floor(latestLiveSnapshot.createdAt.getTime() / 1000)
  let runningBalance = currentExchangeBalance
  let hadNegativeBalance = false

  const dailyBalances = new Map<number, number>()
  const currentDay = Math.floor(latestTs / DAY_SEC)
  dailyBalances.set(currentDay, runningBalance)

  for (const tx of transactions) {
    const usdValue = estimateUsdValue(tx.currency, tx.amount, tx.timestamp, historicalPrices)
    if (usdValue <= 0) continue

    // Walking BACKWARD: undo the effect of each transaction
    if (tx.type === "deposit") {
      runningBalance -= usdValue
    } else if (tx.type === "withdrawal") {
      runningBalance += usdValue
    }

    // Track negative balance but don't clip during walk
    if (runningBalance < 0) hadNegativeBalance = true

    const day = Math.floor(tx.timestamp / DAY_SEC)
    dailyBalances.set(day, runningBalance)
  }

  if (hadNegativeBalance) {
    console.warn(`[exchange-reconstructor] Negative balance detected for user ${userId} — price estimates may be inaccurate`)
  }

  // Convert to sorted array — clip to 0 only at output
  const entries = Array.from(dailyBalances.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, value]) => ({
      userId,
      totalValue: Math.max(0, value),
      createdAt: new Date(day * DAY_SEC * 1000),
    }))
    .filter((e) => Number.isFinite(e.totalValue))

  if (entries.length === 0) return 0

  // Delete existing and bulk insert in a transaction
  const BATCH = 500
  await db.$transaction(async (tx) => {
    await tx.exchangeBalanceSnapshot.deleteMany({ where: { userId } })
    for (let i = 0; i < entries.length; i += BATCH) {
      await tx.exchangeBalanceSnapshot.createMany({
        data: entries.slice(i, i + BATCH),
        skipDuplicates: true,
      })
    }
  })

  console.info(`[exchange-reconstructor] Inserted ${entries.length} exchange balance snapshots for user ${userId}`)
  return entries.length
}
