/**
 * Rate limiting utility for API endpoints.
 * Uses in-memory storage by default.
 *
 * For production with multiple instances, consider using Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (consider Redis for multi-instance deployments)
const store = new Map<string, RateLimitEntry>()

// Track last cleanup time for lazy cleanup
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60000 // 1 minute

/**
 * Lazily clean up expired entries (called during rate limit checks).
 * Avoids setInterval which causes issues with Next.js hot reloading.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return
  }
  lastCleanup = now
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key)
    }
  }
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
}

/**
 * Check if a request should be rate limited.
 *
 * @param identifier - Unique identifier (IP, user ID, wallet address)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  // Lazy cleanup of expired entries
  cleanupExpiredEntries()

  const now = Date.now()
  const key = identifier
  const windowMs = config.windowSeconds * 1000

  let entry = store.get(key)

  // Reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    }
  }

  entry.count++
  store.set(key, entry)

  const remaining = Math.max(0, config.limit - entry.count)
  const success = entry.count <= config.limit

  return {
    success,
    limit: config.limit,
    remaining,
    resetAt: entry.resetAt,
  }
}

/**
 * Create a rate limiter for specific endpoint.
 *
 * @param config - Rate limit configuration
 * @returns Rate limit function
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (identifier: string) => rateLimit(identifier, config)
}

// Pre-configured rate limiters for common use cases
export const rateLimiters = {
  /** Auth endpoints: 5 requests per minute */
  auth: createRateLimiter({ limit: 5, windowSeconds: 60 }),

  /** Wallet verification: 10 requests per minute */
  verify: createRateLimiter({ limit: 10, windowSeconds: 60 }),

  /** Contribution recording: 15 requests per minute (allows retries + multiple contributions) */
  contribute: createRateLimiter({ limit: 15, windowSeconds: 60 }),

  /** General API: 60 requests per minute */
  api: createRateLimiter({ limit: 60, windowSeconds: 60 }),

  /** Write operations: 20 requests per minute */
  write: createRateLimiter({ limit: 20, windowSeconds: 60 }),

  /** Sensitive admin actions: 10 requests per minute */
  admin: createRateLimiter({ limit: 10, windowSeconds: 60 }),
}

/**
 * Finance-specific rate limiters.
 * Protects bank sync, credential, and webhook endpoints.
 */
export const financeRateLimiters = {
  /** Sync: 5 requests per 5 minutes */
  sync: createRateLimiter({ limit: 5, windowSeconds: 300 }),

  /** Settings POST (credential save): 10 requests per minute */
  settingsWrite: createRateLimiter({ limit: 10, windowSeconds: 60 }),

  /** Plaid exchange (token swap): 3 requests per 5 minutes */
  exchange: createRateLimiter({ limit: 3, windowSeconds: 300 }),

  /** SimpleFIN connect: 3 requests per 5 minutes */
  simplefinConnect: createRateLimiter({ limit: 3, windowSeconds: 300 }),

  /** Subscription detect: 3 requests per 5 minutes */
  detect: createRateLimiter({ limit: 3, windowSeconds: 300 }),

  /** Bulk transaction update: 10 requests per minute */
  bulkUpdate: createRateLimiter({ limit: 10, windowSeconds: 60 }),

  /** Webhooks: 30 requests per minute */
  webhook: createRateLimiter({ limit: 30, windowSeconds: 60 }),

  /** AI insight generation: 3 requests per 10 minutes */
  aiGenerate: createRateLimiter({ limit: 3, windowSeconds: 600 }),

  /** AI card enrichment: 10 requests per 10 minutes (one per card) */
  aiCardEnrich: createRateLimiter({ limit: 10, windowSeconds: 600 }),
}

/**
 * Deal flow specific rate limiters.
 * Stricter limits for sensitive deal operations.
 */
export const dealRateLimiters = {
  /** Submit interest in a deal: 3 requests per minute */
  submitInterest: createRateLimiter({ limit: 3, windowSeconds: 60 }),

  /** Submit commitment to a deal: 2 requests per minute */
  submitCommitment: createRateLimiter({ limit: 2, windowSeconds: 60 }),

  /** Submit contribution/payment: 5 requests per minute */
  submitContribution: createRateLimiter({ limit: 5, windowSeconds: 60 }),

  /** Admin deal actions: 30 requests per minute */
  adminActions: createRateLimiter({ limit: 30, windowSeconds: 60 }),
}

/**
 * Get client identifier from request.
 * Prefers x-real-ip (set by trusted reverse proxy), then the rightmost
 * x-forwarded-for entry (closest trusted proxy), then a header fingerprint.
 */
export function getClientId(request: Request): string {
  // Prefer x-real-ip (set by trusted reverse proxy)
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()

  // x-forwarded-for: take the rightmost (closest trusted proxy entry)
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map(s => s.trim()).filter(Boolean)
    return parts[parts.length - 1] || "unknown"
  }

  // Fallback: fingerprint from headers
  const ua = request.headers.get("user-agent") ?? ""
  const al = request.headers.get("accept-language") ?? ""
  return `fp:${ua.slice(0, 32)}:${al.slice(0, 16)}`
}

/**
 * Create rate limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetAt / 1000).toString(),
  }
}
