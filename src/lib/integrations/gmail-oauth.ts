/**
 * Google / Gmail OAuth 2.0 client.
 *
 * Implements the authorization-code + PKCE (S256) flow against Google's public
 * OAuth endpoints. Unlike ATF (a public client with dynamic registration),
 * Google issues a CONFIDENTIAL web client, so the token endpoint requires a
 * client_secret IN ADDITION to the PKCE code_verifier. The operator supplies
 * the client_id/secret/redirect via env (see .env.example). If unset, the
 * Gmail connector is simply unavailable.
 *
 * Mirrors src/lib/travel/atf-oauth.ts: same PKCE helpers, same buildAuthorizeUrl
 * / exchangeCode / refreshAccessToken surface, same postForm + timeout pattern.
 *
 * SECURITY: never log code_verifier, codes, access/refresh tokens, the
 * client_secret, or Authorization headers. All network calls use AbortSignal.timeout.
 *
 * Endpoints (stable public Google metadata):
 *   authorization_endpoint  https://accounts.google.com/o/oauth2/v2/auth
 *   token_endpoint          https://oauth2.googleapis.com/token
 *   PKCE S256; access_type=offline + prompt=consent to obtain a refresh_token.
 */

import { randomBytes, createHash } from "node:crypto"

// ─── Endpoints & Constants ──────────────────────────────────────

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
// Gmail's own profile endpoint — covered by gmail.readonly. (We deliberately do
// NOT use oauth2/v2/userinfo: it only returns `email` when the userinfo.email
// scope is granted, which our scope set is not, so it would always return null.)
const PROFILE_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/profile"

/** Minimal scope: read-only Gmail + openid (identity). */
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly openid"
const REQUEST_TIMEOUT_MS = 15_000

export const GMAIL_OAUTH_SCOPE = SCOPE

/** Redirect URI must exactly match a value registered on the Google web client. */
export const GMAIL_REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ??
  "http://localhost:3500/api/integrations/gmail/callback"

// ─── Types ──────────────────────────────────────────────────────

export interface GmailTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  id_token?: string
}

interface GmailClientConfig {
  clientId: string
  clientSecret: string
}

// ─── Config ─────────────────────────────────────────────────────

/**
 * Read the operator-supplied Google web client from env. Returns null when the
 * feature is not configured so callers can treat Gmail as "unavailable".
 */
export function getGmailClientConfig(): GmailClientConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

/** Like getGmailClientConfig but throws — for routes that require config. */
export function requireGmailClientConfig(): GmailClientConfig {
  const config = getGmailClientConfig()
  if (!config) {
    throw new Error(
      "Gmail OAuth not configured: set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET",
    )
  }
  return config
}

// ─── PKCE Helpers ───────────────────────────────────────────────

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/**
 * Generate a high-entropy PKCE code_verifier.
 * 32 random bytes → 43-char base64url string (within RFC 7636's 43-128 range).
 */
export function generateCodeVerifier(): string {
  return toBase64Url(randomBytes(32))
}

/** Derive the S256 code_challenge: base64url(sha256(verifier)). */
export function generateCodeChallenge(verifier: string): string {
  const digest = createHash("sha256").update(verifier).digest()
  return toBase64Url(digest)
}

/** Generate a random, opaque CSRF state value bound to the authorize request. */
export function generateState(): string {
  return toBase64Url(randomBytes(32))
}

// ─── Fetch Helper ───────────────────────────────────────────────

async function postForm(
  url: string,
  form: Record<string, string>,
): Promise<unknown> {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!resp.ok) {
    // Body may contain an OAuth error code but never the secrets we sent.
    const body = await resp.text().catch(() => "")
    throw new Error(`Gmail OAuth ${url} -> HTTP ${resp.status}: ${body.slice(0, 300)}`)
  }

  return resp.json()
}

// ─── Authorization URL ──────────────────────────────────────────

interface BuildAuthorizeUrlParams {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}

/**
 * Build the authorization_endpoint URL the user's browser is redirected to.
 * access_type=offline + prompt=consent force Google to return a refresh_token;
 * code_challenge_method is always S256.
 */
export function buildAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: BuildAuthorizeUrlParams): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  })
  return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`
}

// ─── Token Exchange ─────────────────────────────────────────────

interface ExchangeCodeParams {
  code: string
  codeVerifier: string
  clientId: string
  clientSecret: string
  redirectUri: string
}

/**
 * Exchange an authorization code for tokens. Confidential client: BOTH the
 * client_secret and the PKCE code_verifier are sent.
 */
export async function exchangeCode({
  code,
  codeVerifier,
  clientId,
  clientSecret,
  redirectUri,
}: ExchangeCodeParams): Promise<GmailTokenResponse> {
  const data = (await postForm(TOKEN_ENDPOINT, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  })) as GmailTokenResponse

  if (!data.access_token) {
    throw new Error("Gmail token exchange returned no access_token")
  }
  return data
}

// ─── Userinfo (account email) ───────────────────────────────────

interface GmailProfileResponse {
  emailAddress?: string
}

/**
 * Fetch the Google account email for a freshly issued access token. Used right
 * after exchangeCode so we can key the stored credential by account. Returns
 * null on any error so the caller can decide how to handle an unknown account.
 *
 * Uses the Gmail profile endpoint (gmail.readonly-covered) rather than
 * oauth2/v2/userinfo, which would require the separate userinfo.email scope.
 *
 * SECURITY: never log the access token or the full response.
 */
export async function fetchGmailAccountEmail(
  accessToken: string,
): Promise<string | null> {
  try {
    const resp = await fetch(PROFILE_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as GmailProfileResponse
    const email = data.emailAddress?.trim().toLowerCase()
    return email ? email : null
  } catch {
    return null
  }
}

// ─── Refresh ────────────────────────────────────────────────────

interface RefreshAccessTokenParams {
  refreshToken: string
  clientId: string
  clientSecret: string
}

/**
 * Use a refresh_token to obtain a fresh access_token. Google typically does NOT
 * rotate the refresh_token, so the response usually omits refresh_token.
 */
export async function refreshAccessToken({
  refreshToken,
  clientId,
  clientSecret,
}: RefreshAccessTokenParams): Promise<GmailTokenResponse> {
  const data = (await postForm(TOKEN_ENDPOINT, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })) as GmailTokenResponse

  if (!data.access_token) {
    throw new Error("Gmail token refresh returned no access_token")
  }
  return data
}
