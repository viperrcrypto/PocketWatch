/**
 * Multi-provider balance cache with in-flight request deduplication.
 *
 * Same pattern as zerion-cache.ts but wraps fetchAllWalletBalances
 * (the multi-provider orchestrator) instead of Zerion-only fetching.
 */

import { fetchAllWalletBalances } from "./multi-balance-fetcher"
import type { MultiWalletResult } from "./zerion-client"

const FULL_CACHE_TTL_MS = 5 * 60_000   // 5 min — all wallets succeeded
const PARTIAL_CACHE_TTL_MS = 30_000     // 30s — some wallets failed (retry soon)
const CACHE_MAX_SIZE = 100

interface CacheEntry {
  data: MultiWalletResult
  timestamp: number
  ttl: number
}

interface WalletInput {
  address: string
  chains: string[]
}

const positionsCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<MultiWalletResult>>()

/**
 * Get wallet positions across all providers, using cache and in-flight deduplication.
 */
export async function getCachedMultiProviderPositions(
  userId: string,
  wallets: WalletInput[],
): Promise<MultiWalletResult> {
  // Serve from cache if fresh
  const cached = positionsCache.get(userId)
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }

  // If a fetch is already in-flight for this user, wait for it
  const pending = inflight.get(userId)
  if (pending) return pending

  // Start a new fetch and register it as in-flight
  const promise = fetchAllWalletBalances(userId, wallets)
    .then((result) => {
      const ttl = result.failedCount > 0 ? PARTIAL_CACHE_TTL_MS : FULL_CACHE_TTL_MS
      if (positionsCache.size >= CACHE_MAX_SIZE) {
        const oldestKey = positionsCache.keys().next().value
        if (oldestKey) positionsCache.delete(oldestKey)
      }
      positionsCache.set(userId, { data: result, timestamp: Date.now(), ttl })
      return result
    })
    .catch((error) => {
      // Serve stale cache on any error
      if (cached) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[multi-cache] Fetch failed (${reason}), serving stale cache`)
        return cached.data
      }
      throw error
    })
    .finally(() => {
      inflight.delete(userId)
    })

  inflight.set(userId, promise)
  return promise
}

/**
 * Bust the cache for a user. Call on force-refresh (POST).
 */
export function invalidateMultiProviderCache(userId: string): void {
  positionsCache.delete(userId)
}
