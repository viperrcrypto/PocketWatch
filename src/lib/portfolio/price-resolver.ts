/**
 * Batch price resolution for cached transactions.
 * Groups unpriced transactions by (chain, asset, hour_bucket) to minimize API calls,
 * then updates TransactionCache.usdValue in bulk.
 *
 * Re-exports symbol utilities for backward compatibility.
 */

import { db } from "@/lib/db"
import { getHistoricalPrices, type TokenPriceInput } from "@/lib/defillama"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import {
  DEFILLAMA_CHAIN_MAP,
  NATIVE_COINGECKO_IDS,
  fetchNativeTokenPrices,
} from "@/lib/tracker/chains"
import { fetchCoinGeckoHistoricalPrice } from "./price-coingecko"

// Re-export symbol utilities for backward compatibility
export {
  isStableLikeSymbol,
  isLikelySpamTokenSymbol,
  normalizeSymbolForPricing,
  isPlausibleResolvedPrice,
  inferHeuristicUsdPrice,
} from "./price-symbol-utils"

import {
  isStableLikeSymbol,
  isLikelySpamTokenSymbol,
  normalizeSymbolForPricing,
  isPlausibleResolvedPrice,
  inferHeuristicUsdPrice,
} from "./price-symbol-utils"

const RATE_LIMIT_MS = 6_000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Only return heuristic price for stablecoin-like symbols.
 */
function stableFallback(
  symbol: string | null,
  chain: string,
  nativePrices: Map<string, number>
): number | null {
  const normalized = normalizeSymbolForPricing(symbol)
  if (normalized && isStableLikeSymbol(normalized)) {
    return inferHeuristicUsdPrice(symbol, chain, nativePrices)
  }
  return null
}

/**
 * Fetch historical price for a single asset at a specific timestamp.
 */
async function fetchPrice(
  chain: string,
  asset: string,
  symbol: string | null,
  timestamp: number,
  nativePrices: Map<string, number>,
  coingeckoKey: string | null = null,
): Promise<number | null> {
  if (isLikelySpamTokenSymbol(symbol)) return null

  // Native token -- use CoinGecko ID via DeFiLlama
  if (asset === "native" && symbol) {
    const cgId = NATIVE_COINGECKO_IDS[symbol] ?? NATIVE_COINGECKO_IDS[symbol.toUpperCase()]
    if (cgId) {
      const tokens: TokenPriceInput[] = [{
        chain: cgId.split(":")[0],
        address: cgId.split(":")[1],
      }]
      const result = await getHistoricalPrices(timestamp, tokens)
      const llamaPrice = result.coins[cgId]?.price
      if (llamaPrice != null) return llamaPrice
    }
    return stableFallback(symbol, chain, nativePrices)
  }

  // ERC20 token -- use DeFiLlama chain:address format
  const llamaChain = DEFILLAMA_CHAIN_MAP[chain as keyof typeof DEFILLAMA_CHAIN_MAP]
  if (!llamaChain || !asset) return null

  const normalizedAsset = asset.toLowerCase()
  const tokenKey = `${llamaChain}:${normalizedAsset}`
  const tokens: TokenPriceInput[] = [{ chain: llamaChain, address: normalizedAsset }]
  const result = await getHistoricalPrices(timestamp, tokens)
  const priceData = result.coins[tokenKey] ?? result.coins[`${llamaChain}:${asset}`]
  if (priceData?.price != null) return priceData.price

  // Try CoinGecko as fallback for tokens DeFiLlama doesn't cover
  if (coingeckoKey && asset) {
    const cgPrice = await fetchCoinGeckoHistoricalPrice(chain, asset, timestamp, coingeckoKey)
    if (cgPrice != null && isPlausibleResolvedPrice(symbol, chain, cgPrice, nativePrices)) {
      return cgPrice
    }
  }

  return stableFallback(symbol, chain, nativePrices)
}

/**
 * Resolve USD values for all unpriced transactions in the cache.
 * Returns the number of transactions updated.
 */
