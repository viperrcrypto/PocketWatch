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

/**
 * Extract a Firebase `stsTokenManager` from an arbitrarily-nested object.
 * The IndexedDB record may be the auth user itself ({ stsTokenManager }) or
 * wrapped one level deep ({ value: { stsTokenManager } } / { fbase_key, value }).
 */
function findStsTokenManager(obj: unknown): { accessToken?: string; refreshToken?: string } | null {
  if (!obj || typeof obj !== "object") return null
  const rec = obj as Record<string, unknown>
  const direct = rec.stsTokenManager
  if (direct && typeof direct === "object") {
    return direct as { accessToken?: string; refreshToken?: string }
  }
  if (rec.value && typeof rec.value === "object") {
    return findStsTokenManager(rec.value)
  }
  return null
}

/**
 * Parse a Roame credential blob — deliberately forgiving so the user can paste
 * whatever they have without reformatting. Accepts:
 * - Raw Firebase ID token (eyJ...) — session only, no auto-refresh
 * - The full `firebase:authUser:...` IndexedDB value as JSON (object or
 *   `{ value: {...} }` wrapper) — extracts the ID token + refresh token.
 * - The DevTools/console object DUMP of that value (not valid JSON) — tokens are
 *   pulled out by regex.
 * - Backward-compat `{ session }` JSON.
 *
 * Returns the session JWT and the refresh token (null when only an ID token was given).
 */
export function parseRoameCredential(input: string): { session: string; refreshToken: string | null } {
  const trimmed = input.trim()

  // Raw JWT pasted on its own.
  if (trimmed.startsWith("eyJ") && !trimmed.includes("{") && !/\s/.test(trimmed)) {
    return { session: trimmed, refreshToken: null }
  }

  // Structured JSON path (the cleanest input).
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>
      const sts = findStsTokenManager(obj)
      if (typeof sts?.accessToken === "string" && sts.accessToken.startsWith("eyJ")) {
        return { session: sts.accessToken, refreshToken: typeof sts.refreshToken === "string" ? sts.refreshToken : null }
      }
      if (typeof obj.session === "string") {
        return { session: obj.session, refreshToken: typeof obj.refreshToken === "string" ? obj.refreshToken : null }
      }
    }
  } catch {
    // Not JSON — fall through to loose extraction.
  }

  // Loose fallback: pull the tokens out of ANY pasted text (e.g. a DevTools object
  // dump where keys/values sit on separate lines and aren't quoted as JSON).
  // The access token is the only JWT in the blob; the refresh token is labelled.
  const jwt = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
  if (jwt) {
    const refresh = trimmed.match(/refreshToken["']?\s*:?\s*["']([^"'\s]{20,})["']/)
    return { session: jwt[0], refreshToken: refresh ? refresh[1] : null }
  }

  throw new Error("Couldn't find a Roame token — paste the firebase:authUser value (or copy it from DevTools)")
}

/**
 * Extract just the Firebase REFRESH token from a paste into the dedicated
 * "Roame refresh token" field — accepts the bare token, the full firebase:authUser
 * JSON, or the raw DevTools object dump. (The main session field auto-captures the
 * refresh token; this keeps the legacy refresh field forgiving too.)
 */
export function extractRefreshToken(input: string): string {
  const trimmed = input.trim()

  // Bare token pasted on its own (opaque, no JSON / whitespace).
  if (!trimmed.includes("{") && !/\s/.test(trimmed) && trimmed.length >= 20) {
    return trimmed
  }

  // Structured JSON (firebase:authUser value or { value } wrapper).
  try {
    const sts = findStsTokenManager(JSON.parse(trimmed))
    if (typeof sts?.refreshToken === "string" && sts.refreshToken.length >= 20) {
      return sts.refreshToken
    }
  } catch {
    // fall through to loose extraction
  }

  // Loose: pull a labelled refreshToken out of a DevTools dump.
  const m = trimmed.match(/refreshToken["']?\s*:?\s*["']([^"'\s]{20,})["']/)
  if (m) return m[1]

  throw new Error("Couldn't find a refresh token — paste the firebase:authUser value or the refresh token itself")
}
