/**
 * GET /api/travel/atf/connect
 *
 * Starts the ATF OAuth 2.1 authorization-code + PKCE flow.
 * - Generates a PKCE code_verifier and an opaque CSRF state.
 * - Persists the flow server-side in PkceFlow, keyed by state and BOUND TO THE
 *   USER, so the callback never depends on the (sameSite=strict) session cookie
 *   surviving ATF's cross-site redirect back.
 * - Ensures dynamic client registration has run (cached client_id).
 * - 302-redirects the user to ATF's authorization_endpoint.
 *
 * SECURITY: the verifier is stored server-side only — never in a cookie, URL, or log.
 */

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import {
  ATF_REDIRECT_URI,
  buildAuthorizeUrl,
  ensureClientId,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "@/lib/travel/atf-oauth"

const FLOW_TTL_MS = 10 * 60 * 1000 // 10 min — enough for an interactive authorize

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("T2100", "Authentication required", 401)

  try {
    const clientId = await ensureClientId(user.id)

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateState()

    await db.pkceFlow.create({
      data: {
        state,
        userId: user.id,
        provider: "atf",
        codeVerifier,
        expiresAt: new Date(Date.now() + FLOW_TTL_MS),
      },
    })

    const authorizeUrl = buildAuthorizeUrl({
      clientId,
      redirectUri: ATF_REDIRECT_URI,
      state,
      codeChallenge,
    })
    return NextResponse.redirect(authorizeUrl, { status: 302 })
  } catch (err) {
    return apiError("T2101", "Failed to start ATF authorization", 500, err)
  }
}
