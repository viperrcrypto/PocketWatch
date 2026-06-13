/**
 * GET /api/travel/atf/callback
 *
 * OAuth 2.1 redirect target. ATF sends ?code & ?state (or ?error).
 * - Rejects on ?error= (sanitized before reflection).
 * - CSRF + user binding: looks up the server-side PkceFlow by state and CONSUMES
 *   it (delete-on-read = single-use). The flow carries the userId, so we do NOT
 *   rely on the session cookie (which is sameSite=strict and absent here).
 * - Exchanges the code using the flow's PKCE verifier.
 * - Stores tokens ENCRYPTED via the shared persistAtfTokens writer.
 * - 302s back to settings.
 *
 * SECURITY: tokens/codes/verifiers never appear in the redirect URL or logs.
 */

import { NextResponse, type NextRequest } from "next/server"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { ATF_REDIRECT_URI, getStoredClientId, exchangeCode } from "@/lib/travel/atf-oauth"
import { persistAtfTokens } from "@/lib/travel/atf-mcp-client"

const OAUTH_ERROR_RE = /^[a-z_]{1,40}$/

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const oauthError = params.get("error")
  if (oauthError) {
    const safe = OAUTH_ERROR_RE.test(oauthError) ? oauthError : "authorization_failed"
    return apiError("T2201", `ATF authorization denied: ${safe}`, 400)
  }

  const code = params.get("code")
  const state = params.get("state")
  if (!code || !state) {
    return apiError("T2202", "Missing authorization code or state", 400)
  }

  // Look up the single-use server-side flow (CSRF + user binding).
  const flow = await db.pkceFlow.findUnique({ where: { state } })
  if (!flow || flow.provider !== "atf" || flow.expiresAt < new Date()) {
    return apiError("T2203", "Invalid or expired OAuth state (CSRF check failed)", 400)
  }
  // ATOMICALLY claim the flow: only the request that actually deletes the row may
  // proceed, so a duplicate callback (common in the desktop webview) can't spend
  // the auth code twice — the second exchange would fail ATF as invalid_grant.
  const claim = await db.pkceFlow.deleteMany({ where: { state } })
  if (claim.count === 0) {
    return apiError("T2205", "This sign-in link was already used — please reconnect.", 400)
  }

  try {
    // Use the client_id REGISTERED AT CONNECT — never re-register here, or the new
    // client_id wouldn't match the one the code was issued to (→ invalid_grant).
    const clientId = await getStoredClientId(flow.userId)
    if (!clientId) {
      return apiError("T2206", "ATF client registration was lost — please reconnect.", 400)
    }
    console.log("[atf-callback] exchanging code", { userId: flow.userId, redirectUri: ATF_REDIRECT_URI })
    const token = await exchangeCode({
      code,
      codeVerifier: flow.codeVerifier,
      clientId,
      redirectUri: ATF_REDIRECT_URI,
    })

    await persistAtfTokens(flow.userId, {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? "",
      expiresAt:
        typeof token.expires_in === "number" ? Date.now() + token.expires_in * 1000 : 0,
    })

    return NextResponse.redirect(
      new URL("/travel/settings?atf=connected", req.nextUrl.origin),
      { status: 302 },
    )
  } catch (err) {
    return apiError("T2204", "Failed to complete ATF authorization", 500, err)
  }
}
