/**
 * Exchange balance fetching and USD price estimation.
 */

import type { Exchange } from "ccxt"
import { getExchangeById } from "./exchanges"
import { withProviderPermit } from "./provider-governor"
import {
  createExchange,
  EXCHANGE_PRICE_CACHE_TTL_MS,
  exchangePriceCache,
} from "./exchange-types"
import type {
  ExchangeCredentials,
  ExchangeBalance,
  ExchangeSummary,
  AllExchangeBalancesResult,
} from "./exchange-types"

/** Fetch spot balances from a single exchange + estimate USD values */
export async function fetchExchangeBalances(
  exchangeId: string,
  credentials: ExchangeCredentials,
  userId?: string
): Promise<{ balances: ExchangeBalance[]; summary: ExchangeSummary }> {
  const def = getExchangeById(exchangeId)
  if (!def) throw new Error(`Unknown exchange: ${exchangeId}`)

  const exchange = createExchange(def.ccxtId, credentials)

  // Fetch spot balance
  const balance = userId
    ? await withProviderPermit(userId, "ccxt", `balance:${exchangeId}`, undefined, () => exchange.fetchBalance())
    : await exchange.fetchBalance()

  // Collect non-zero balances
  const nonZeroAssets: { asset: string; total: number; free: number; used: number }[] = []
  const total = (balance.total || {}) as unknown as Record<string, number | string>
  const free = (balance.free || {}) as unknown as Record<string, number | string>
  const used = (balance.used || {}) as unknown as Record<string, number | string>

  for (const [asset, amount] of Object.entries(total)) {
    const numAmount = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0
    if (numAmount > 0.000001) {
      nonZeroAssets.push({
        asset,
        total: numAmount,
        free: parseFloat(String(free[asset] ?? 0)) || 0,
        used: parseFloat(String(used[asset] ?? 0)) || 0,
      })
    }
  }

  // Estimate USD values via tickers
  const usdPrices = await estimateUsdPrices(exchange, exchangeId, nonZeroAssets.map((a) => a.asset), userId)

  const balances: ExchangeBalance[] = nonZeroAssets.map((a) => ({
    exchange: exchangeId,
    exchangeLabel: def.label,
    asset: a.asset,
    amount: a.total,
    free: a.free,
    used: a.used,
    usd_value: a.total * (usdPrices[a.asset] || 0),
  }))

  const totalValue = balances.reduce((sum, b) => sum + b.usd_value, 0)

  return {
    balances,
    summary: {
      id: exchangeId,
      label: def.label,
      totalValue,
      assetCount: balances.length,
      fetchedAt: new Date().toISOString(),
    },
  }
}

/** Estimate USD prices for a list of assets using USDT tickers */
async function estimateUsdPrices(
  exchange: Exchange,
  exchangeId: string,
  assets: string[],
  userId?: string
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}
  const cacheKey = `${exchangeId}:${assets.slice().sort((a, b) => a.localeCompare(b)).join(",")}`
  const cached = exchangePriceCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.prices
  }

  // Stablecoins are ~$1
  const stablecoins = new Set(["USDT", "USDC", "BUSD", "DAI", "TUSD", "USDP", "FDUSD", "PYUSD", "USD"])
  for (const asset of assets) {
    if (stablecoins.has(asset)) {
      prices[asset] = 1
    }
  }

  // Build list of tickers to fetch
  const tickersNeeded: string[] = []
  for (const asset of assets) {
    if (prices[asset] != null) continue
    tickersNeeded.push(`${asset}/USDT`)
  }

  if (tickersNeeded.length === 0) return prices

  // Fetch tickers in batch if the exchange supports it, otherwise one-by-one
  try {
    if (exchange.has.fetchTickers) {
      const tickers = userId
        ? await withProviderPermit(
            userId,
            "ccxt",
            `tickers:${exchangeId}:${tickersNeeded.join(",")}`,
            undefined,
            () => exchange.fetchTickers(tickersNeeded)
          )
        : await exchange.fetchTickers(tickersNeeded)
      for (const [symbol, ticker] of Object.entries(tickers)) {
        const asset = symbol.split("/")[0]
        const price = ticker.last ?? ticker.close ?? 0
        if (price > 0) prices[asset] = price
      }
    } else {
      // Fallback: fetch individual tickers (rate-limited by ccxt)
      for (const symbol of tickersNeeded) {
        try {
          const ticker = userId
            ? await withProviderPermit(userId, "ccxt", `ticker:${exchangeId}:${symbol}`, undefined, () => exchange.fetchTicker(symbol))
            : await exchange.fetchTicker(symbol)
          const asset = symbol.split("/")[0]
          const price = ticker.last ?? ticker.close ?? 0
          if (price > 0) prices[asset] = price
        } catch {
          // Ticker not available — skip
        }
      }
    }
  } catch {
    // If batch ticker fetch fails, try BTC as intermediary
    try {
      const btcTicker = userId
        ? await withProviderPermit(userId, "ccxt", `ticker:${exchangeId}:BTC/USDT`, undefined, () => exchange.fetchTicker("BTC/USDT"))
        : await exchange.fetchTicker("BTC/USDT")
      const btcPrice = btcTicker.last ?? btcTicker.close ?? 0
      if (btcPrice > 0) {
        prices.BTC = btcPrice
        for (const asset of assets) {
          if (prices[asset] != null) continue
          try {
            const symbol = `${asset}/BTC`
            const ticker = userId
              ? await withProviderPermit(userId, "ccxt", `ticker:${exchangeId}:${symbol}`, undefined, () => exchange.fetchTicker(symbol))
              : await exchange.fetchTicker(symbol)
            const btcVal = ticker.last ?? ticker.close ?? 0
            if (btcVal > 0) prices[asset] = btcVal * btcPrice
          } catch {
            // Skip
          }
        }
      }
    } catch {
      // Can't price assets — they'll show $0
    }
  }

  exchangePriceCache.set(cacheKey, {
    prices,
    expiresAt: Date.now() + EXCHANGE_PRICE_CACHE_TTL_MS,
  })

  return prices
}

/** Fetch balances from all connected exchanges in parallel */
export async function fetchAllExchangeBalances(
  exchangeCredentials: { exchangeId: string; credentials: ExchangeCredentials }[],
  userId?: string
): Promise<AllExchangeBalancesResult> {
  if (exchangeCredentials.length === 0) {
    return { balances: [], exchanges: [], totalValue: 0 }
  }

  const results = await Promise.allSettled(
    exchangeCredentials.map(({ exchangeId, credentials }) =>
      fetchExchangeBalances(exchangeId, credentials, userId)
    )
  )

  const allBalances: ExchangeBalance[] = []
  const allSummaries: ExchangeSummary[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const exchangeId = exchangeCredentials[i].exchangeId
    const def = getExchangeById(exchangeId)

    if (result.status === "fulfilled") {
      allBalances.push(...result.value.balances)
      allSummaries.push(result.value.summary)
    } else {
      console.error(`[exchange-client] Failed to fetch ${exchangeId}:`, result.reason)
      allSummaries.push({
        id: exchangeId,
        label: def?.label || exchangeId,
        totalValue: 0,
        assetCount: 0,
        error: result.reason instanceof Error ? result.reason.message : "Unknown error",
        fetchedAt: new Date().toISOString(),
      })
    }
  }

  const totalValue = allBalances.reduce((sum, b) => sum + b.usd_value, 0)

  return { balances: allBalances, exchanges: allSummaries, totalValue }
}
