import { NextRequest, NextResponse } from "next/server"
import { ensureCsrfCookie, validateCsrf } from "@/lib/csrf"

// Duplicated from @/lib/auth to avoid importing server-only modules in middleware
const SESSION_COOKIE = "pocketwatch_session"

/**
 * Middleware: auth redirect + CSRF protection.
 *
 * 1. Redirect unauthenticated users from dashboard routes to login
 * 2. Set CSRF cookie on every response (if missing)
 * 3. Validate CSRF token on mutating API requests
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith("/api/")
  const isDashboard = !isApi

  // ─── Auth check for dashboard routes ───
  if (isDashboard) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE)
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ─── CSRF validation for mutating API requests ───
  if (isApi) {
    const csrfError = validateCsrf(request)
    if (csrfError) return csrfError
  }

  // ─── Ensure CSRF cookie exists ───
  const response = NextResponse.next()
  return ensureCsrfCookie(request, response)
}

export const config = {
  matcher: [
    // Dashboard routes (auth check)
    "/portfolio/:path*",
    "/finance/:path*",
    "/net-worth/:path*",
    "/tracker/:path*",
    // API routes (CSRF check)
    "/api/:path*",
  ],
}
