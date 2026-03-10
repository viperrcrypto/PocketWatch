import { NextResponse } from "next/server"

/**
 * Standardized API error response with reference codes.
 *
 * Every error returned to clients includes a `ref` code (e.g. "E1042")
 * that is also logged server-side, making it trivial to trace user-reported
 * errors back to the exact code path that produced them.
 *
 * Usage:
 *   return apiError("E1001", "Unauthorized", 401)
 *   return apiError("E2015", "Campaign not found", 404)
 *   return apiError("E3007", "Failed to fetch wallets", 500, error)
 */
export function apiError(
  ref: string,
  message: string,
  status: number,
  cause?: unknown,
  headers?: HeadersInit
): NextResponse {
  // Server-side log with full context
  const logData: Record<string, unknown> = { ref, status, message }
  if (cause) {
    logData.cause =
      cause instanceof Error
        ? { name: cause.name, message: cause.message, stack: cause.stack }
        : cause
  }

  if (status >= 500) {
    console.error(`[API_ERROR] ${ref}:`, logData)
  } else {
    console.warn(`[API_ERROR] ${ref}:`, logData)
  }

  return NextResponse.json(
    { error: message, ref },
    { status, headers }
  )
}
