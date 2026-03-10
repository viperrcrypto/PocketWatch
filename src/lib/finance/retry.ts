/**
 * Retry wrapper for transient failures (429, 5xx).
 * Used by sync operations to handle temporary provider outages.
 */

interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  retryOn?: (err: unknown) => boolean
}

function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false

  const status =
    (err as { status?: number }).status ??
    (err as { response?: { status?: number } }).response?.status

  if (status === 429 || (status !== undefined && status >= 500)) return true

  const message = err instanceof Error ? err.message : ""
  if (message.includes("ECONNRESET") || message.includes("ETIMEDOUT")) return true
  if (message.includes("fetch failed") || message.includes("network")) return true

  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 1000, retryOn = isTransientError } = options

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt >= maxRetries || !retryOn(err)) throw err

      const delay = baseDelayMs * (attempt + 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
