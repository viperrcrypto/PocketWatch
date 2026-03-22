/**
 * Shared Zerion positions cache with in-flight request deduplication.
 *
 * Problem: /balances, /balances/blockchain, and /staking all call
 * fetchMultiWalletPositions() independently — 3x the Zerion API usage
 * on every page load, triggering 429 rate limits.
 *
 * Solution: Cache positions per-user and deduplicate concurrent
 * in-flight requests so multiple routes share one fetch.
 */

import { createHash } from "node:crypto"
import {
  fetchMultiWalletPositions,
  type MultiWalletResult,
} from "./zerion-client"
import { withProviderPermit } from "./provider-governor"

const FULL_CACHE_TTL_MS = 5 * 60_000 // 5 min — all wallets succeeded
const PARTIAL_CACHE_TTL_MS = 30_000     // 30s — some wallets failed (retry soon)
const CACHE_MAX_SIZE = 100              // prevent unbounded memory growth

/** Cached positions per user. */
const positionsCache = new Map<
  string,
  { data: MultiWalletResult; timestamp: number; ttl: number }
>()

/** In-flight promises per user — concurrent callers share one fetch. */
const inflight = new Map<string, Promise<MultiWalletResult>>()

/**
 * Get wallet positions, using cache and in-flight deduplication.
 * Multiple routes calling this for the same user within the TTL
 * will share a single Zerion API call.
 */
export async function getCachedWalletPositions(
  userId: string,
  apiKey: string,
  addresses: string[],
  serviceKeyId?: string,
): Promise<MultiWalletResult> {
  // Serve from cache if fresh
  const cached = positionsCache.get(userId)
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }

  // If a fetch is already in-flight for this user, wait for it
  const pending = inflight.get(userId)
  if (pending) {
    return pending
  }

  // Start a new fetch and register it as in-flight
  const fingerprint = createHash("sha256")
    .update(addresses.map((a) => a.toLowerCase()).sort().join("|"))
    .digest("hex").slice(0, 16)
  const governedPromise = withProviderPermit(
    userId,
    "zerion",
    `positions:${fingerprint}`,
    undefined,
    () => fetchMultiWalletPositions(apiKey, addresses),
    serviceKeyId
  )
    .then((result) => {
      // Short TTL for partial results so we retry soon
      const ttl = result.failedCount > 0 ? PARTIAL_CACHE_TTL_MS : FULL_CACHE_TTL_MS
      // Evict oldest entry if cache exceeds max size
      if (positionsCache.size >= CACHE_MAX_SIZE) {
        const oldestKey = positionsCache.keys().next().value
        if (oldestKey) positionsCache.delete(oldestKey)
      }
      positionsCache.set(userId, { data: result, timestamp: Date.now(), ttl })
      return result
    })
    .catch((error) => {
      // Serve stale cache on any error (throttle, network, 500, timeout)
      if (cached) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[zerion-cache] Fetch failed (${reason}), serving stale cache`)
        return cached.data
      }
      throw error
    })
    .finally(() => {
      inflight.delete(userId)
    })

  inflight.set(userId, governedPromise)
  return governedPromise
}

/**
 * Bust the cache for a user. Call this on force-refresh (POST).
 * Does NOT cancel in-flight requests — they'll complete and re-cache.
 */
export function invalidateCachedWalletPositions(userId: string): void {
  positionsCache.delete(userId)
}
