/**
 * Plaid webhook signature verification.
 *
 * Plaid signs webhooks with a JWS in the `Plaid-Verification` header.
 * We verify the signature using Plaid's JWKS endpoint to reject forged requests.
 *
 * @see https://plaid.com/docs/api/webhooks/webhook-verification/
 */

import * as jose from "jose"

const PLAID_JWKS_URL = "https://production.plaid.com/webhook_verification_key/get"

// Cache JWKS for 24h to avoid hitting Plaid on every webhook
let cachedJwks: jose.JSONWebKeySet | null = null
let cachedAt = 0
const JWKS_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Verify a Plaid webhook request's JWS signature.
 *
 * @returns true if signature is valid, false otherwise
 */
export async function verifyPlaidWebhook(
  body: string,
  verificationHeader: string | null
): Promise<boolean> {
  if (!verificationHeader) return false

  try {
    // Decode the JWS header to get the key ID
    const protectedHeader = jose.decodeProtectedHeader(verificationHeader)
    const kid = protectedHeader.kid
    if (!kid) return false

    // Fetch or use cached JWKS
    const jwks = await getPlaidJwks()
    if (!jwks) return false

    // Find the matching key
    const key = jwks.keys.find((k) => k.kid === kid)
    if (!key) {
      // Key not in cache — force refresh and retry once
      cachedJwks = null
      cachedAt = 0
      const refreshed = await getPlaidJwks()
      const retryKey = refreshed?.keys.find((k) => k.kid === kid)
      if (!retryKey) return false
      return await verifyWithKey(body, verificationHeader, retryKey)
    }

    return await verifyWithKey(body, verificationHeader, key)
  } catch (err) {
    console.error("[webhook.verify.failed]", {
      message: err instanceof Error ? err.message : "Unknown error",
    })
    return false
  }
}

async function verifyWithKey(
  body: string,
  jws: string,
  jwk: jose.JWK
): Promise<boolean> {
  const publicKey = await jose.importJWK(jwk, "ES256")
  const { payload } = await jose.compactVerify(jws, publicKey)

  // Plaid includes the request body SHA-256 in the payload
  let decoded: Record<string, unknown>
  try {
    decoded = JSON.parse(new TextDecoder().decode(payload))
  } catch {
    return false
  }
  const expectedHash = decoded.request_body_sha256

  if (!expectedHash) return false

  // Compute SHA-256 of the raw body
  const bodyBuffer = new TextEncoder().encode(body)
  const hashBuffer = await crypto.subtle.digest("SHA-256", bodyBuffer)
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Verify body hash matches
  if (hashHex !== expectedHash) return false

  // Verify timestamp is within 5 minutes (required)
  const issuedAt = decoded.iat
  if (typeof issuedAt !== "number") return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - issuedAt) > 300) return false

  return true
}

async function getPlaidJwks(): Promise<jose.JSONWebKeySet | null> {
  const now = Date.now()
  if (cachedJwks && now - cachedAt < JWKS_TTL_MS) {
    return cachedJwks
  }

  try {
    // Plaid exposes keys via their verification endpoint
    // In production, use the proper Plaid client to fetch keys.
    // For now, use the standard JWKS discovery.
    const res = await fetch("https://production.plaid.com/.well-known/jwks.json", {
      headers: { "Content-Type": "application/json" },
    })

    if (!res.ok) return null

    const jwks = (await res.json()) as jose.JSONWebKeySet
    cachedJwks = jwks
    cachedAt = now
    return jwks
  } catch {
    return cachedJwks // Return stale cache on failure
  }
}
