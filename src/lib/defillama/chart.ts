/**
 * DeFi Llama /chart endpoint wrapper — fetches full daily price timeseries
 * for multiple tokens in batched API calls.
 */

import { COINS_API_BASE, getCached, setCache, fetchJsonWithRetry } from "./helpers"

// ─── Types ───

export interface ChartPricePoint {
  timestamp: number
  price: number
}

export interface ChartCoinData {
  symbol: string
  confidence: number
  prices: ChartPricePoint[]
}

export interface ChartResponse {
  coins: Record<string, ChartCoinData>
}

// ─── Constants ───

const CHART_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const MAX_DATAPOINTS = 450 // DeFiLlama limit is 500, leave headroom

// ─── Single batch fetch ───

export async function fetchPriceChart(
  coinIds: string[],
  startTimestamp: number,
  span: number,
  opts?: { userId?: string },
): Promise<ChartResponse> {
  if (coinIds.length === 0) return { coins: {} }

  const coins = [...coinIds].sort().join(",")
  const cacheKey = `defillama:chart:${coins}:${startTimestamp}:${span}`

  const cached = getCached<ChartResponse>(cacheKey)
  if (cached) return cached

  const url = `${COINS_API_BASE}/chart/${coins}?start=${startTimestamp}&span=${span}&period=1d`

  const data = await fetchJsonWithRetry<ChartResponse>(url, {
    userId: opts?.userId,
    operationKey: `chart:${coins.slice(0, 60)}`,
  })

  if (!data) return { coins: {} }

  setCache(cacheKey, data, CHART_CACHE_TTL_MS)
  return data
}

// ─── Multi-coin batched fetch ───

export async function fetchMultiCoinChart(
  coinIds: string[],
  startTimestamp: number,
  opts?: { userId?: string; spanDays?: number },
): Promise<ChartResponse> {
  if (coinIds.length === 0) return { coins: {} }

  const nowSec = Math.floor(Date.now() / 1000)
  const span = Math.max(1, opts?.spanDays ?? Math.ceil((nowSec - startTimestamp) / 86400))

  // DeFiLlama limits to 500 data points (coins × span). Batch accordingly.
  const batchSize = Math.max(1, Math.floor(MAX_DATAPOINTS / span))

  if (coinIds.length <= batchSize) {
    return fetchPriceChart(coinIds, startTimestamp, span, { userId: opts?.userId })
  }

  // Chunk into batches and fetch sequentially to respect rate limits
  const merged: ChartResponse = { coins: {} }
  for (let i = 0; i < coinIds.length; i += batchSize) {
    const batch = coinIds.slice(i, i + batchSize)
    const result = await fetchPriceChart(batch, startTimestamp, span, { userId: opts?.userId })
    Object.assign(merged.coins, result.coins)
  }

  return merged
}
