/**
 * Internal Bearer-secret auth for cron workers and machine endpoints.
 *
 * These routes have no session — they are gated on a static env secret sent as
 * `Authorization: Bearer <secret>`. Auth is fail-closed: a missing or weak
 * (<32 char) secret never authorizes. The compare is timing-safe behind a
 * length-equality guard (same pattern as the MCP server and desktop-status).
 *
 * Failed attempts are rate-limited per client (brute-force defense); callers
 * must only consult the failure limiter AFTER auth has failed so legitimate
 * authed callers (e.g. the localhost cron) are never throttled.
 */

import { timingSafeEqual } from "crypto"
import { checkRateLimit, createRateLimiter, getClientId } from "@/lib/rate-limit"

/** Refuse weak secrets — generate with `openssl rand -hex 32`. */
const MIN_SECRET_LENGTH = 32

/**
 * Fail-closed Bearer auth. Returns true only when `secret` is set, meets the
 * length floor, AND the Authorization header carries an exactly-matching
 * token. Uses a timing-safe compare over equal-length buffers; differing
 * lengths short-circuit to false.
 */
export function isAuthorizedBearer(request: Request, secret: string): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false
  const header = request.headers.get("authorization") ?? ""
  if (!header.startsWith("Bearer ")) return false
  const provided = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

/** Failed internal-auth attempts: 10 per minute per client. */
const authFailureLimiter = createRateLimiter({ limit: 10, windowSeconds: 60 })

/**
 * Throttle ONLY failed auth attempts. Call this AFTER a Bearer auth failure —
 * never on the success path — so the legitimate cron is never rate-limited.
 * When `ok` is false the caller should return 429 with the provided headers;
 * otherwise fall through to the normal 401.
 */
export function checkAuthFailureLimit(
  request: Request
): ReturnType<typeof checkRateLimit> {
  return checkRateLimit(authFailureLimiter, `internal-auth-fail:${getClientId(request)}`)
}
