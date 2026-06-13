/**
 * Award Travel Finder (ATF) OAuth 2.1 client.
 *
 * Implements the authorization-code + PKCE public-client flow with RFC 7591
 * dynamic client registration. ATF exposes NO client_credentials grant, so a
 * one-time interactive browser authorize is required to obtain tokens.
 *
 * SECURITY: never log code_verifier, codes, access/refresh tokens, or
 * Authorization headers. All network calls use AbortSignal.timeout.
 *
 * Verified live metadata (2026-06-10):
 *   issuer                  https://awardtravelfinder.com
 *   authorization_endpoint  https://awardtravelfinder.com/oauth/authorize
 *   token_endpoint          https://awardtravelfinder.com/oauth/token
 *   registration_endpoint   https://awardtravelfinder.com/oauth/register
 *   revocation_endpoint     https://awardtravelfinder.com/oauth/revoke
 *   PKCE S256 REQUIRED; scopes ["mcp:read"]; token auth method "none".
 */

import { randomBytes, createHash } from "node:crypto"
import { db } from "@/lib/db"

// ─── Endpoints & Constants ──────────────────────────────────────

const AUTHORIZATION_ENDPOINT = "https://awardtravelfinder.com/oauth/authorize"
const TOKEN_ENDPOINT = "https://awardtravelfinder.com/oauth/token"
const REGISTRATION_ENDPOINT = "https://awardtravelfinder.com/oauth/register"

const CLIENT_NAME = "PocketWatch"
const SCOPE = "mcp:read"
const REQUEST_TIMEOUT_MS = 15_000

export const ATF_OAUTH_SCOPE = SCOPE

/** Redirect URI must exactly match the value registered with ATF. */
export const ATF_REDIRECT_URI =
  process.env.ATF_OAUTH_REDIRECT_URI ??
  "http://localhost:3500/api/travel/atf/callback"

// ─── Types ──────────────────────────────────────────────────────

export interface ATFTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

interface ATFRegistrationResponse {
  client_id: string
  client_id_issued_at?: number
  redirect_uris?: string[]
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
    throw new Error(`ATF OAuth ${url} -> HTTP ${resp.status}: ${body.slice(0, 300)}`)
  }

  return resp.json()
}

// ─── Dynamic Client Registration (RFC 7591) ─────────────────────

/**
 * Register PocketWatch as a public OAuth client with ATF.
 * Returns the issued client_id. Callers MUST cache this (it has no secret) so
 * registration happens once per deployment, not on every connect.
 */
export async function registerClient(): Promise<string> {
  const resp = await fetch(REGISTRATION_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      redirect_uris: [ATF_REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!resp.ok) {
    const body = await resp.text().catch(() => "")
    throw new Error(
      `ATF client registration failed: HTTP ${resp.status}: ${body.slice(0, 300)}`,
    )
  }

  const data = (await resp.json()) as ATFRegistrationResponse
  if (!data.client_id) {
    throw new Error("ATF client registration returned no client_id")
  }
  return data.client_id
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
 * code_challenge_method is always S256 (the only method ATF supports).
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
  })
  return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`
}

// ─── Token Exchange ─────────────────────────────────────────────

interface ExchangeCodeParams {
  code: string
  codeVerifier: string
  clientId: string
  redirectUri: string
}

/**
 * Exchange an authorization code for tokens.
 * Public client: no client_secret, PKCE code_verifier proves the request
 * originated from the same client that started the flow.
 */
export async function exchangeCode({
  code,
  codeVerifier,
  clientId,
  redirectUri,
}: ExchangeCodeParams): Promise<ATFTokenResponse> {
  const data = (await postForm(TOKEN_ENDPOINT, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  })) as ATFTokenResponse

  if (!data.access_token) {
    throw new Error("ATF token exchange returned no access_token")
  }
  return data
}

// ─── Refresh ────────────────────────────────────────────────────

interface RefreshAccessTokenParams {
  refreshToken: string
  clientId: string
}

/**
 * Use a refresh_token to obtain a fresh access_token (and possibly a rotated
 * refresh_token). Public client: client_id only, no secret.
 */
export async function refreshAccessToken({
  refreshToken,
  clientId,
}: RefreshAccessTokenParams): Promise<ATFTokenResponse> {
  const data = (await postForm(TOKEN_ENDPOINT, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  })) as ATFTokenResponse

  if (!data.access_token) {
    throw new Error("ATF token refresh returned no access_token")
  }
  return data
}

// ─── Stored Token Shape ─────────────────────────────────────────

// ─── Client ID Cache (one registration per deployment) ──────────

const CLIENT_SERVICE = "atf_oauth_client"

/**
 * Return a cached client_id for this user, registering once on first use.
 * The client_id is public (no secret) and stored plaintext in
 * FinanceCredential.encryptedKey for the "atf_oauth_client" service.
 */
export async function ensureClientId(userId: string): Promise<string> {
  const existing = await getStoredClientId(userId)
  if (existing) return existing

  // If this ran from the CALLBACK it would register a client_id that differs from
  // the one the authorize code was issued to → ATF returns invalid_grant. The
  // callback uses getStoredClientId (read-only) precisely so it can never do this.
  console.warn("[atf-oauth] registering a NEW dynamic client", { userId })
  const clientId = await registerClient()
  await db.financeCredential.upsert({
    where: { userId_service: { userId, service: CLIENT_SERVICE } },
    create: {
      userId,
      service: CLIENT_SERVICE,
      encryptedKey: clientId,
      encryptedSecret: clientId,
      environment: "production",
    },
    update: { encryptedKey: clientId },
  })
  return clientId
}

/**
 * Read the already-registered client_id WITHOUT registering a new one. The OAuth
 * callback must use this (never ensureClientId) so the token exchange always uses
 * the exact client_id the authorize code was issued to.
 */
export async function getStoredClientId(userId: string): Promise<string | null> {
  const existing = await db.financeCredential.findUnique({
    where: { userId_service: { userId, service: CLIENT_SERVICE } },
    select: { encryptedKey: true },
  })
  return existing?.encryptedKey ?? null
}

// ─── Stored Token Shape ─────────────────────────────────────────

/** JSON payload stored (encrypted) in FinanceCredential.encryptedKey. */
export interface ATFStoredTokens {
  access: string
  refresh: string | null
  expiresAt: number | null
}

/** Build the stored-token JSON from a token response (epoch-ms expiry). */
export function toStoredTokens(token: ATFTokenResponse): ATFStoredTokens {
  return {
    access: token.access_token,
    refresh: token.refresh_token ?? null,
    expiresAt:
      typeof token.expires_in === "number"
        ? Date.now() + token.expires_in * 1000
        : null,
  }
}
