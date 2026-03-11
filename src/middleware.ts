import { NextRequest, NextResponse } from "next/server"

// Duplicated from @/lib/auth to avoid importing server-only modules in middleware
const SESSION_COOKIE = "pocketwatch_session"

/**
 * Redirect unauthenticated users away from dashboard routes.
 *
 * We only check for the presence of the session cookie here — the actual
 * validation (expiry, DB lookup) happens in the API routes. This is enough
 * to catch the most common case: the cookie is missing entirely (server
 * restart, browser cleared cookies, cookie expired and was cleaned up).
 */
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)

  if (!sessionCookie?.value) {
    const loginUrl = new URL("/", request.url)
    // Preserve the original path so we can redirect back after login
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Protect all dashboard routes — these are the (dashboard) route group pages
  // and all API routes except auth endpoints
  matcher: [
    "/portfolio/:path*",
    "/finance/:path*",
    "/net-worth/:path*",
    "/tracker/:path*",
  ],
}
