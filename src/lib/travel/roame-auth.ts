/**
 * Roame auto-refresh via Firebase refresh token.
 *
 * Flow:
 * 1. Exchange Firebase refresh token for a new ID token
 * 2. Use ID token as Bearer auth for Roame GraphQL API
 * 3. If a session endpoint is discovered, exchange ID token for session cookie
 */

const FIREBASE_API_KEY = process.env.ROAME_FIREBASE_API_KEY || ""
const FIREBASE_TOKEN_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`

interface FirebaseTokenResponse {
  access_token: string
  expires_in: string
  token_type: string
  refresh_token: string
  id_token: string
  user_id: string
  project_id: string
}

export interface RefreshResult {
  idToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * Exchange a Firebase refresh token for a new ID token + refresh token.
 */
export async function refreshFirebaseToken(refreshToken: string): Promise<RefreshResult> {
  const resp = await fetch(FIREBASE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  })

  if (!resp.ok) {
    const body = await resp.text().catch(() => "")
    throw new Error(`Firebase token refresh failed: HTTP ${resp.status} — ${body.slice(0, 200)}`)
  }

  const data = (await resp.json()) as FirebaseTokenResponse

  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: parseInt(data.expires_in, 10),
  }
}

/**
 * Check if a JWT session token is expired (with 5-minute buffer).
 */
export function isSessionExpired(session: string): boolean {
  try {
    const payload = JSON.parse(atob(session.split(".")[1]!))
    if (!payload.exp) return false
    const bufferMs = 5 * 60 * 1000
    return payload.exp * 1000 < Date.now() + bufferMs
  } catch {
    return true
  }
}

/**
 * Build a Roame session from a Firebase ID token.
 * Uses the ID token directly as the session JWT (Bearer auth).
 * If we discover Roame's session endpoint, this function can be updated
 * to exchange the ID token for a proper session cookie.
 */
export function buildRoameSession(idToken: string): { session: string } {
  return { session: idToken }
}