export async function resolveUnpricedTransactions(userId: string): Promise<{
  resolved: number
  failed: number
  total: number
}> {
  const unpriced = await db.transactionCache.findMany({
    where: { userId, usdValue: null, value: { not: null } },
    select: { id: true, chain: true, asset: true, symbol: true, blockTimestamp: true, value: true },
    orderBy: { blockTimestamp: "asc" },
  })

  if (unpriced.length === 0) return { resolved: 0, failed: 0, total: 0 }

  // -- Phase 0: Apply manual price overrides first --
  const manualPrices = await db.manualPrice.findMany({ where: { userId } })
  const manualMap = new Map<string, number>()
  for (const mp of manualPrices) {
    manualMap.set(`${mp.chain}:${mp.asset}`, mp.priceUsd)
  }

  let manualResolved = 0
  const remaining = []
  let spamSkipped = 0
  const manualUpdates: Array<{ id: string; usdValue: number }> = []

  for (const tx of unpriced) {
    const key = `${tx.chain}:${tx.asset ?? "native"}`
    const manualPrice = manualMap.get(key)
    if (manualPrice != null) {
      manualUpdates.push({ id: tx.id, usdValue: (tx.value ?? 0) * manualPrice })
      manualResolved++
    } else if (isLikelySpamTokenSymbol(tx.symbol)) {
      spamSkipped++
    } else {
      remaining.push(tx)
    }
  }

  for (let i = 0; i < manualUpdates.length; i += 50) {
    await Promise.all(manualUpdates.slice(i, i + 50).map((u) =>
      db.transactionCache.update({ where: { id: u.id }, data: { usdValue: u.usdValue } })
    ))
  }

  if (remaining.length === 0) {
    return { resolved: manualResolved, failed: spamSkipped, total: unpriced.length }
  }

  // -- Phase 1: Heuristic symbol pricing fallback --
  const nativePrices = await fetchNativeTokenPrices().catch(() => new Map<string, number>())
  const coingeckoKey = await getServiceKey(userId, "coingecko").catch(() => null)
  const unresolved = []
  let heuristicResolved = 0
  const heuristicUpdates: Array<{ id: string; usdValue: number }> = []

  for (const tx of remaining) {
    const heuristicPrice = inferHeuristicUsdPrice(tx.symbol, tx.chain, nativePrices)
    if (heuristicPrice != null && isPlausibleResolvedPrice(tx.symbol, tx.chain, heuristicPrice, nativePrices)) {
      heuristicUpdates.push({ id: tx.id, usdValue: (tx.value ?? 0) * heuristicPrice })
      heuristicResolved++
    } else {
      unresolved.push(tx)
    }
  }

  for (let i = 0; i < heuristicUpdates.length; i += 50) {
    await Promise.all(heuristicUpdates.slice(i, i + 50).map((u) =>
      db.transactionCache.update({ where: { id: u.id }, data: { usdValue: u.usdValue } })
    ))
  }

  if (unresolved.length === 0) {
    return { resolved: manualResolved + heuristicResolved, failed: spamSkipped, total: unpriced.length }
  }

  // -- Phase 2: DeFiLlama for unresolved remainder --
  const groups = new Map<string, typeof unresolved>()
  for (const tx of unresolved) {
    const hourBucket = Math.floor(tx.blockTimestamp / 3600) * 3600
    const key = `${tx.chain}:${tx.asset ?? "native"}:${hourBucket}`
    const group = groups.get(key) ?? []
    group.push(tx)
    groups.set(key, group)
  }

  let resolved = 0
  let failed = spamSkipped
  const entries = Array.from(groups.entries())

  for (let i = 0; i < entries.length; i++) {
    const [key, txs] = entries[i]
    const [chain, asset, hourStr] = key.split(":")
    const hourTimestamp = parseInt(hourStr, 10)

    try {
      const price = await fetchPrice(chain, asset, txs[0].symbol, hourTimestamp, nativePrices, coingeckoKey)

      if (price !== null && isPlausibleResolvedPrice(txs[0].symbol, chain, price, nativePrices)) {
        const updates = txs.map((tx) => {
          const usdValue = (tx.value ?? 0) * price
          return db.transactionCache.update({ where: { id: tx.id }, data: { usdValue } })
        })
        await Promise.all(updates)
        resolved += txs.length
      } else {
        failed += txs.length
      }
    } catch (err) {
      const is429 = err instanceof Error && (
        err.message.includes("429") || err.message.includes("rate") || err.message.includes("Too Many")
      )
      if (is429) {
        console.warn(`[price-resolver] DeFiLlama 429 at group ${i}/${entries.length}, stopping`)
        failed += entries.slice(i).reduce((sum, [, txGroup]) => sum + txGroup.length, 0)
        break
      }
      console.error(`[price-resolver] Error resolving ${key}:`, err)
      failed += txs.length
    }

    if (i < entries.length - 1 && (i + 1) % 10 === 0) {
      await sleep(RATE_LIMIT_MS)
    }
  }

  return {
    resolved: resolved + manualResolved + heuristicResolved,
    failed,
    total: unpriced.length,
  }
}
