/**
 * CSRF protection via double-submit cookie pattern.
 *
 * - Middleware sets a `csrf_token` cookie on every response (if missing)
 * - Mutating requests (POST/PUT/PATCH/DELETE) must include the token
 *   as the `x-csrf-token` header
 * - Token is validated by comparing header value to cookie value
 *
 * The cookie is HttpOnly=false so client JS can read it to attach the header.
 * SameSite=Strict prevents the cookie from being sent in cross-origin requests,
 * and the header comparison ensures the requester can read the cookie (same origin).
 */

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"

const CSRF_COOKIE = "csrf_token"
const CSRF_HEADER = "x-csrf-token"
const TOKEN_LENGTH = 32

/** Paths exempt from CSRF validation (webhooks, internal workers, auth flow) */
const EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/internal/",
  "/api/finance/webhooks/",
  "/api/portfolio/webhooks/",
]

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Generate a new CSRF token.
 */
export function generateCsrfToken(): string {
  return randomBytes(TOKEN_LENGTH).toString("hex")
}

/**
 * Ensure a CSRF cookie exists on the response. If the request already
 * has one, preserve it. Otherwise generate a fresh token.
 */
export function ensureCsrfCookie(request: NextRequest, response: NextResponse): NextResponse {
  const existing = request.cookies.get(CSRF_COOKIE)
  if (existing?.value) return response

  const token = generateCsrfToken()
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // JS must read this to attach as header
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year — rotates on clear
  })
  return response
}

/**
 * Validate CSRF token on mutating requests.
 * Returns null if valid, or a NextResponse 403 if invalid.
 */
export function validateCsrf(request: NextRequest): NextResponse | null {
  // Only validate mutating methods
  if (!MUTATING_METHODS.has(request.method)) return null

  // Check exemptions
  const path = request.nextUrl.pathname
  if (EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) return null

  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_HEADER)

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json(
      { error: "CSRF token missing or invalid", ref: "CSRF001" },
      { status: 403 },
    )
  }

  return null
}
