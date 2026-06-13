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

const CSRF_COOKIE = "csrf_token"
const CSRF_HEADER = "x-csrf-token"
const TOKEN_BYTES = 32

/** Paths exempt from CSRF validation (webhooks, internal workers, auth flow) */
const EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/internal/",
  "/api/finance/webhooks/",
  "/api/portfolio/webhooks/",
  // Bearer-token MCP endpoint: non-browser clients send no CSRF cookie/header,
  // and cross-origin browsers cannot set the Authorization header, so CSRF adds
  // nothing here. Without this, a cookie-jar MCP client 403s on repeat calls.
  "/api/mcp",
]

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Generate a new CSRF token.
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Ensure a CSRF cookie exists on the response. If the request already
 * has one, preserve it. Otherwise generate a fresh token.
 */
export function ensureCsrfCookie(request: NextRequest, response: NextResponse): NextResponse {
  const existing = request.cookies.get(CSRF_COOKIE)
  if (existing?.value) return response

  const token = generateCsrfToken()
  // Secure must track the REAL transport (tunnel https vs plain localhost http):
  // WKWebView (the desktop app) refuses Secure cookies over http://localhost.
  const proto = (request.headers.get("x-forwarded-proto") ?? "").split(",")[0]!.trim()
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // JS must read this to attach as header
    secure: proto === "https",
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

  // Check exemptions. A trailing-slash entry is a true prefix; a non-slash entry
  // (e.g. "/api/mcp") matches only the exact path or a slash-bounded child — so a
  // future cookie-authed route like "/api/mcp-export" can't inherit the exemption.
  const path = request.nextUrl.pathname
  if (
    EXEMPT_PREFIXES.some((prefix) =>
      prefix.endsWith("/")
        ? path.startsWith(prefix)
        : path === prefix || path.startsWith(`${prefix}/`),
    )
  ) {
    return null
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_HEADER)

  // If no cookie exists yet (first visit), skip validation — there's nothing to forge.
  // The cookie will be set on this response, and future requests will be validated.
  if (!cookieToken) return null

  if (!headerToken || cookieToken !== headerToken) {
    return NextResponse.json(
      { error: "CSRF token missing or invalid", ref: "CSRF001" },
      { status: 403 },
    )
  }

  return null
}
