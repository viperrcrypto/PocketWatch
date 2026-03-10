/**
 * DeFi Llama price APIs: current, historical, batch, comparison, arbitrage.
 */

import { COINS_API_BASE, getCached, setCache, fetchJsonWithRetry } from "./helpers"

// ─── Price Types ───

export interface DefiLlamaPrice {
  decimals?: number
  price: number
  symbol: string
  timestamp: number
  confidence: number
}

export interface DefiLlamaPriceResponse {
  coins: {
    [key: string]: DefiLlamaPrice
  }
}

export interface HistoricalPriceResponse {
  coins: {
    [key: string]: {
      decimals?: number
      price: number
      symbol: string
      timestamp: number
      confidence: number
    }
  }
}

export interface TokenPriceInput {
  chain: string
  address: string
}

export interface PriceComparison {
  token: string
  chain: string
  address: string
  defillama: number | null
  codex: number | null
  coingecko: number | null
  spread: number
  spreadPercent: number
  bestPrice: number
  worstPrice: number
  bestSource: string
  worstSource: string
  hasArbitrage: boolean
}

export interface ArbitrageOpportunity {
  token: string
  chain: string
  address: string
  buyFrom: string
  sellTo: string
  buyPrice: number
  sellPrice: number
  profitPercent: number
  profitAbsolute: number
  timestamp: number
}

// ─── Current Prices ───

export async function getCurrentPrices(
  tokens: TokenPriceInput[],
  opts?: { userId?: string }
): Promise<DefiLlamaPriceResponse> {
  if (tokens.length === 0) {
    return { coins: {} }
  }

  const coins = tokens.map((t) => `${t.chain}:${t.address}`).join(",")
  const cacheKey = `defillama:prices:current:${coins}`

  const cached = getCached<DefiLlamaPriceResponse>(cacheKey)
  if (cached) return cached

  const url = `${COINS_API_BASE}/prices/current/${coins}`

  const data = await fetchJsonWithRetry<DefiLlamaPriceResponse>(url, {
    userId: opts?.userId,
    operationKey: `prices:current:${coins}`,
  })
  if (!data) return { coins: {} }

  setCache(cacheKey, data, 30_000)

  return data
}

// ─── Historical Prices ───

export async function getHistoricalPrices(
  timestamp: number,
  tokens: TokenPriceInput[],
  opts?: { userId?: string }
): Promise<HistoricalPriceResponse> {
  if (tokens.length === 0) {
    return { coins: {} }
  }

  const coins = tokens.map((t) => `${t.chain}:${t.address}`).join(",")
  const cacheKey = `defillama:prices:historical:${timestamp}:${coins}`

  const cached = getCached<HistoricalPriceResponse>(cacheKey)
  if (cached) return cached

  const url = `${COINS_API_BASE}/prices/historical/${timestamp}/${coins}`

  const data = await fetchJsonWithRetry<HistoricalPriceResponse>(url, {
    userId: opts?.userId,
    operationKey: `prices:historical:${timestamp}:${coins}`,
  })
  if (!data) return { coins: {} }

  setCache(cacheKey, data, 3600_000)

  return data
}

// ─── Batch Price Fetch ───

export async function getBatchPrices(
  tokens: TokenPriceInput[]
): Promise<Map<string, number>> {
  const prices = new Map<string, number>()

  const data = await getCurrentPrices(tokens)

  for (const token of tokens) {
    const key = `${token.chain}:${token.address}`
    const priceData = data.coins[key]

    if (priceData && priceData.price) {
      prices.set(key, priceData.price)
    }
  }

  return prices
}

// ─── Price Difference Calculator ───

export function calculatePriceDifference(prices: {
  [source: string]: number | null
}): {
  spread: number
  spreadPercent: number
  min: number
  max: number
  minSource: string
  maxSource: string
} {
  const validPrices = Object.entries(prices).filter(
    ([_, price]) => price !== null && price > 0
  ) as [string, number][]

  if (validPrices.length === 0) {
    return { spread: 0, spreadPercent: 0, min: 0, max: 0, minSource: "", maxSource: "" }
  }

  if (validPrices.length === 1) {
    const [source, price] = validPrices[0]
    return { spread: 0, spreadPercent: 0, min: price, max: price, minSource: source, maxSource: source }
  }

  let minPrice = validPrices[0][1]
  let maxPrice = validPrices[0][1]
  let minSource = validPrices[0][0]
  let maxSource = validPrices[0][0]

  for (const [source, price] of validPrices) {
    if (price < minPrice) {
      minPrice = price
      minSource = source
    }
    if (price > maxPrice) {
      maxPrice = price
      maxSource = source
    }
  }

  const spread = maxPrice - minPrice
  const spreadPercent = (spread / minPrice) * 100

  return { spread, spreadPercent, min: minPrice, max: maxPrice, minSource, maxSource }
}

// ─── Arbitrage Detection ───

export function detectArbitrage(
  comparisons: PriceComparison[],
  threshold: number = 1.0
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = []

  for (const comp of comparisons) {
    if (comp.spreadPercent >= threshold && comp.hasArbitrage) {
      opportunities.push({
        token: comp.token,
        chain: comp.chain,
        address: comp.address,
        buyFrom: comp.bestSource,
        sellTo: comp.worstSource,
        buyPrice: comp.bestPrice,
        sellPrice: comp.worstPrice,
        profitPercent: comp.spreadPercent,
        profitAbsolute: comp.spread,
        timestamp: Date.now(),
      })
    }
  }

  return opportunities.sort((a, b) => b.profitPercent - a.profitPercent)
}

// ─── Multi-Source Price Comparison ───

export function comparePrices(
  token: string,
  chain: string,
  address: string,
  defillamaPrice: number | null,
  codexPrice: number | null,
  coingeckoPrice: number | null
): PriceComparison {
  const prices = {
    defillama: defillamaPrice,
    codex: codexPrice,
    coingecko: coingeckoPrice,
  }

  const diff = calculatePriceDifference(prices)

  return {
    token,
    chain,
    address,
    defillama: defillamaPrice,
    codex: codexPrice,
    coingecko: coingeckoPrice,
    spread: diff.spread,
    spreadPercent: diff.spreadPercent,
    bestPrice: diff.min,
    worstPrice: diff.max,
    bestSource: diff.minSource,
    worstSource: diff.maxSource,
    hasArbitrage: diff.spreadPercent >= 0.5,
  }
}
