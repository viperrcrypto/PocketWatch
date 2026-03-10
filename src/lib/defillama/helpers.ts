/**
 * DeFi Llama shared utilities: cache, constants, formatting, retry logic.
 */

import { withProviderPermit } from "@/lib/portfolio/provider-governor"

// ─── Constants ───

export const DEFILLAMA_BASE_URL = "https://api.llama.fi"
export const COINS_API_BASE = "https://coins.llama.fi"
export const YIELDS_BASE_URL = "https://yields.llama.fi"
export const PRICE_TIMEOUT_MS = 12_000
export const PRICE_RETRY_DELAYS_MS = [1500, 3000]

// ─── In-Memory Cache ───

const cache = new Map<string, { data: unknown; expiry: number }>()

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expiry: Date.now() + ttlMs })
}

// ─── Retry Fetch ───

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599)
}

export async function fetchJsonWithRetry<T>(
  url: string,
  opts?: { userId?: string; operationKey?: string }
): Promise<T | null> {
  for (let attempt = 0; attempt <= PRICE_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const requestFn = () => fetch(url, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
        next: { revalidate: 60 },
      })
      const res = opts?.userId
        ? await withProviderPermit(
            opts.userId,
            "defillama",
            opts.operationKey ?? `http:${url}`,
            undefined,
            requestFn
          )
        : await requestFn()

      if (!res.ok) {
        if (attempt < PRICE_RETRY_DELAYS_MS.length && isRetryableStatus(res.status)) {
          await new Promise((resolve) => setTimeout(resolve, PRICE_RETRY_DELAYS_MS[attempt]))
          continue
        }
        throw new Error(`DeFi Llama API error: ${res.status} ${res.statusText}`)
      }

      return (await res.json()) as T
    } catch (error) {
      if (attempt < PRICE_RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, PRICE_RETRY_DELAYS_MS[attempt]))
        continue
      }
      console.error("Failed to fetch DeFi Llama prices:", error)
      return null
    }
  }

  return null
}

// ─── Formatting Utilities ───

/**
 * Calculate percentage change
 */
export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

/**
 * Format TVL value for display
 */
export function formatTVL(tvl: number): string {
  if (tvl >= 1e9) {
    return `$${(tvl / 1e9).toFixed(2)}B`
  }
  if (tvl >= 1e6) {
    return `$${(tvl / 1e6).toFixed(2)}M`
  }
  if (tvl >= 1e3) {
    return `$${(tvl / 1e3).toFixed(2)}K`
  }
  return `$${tvl.toFixed(2)}`
}

/**
 * Format percentage change
 */
export function formatChange(change: number | undefined): string {
  if (change === undefined || change === null) return "N/A"
  const sign = change >= 0 ? "+" : ""
  return `${sign}${change.toFixed(2)}%`
}

/**
 * Get color class for change value
 */
export function getChangeColor(change: number | undefined): string {
  if (change === undefined || change === null) return "text-foreground-muted"
  if (change > 0) return "text-success"
  if (change < 0) return "text-error"
  return "text-foreground-muted"
}

/**
 * Format large numbers with abbreviations
 */
export function formatNumber(num: number): string {
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`
  }
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`
  }
  return num.toFixed(2)
}
