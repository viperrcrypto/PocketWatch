/**
 * CoinGecko historical price fetcher (fallback provider).
 */

import { COINGECKO_PLATFORM_BY_CHAIN } from "./price-symbol-utils"

const COINGECKO_TIMEOUT_MS = 10_000

/**
 * Fetch historical price from CoinGecko as a fallback.
 * Uses the contract address endpoint. Requires a Pro API key for reasonable rate limits.
 */
export async function fetchCoinGeckoHistoricalPrice(
  chain: string,
  contractAddress: string,
  timestamp: number,
  apiKey: string | null,
): Promise<number | null> {
  const platform = COINGECKO_PLATFORM_BY_CHAIN[chain]
  if (!platform || !contractAddress) return null

  const baseUrl = apiKey
    ? "https://pro-api.coingecko.com/api/v3"
    : "https://api.coingecko.com/api/v3"

  // Fetch a 2-hour window around the target timestamp
  const from = timestamp - 3600
  const to = timestamp + 3600
  const url = `${baseUrl}/coins/${platform}/contract/${contractAddress.toLowerCase()}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`

  try {
    const headers: Record<string, string> = { Accept: "application/json" }
    if (apiKey) headers["x-cg-pro-api-key"] = apiKey

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(COINGECKO_TIMEOUT_MS),
    })

    if (!res.ok) return null

    const data = await res.json()
    const prices: [number, number][] = data.prices ?? []
    if (prices.length === 0) return null

    // Find the price point closest to target timestamp (prices are [ms, usd])
    const targetMs = timestamp * 1000
    let closest = prices[0]
    let minDist = Math.abs(prices[0][0] - targetMs)
    for (let i = 1; i < prices.length; i++) {
      const dist = Math.abs(prices[i][0] - targetMs)
      if (dist < minDist) {
        closest = prices[i]
        minDist = dist
      }
    }

    return closest[1] > 0 ? closest[1] : null
  } catch {
    return null
  }
}
