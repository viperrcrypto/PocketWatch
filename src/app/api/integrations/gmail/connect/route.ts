/**
 * GET /api/integrations/gmail/connect
 *
 * Starts the Gmail OAuth 2.0 authorization-code + PKCE (S256) flow.
 * - Generates a PKCE code_verifier and an opaque CSRF state.
 * - Persists the flow server-side in PkceFlow (provider "gmail"), keyed by state
 *   and BOUND TO THE USER, so the callback never depends on the (sameSite=strict)
 *   session cookie surviving Google's cross-site redirect back.
 * - 302-redirects the user to Google's authorization_endpoint.
 *
 * SECURITY: the verifier is stored server-side only — never in a cookie, URL, or log.
 */

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import {
  GMAIL_REDIRECT_URI,
  buildAuthorizeUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  requireGmailClientConfig,
} from "@/lib/integrations/gmail-oauth"

const FLOW_TTL_MS = 10 * 60 * 1000 // 10 min — enough for an interactive authorize

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("G2100", "Authentication required", 401)

  const config = requireGmailClientConfigSafe()
  if (!config) return apiError("G2102", "Gmail integration is not configured", 503)

  try {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateState()

    await db.pkceFlow.create({
      data: {
        state,
        userId: user.id,
        provider: "gmail",
        codeVerifier,
        expiresAt: new Date(Date.now() + FLOW_TTL_MS),
      },
    })

    const authorizeUrl = buildAuthorizeUrl({
      clientId: config.clientId,
      redirectUri: GMAIL_REDIRECT_URI,
      state,
      codeChallenge,
    })
    return NextResponse.redirect(authorizeUrl, { status: 302 })
  } catch (err) {
    return apiError("G2101", "Failed to start Gmail authorization", 500, err)
  }
}

/** requireGmailClientConfig without throwing, for the 503 unavailable path. */
function requireGmailClientConfigSafe(): { clientId: string } | null {
  try {
    return requireGmailClientConfig()
  } catch {
    return null
  }
}
