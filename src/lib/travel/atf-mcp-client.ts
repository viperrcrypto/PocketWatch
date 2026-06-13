/**
 * Award Travel Finder (ATF) MCP client — OAuth 2.1 Bearer-token edition.
 *
 * Replaces the legacy `atf-client.ts` (X-API-Key + per-airline fan-out) and the
 * SSE "data:" parser. The live ATF MCP server now:
 *   - 401s without a Bearer access token (OAuth 2.1 auth-code + PKCE public client),
 *   - returns PLAIN JSON-RPC (NOT SSE) from the JSON-RPC POST endpoint, and
 *   - exposes a single `search_all_airlines` tool that replaces the old ~22-call
 *     per-airline fan-out with ONE call.
 *
 * VERIFIED LIVE METADATA (2026-06-10):
 *   - MCP endpoint:        https://mcp.awardtravelfinder.com/mcp  (scope mcp:read)
 *   - Auth server issuer:  https://awardtravelfinder.com
 *
 * The interactive authorize / dynamic-client-registration / token exchange lives in
 * `./atf-oauth` (built separately). This file only consumes the stored tokens, calls
 * the tool, and maps results. It NEVER throws — every failure path returns null/[] so
 * the caller treats ATF as "not configured".
 *
 * ─── ASSUMPTIONS (no live token available to verify the tool schema) ───
 * 1. Stored credential: FinanceCredential service "atf_oauth", with
 *      encryptedKey    = access token,
 *      encryptedSecret = refresh token,
 *      environment     = access-token expiry epoch-ms as a string ("1718000000000").
 *    This mirrors the pointme/roame storage shape; `./atf-oauth` must persist it the
 *    same way (see persistAtfTokens below for the canonical writer).
 * 2. `search_all_airlines` arguments: { origin, destination, date } (IATA + YYYY-MM-DD)
 *    and returns availability shaped like the legacy per-airline ATF response, just
 *    aggregated into a list keyed by program/airline. We map defensively against both
 *    a flat `results[]` and a per-airline `airlines[]` shape, reusing the cabin/program
 *    conventions from `atf-client.ts` (ATF_AIRLINE_META).
 * Mark + re-verify these against a real response before shipping to production.
 */

import { db } from "@/lib/db"
import { decryptCredential, encryptCredential } from "@/lib/finance/crypto"
import { ATF_AIRLINE_META, type ATFAirline } from "./atf-client"
import { refreshAccessToken, ensureClientId } from "./atf-oauth"
import type { UnifiedFlightResult } from "@/types/travel"

const ATF_MCP_URL = "https://mcp.awardtravelfinder.com/mcp"
const ATF_OAUTH_SERVICE = "atf_oauth"
// A single live multi-carrier scrape can take ~30-60s; 30s timed out on cold calls.
const REQUEST_TIMEOUT_MS = 90_000
const EXPIRY_BUFFER_MS = 60_000 // refresh 1 min early
// ATF's gateway 502s under concurrency, so we run searches strictly one-at-a-time
// (the orchestrator fires legs/cabins in parallel) with a small gap to let it breathe.
const ATF_INTER_CALL_GAP_MS = 750

// ─── Token storage (FinanceCredential "atf_oauth") ──────────────────────

interface AtfTokens {
  accessToken: string
  refreshToken: string
  /** Access-token expiry, epoch ms. */
  expiresAt: number
}

/**
 * Persist a fresh ATF token set. Shared writer so `./atf-oauth` (initial connect)
 * and this client (post-refresh) store the exact same shape. Exported so the OAuth
 * callback route can reuse it instead of re-implementing the upsert.
 */
export async function persistAtfTokens(userId: string, tokens: AtfTokens): Promise<void> {
  const encryptedKey = await encryptCredential(tokens.accessToken)
  const encryptedSecret = await encryptCredential(tokens.refreshToken)
  await db.financeCredential.upsert({
    where: { userId_service: { userId, service: ATF_OAUTH_SERVICE } },
    create: {
      userId,
      service: ATF_OAUTH_SERVICE,
      encryptedKey,
      encryptedSecret,
      environment: String(tokens.expiresAt),
    },
    update: { encryptedKey, encryptedSecret, environment: String(tokens.expiresAt) },
  })
}

async function loadAtfTokens(userId: string): Promise<AtfTokens | null> {
  const cred = await db.financeCredential.findUnique({
    where: { userId_service: { userId, service: ATF_OAUTH_SERVICE } },
  })
  if (!cred) return null
  try {
    const accessToken = await decryptCredential(cred.encryptedKey)
    const refreshToken = await decryptCredential(cred.encryptedSecret)
    const expiresAt = Number(cred.environment)
    if (!accessToken || !refreshToken) return null
    return { accessToken, refreshToken, expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0 }
  } catch {
    return null
  }
}

// ─── getAtfAccessToken ──────────────────────────────────────────────────

/**
 * Return a valid ATF access token for the user, refreshing if expired.
 * Returns null when there is no atf_oauth connection or the refresh fails —
 * callers must treat null as "ATF not configured" (never throw).
 */
// Single-flight refresh per user: parallel search legs must not each refresh the
// same token, or the OAuth server's refresh-token reuse detection revokes the grant.
const refreshInFlight = new Map<string, Promise<string | null>>()

async function doRefresh(userId: string, tokens: AtfTokens): Promise<string | null> {
  try {
    const clientId = await ensureClientId(userId)
    const refreshed = await refreshAccessToken({ refreshToken: tokens.refreshToken, clientId })
    const next: AtfTokens = {
      accessToken: refreshed.access_token,
      // OAuth servers may rotate the refresh token; fall back to the old one.
      refreshToken: refreshed.refresh_token || tokens.refreshToken,
      expiresAt:
        typeof refreshed.expires_in === "number"
          ? Date.now() + refreshed.expires_in * 1000
          : tokens.expiresAt,
    }
    await persistAtfTokens(userId, next)
    return next.accessToken
  } catch (err) {
    console.warn("[travel] ATF token refresh failed:", (err as Error).message)
    return null
  }
}

export async function getAtfAccessToken(userId: string): Promise<string | null> {
  const tokens = await loadAtfTokens(userId)
  if (!tokens) return null

  if (Date.now() < tokens.expiresAt - EXPIRY_BUFFER_MS) {
    return tokens.accessToken
  }

  const existing = refreshInFlight.get(userId)
  if (existing) return existing

  const promise = doRefresh(userId, tokens).finally(() => refreshInFlight.delete(userId))
  refreshInFlight.set(userId, promise)
  return promise
}

// ─── Low-level JSON-RPC tools/call ──────────────────────────────────────

interface JsonRpcResult {
  result?: { structuredContent?: unknown; content?: { type: string; text: string }[] }
  error?: { message?: string }
}

/**
 * POST a JSON-RPC tools/call to the ATF MCP endpoint with a Bearer token.
 * Parses PLAIN JSON (preferred). Falls back to extracting a `data:` SSE frame
 * defensively, in case the server ever streams. Returns the tool's
 * structuredContent (or the parsed text content), or null on any failure.
 */
export async function callAtfMcp(
  accessToken: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown | null> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  })

  // search_all_airlines is heavy (live multi-carrier scrape); ATF's gateway 502s
  // when hit too fast or in parallel. Run serialized + retry transient 5xx/429/
  // timeouts with jittered backoff so a flaky response doesn't become 0 results.
  const raw = await runSerial(() => fetchWithRetry(body, accessToken, toolName))
  if (raw === null) return null

  const parsed = parseJsonRpc(raw)
  if (!parsed) return null
  if (parsed.error) {
    console.warn(`[travel] ATF MCP tool error (${toolName}):`, parsed.error.message)
    return null
  }

  // Prefer structuredContent; else parse the text content block as JSON.
  const structured = parsed.result?.structuredContent
  if (structured !== undefined) return structured

  const text = parsed.result?.content?.find((c) => c.type === "text")?.text
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const ATF_MAX_ATTEMPTS = 3
const ATF_RETRY_STATUS = new Set([429, 500, 502, 503, 504])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Serialize ALL ATF MCP calls in this process: concurrent heavy searches make
// ATF's gateway 502 / time out, so callers (parallel search legs) queue here and
// run one at a time, with a short gap between calls.
let atfQueue: Promise<unknown> = Promise.resolve()
function runSerial<T>(fn: () => Promise<T>): Promise<T> {
  const result = atfQueue.then(fn, fn)
  // Keep the chain alive (and gapped) regardless of success/failure.
  atfQueue = result.then(() => sleep(ATF_INTER_CALL_GAP_MS), () => sleep(ATF_INTER_CALL_GAP_MS))
  return result
}

/**
 * POST to the ATF MCP endpoint, retrying transient failures (5xx/429/timeout)
 * with jittered exponential backoff. Returns the raw body, or null when every
 * attempt failed or a non-retryable status was returned.
 */
async function fetchWithRetry(
  body: string,
  accessToken: string,
  toolName: string,
): Promise<string | null> {
  for (let attempt = 1; attempt <= ATF_MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(ATF_MCP_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (resp.ok) return resp.text()

      if (ATF_RETRY_STATUS.has(resp.status) && attempt < ATF_MAX_ATTEMPTS) {
        const backoff = 1500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 1000)
        console.warn(`[travel] ATF MCP HTTP ${resp.status} for ${toolName} — retry ${attempt}/${ATF_MAX_ATTEMPTS - 1} in ${backoff}ms`)
        await sleep(backoff)
        continue
      }
      console.warn(`[travel] ATF MCP HTTP ${resp.status} for ${toolName} (giving up)`)
      return null
    } catch (err) {
      // Timeout / network error — retry the remaining attempts.
      if (attempt < ATF_MAX_ATTEMPTS) {
        const backoff = 1500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 1000)
        console.warn(`[travel] ATF MCP request failed (${toolName}): ${(err as Error).message} — retry ${attempt}/${ATF_MAX_ATTEMPTS - 1} in ${backoff}ms`)
        await sleep(backoff)
        continue
      }
      console.warn(`[travel] ATF MCP request failed (${toolName}): ${(err as Error).message} (giving up)`)
      return null
    }
  }
  return null
}

/** Parse plain JSON-RPC; fall back to a `data:` SSE frame only if needed. */
function parseJsonRpc(raw: string): JsonRpcResult | null {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as JsonRpcResult
  } catch {
    // Defensive: tolerate an SSE-framed body. Use the LAST data: frame, since the
    // result may follow earlier notification frames.
    const frames = [...trimmed.matchAll(/^data:\s*(.+)$/gm)].map((m) => m[1])
    for (const frame of frames.reverse()) {
      try {
        return JSON.parse(frame) as JsonRpcResult
      } catch {
        // try the next-earlier frame
      }
    }
    return null
  }
}

// ─── search_all_airlines → UnifiedFlightResult[] ────────────────────────

/** One cabin's award availability, mirroring the legacy ATF cabin shape. */
interface AtfCabin {
  available?: boolean
  seats?: number
  points?: number
  taxes?: number
  taxes_currency?: string
}

/** One airline/program entry inside the aggregated search_all_airlines result. */
interface AtfAirlineEntry {
  airline?: string
  program?: string
  cabins?: Record<string, AtfCabin>
}

const CABIN_LABELS = ["economy", "premium_economy", "business", "first"] as const

/** Resolve airline metadata from an ATF slug, falling back gracefully. */
function resolveMeta(slug: string): { name: string; programKey: string } {
  const meta = ATF_AIRLINE_META[slug as ATFAirline]
  if (meta) return { name: meta.name, programKey: meta.programKey }
  return { name: slug, programKey: slug.toUpperCase() }
}

/** GBP→USD fixed conversion, matching legacy atf-client.ts behavior. */
function taxesToUsd(cabin: AtfCabin): number {
  const taxes = cabin.taxes ?? 0
  return cabin.taxes_currency === "GBP" ? Math.round(taxes * 1.27) : taxes
}

function mapAirlineEntry(
  entry: AtfAirlineEntry,
  origin: string,
  destination: string,
  date: string,
): UnifiedFlightResult[] {
  const slug = entry.airline ?? entry.program ?? ""
  if (!slug || !entry.cabins) return []
  const { name, programKey } = resolveMeta(slug)
  const results: UnifiedFlightResult[] = []

  for (const cabinKey of CABIN_LABELS) {
    const cabin = entry.cabins[cabinKey]
    if (!cabin?.available || !cabin.points) continue

    results.push({
      id: `atf-${slug}-${cabinKey}-${origin}-${destination}-${date}`,
      source: "atf",
      type: "award",
      origin,
      destination,
      airline: name,
      operatingAirlines: [name],
      flightNumbers: [],
      stops: 0,
      durationMinutes: 0,
      departureTime: date,
      arrivalTime: date,
      airports: [origin, destination],
      cabinClass: cabinKey,
      equipment: [],
      points: cabin.points,
      pointsProgram: programKey,
      cashPrice: null,
      taxes: taxesToUsd(cabin),
      currency: "USD",
      cppValue: null,
      roameScore: null,
      availableSeats: cabin.seats ?? null,
      bookingUrl: "https://awardtravelfinder.com",
      fareClass: `atf:${programKey}:${cabinKey}`,
      travelDate: date,
    })
  }

  return results
}

/**
 * Pull the flight entry list from the live response. Verified against the real
 * search_all_airlines structuredContent (2026-06-12): results live under
 * `flights`. Older assumed keys kept as defensive fallbacks.
 */
function extractEntries(payload: unknown): AtfAirlineEntry[] {
  if (Array.isArray(payload)) return payload as AtfAirlineEntry[]
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>
    if (Array.isArray(obj.flights)) return obj.flights as AtfAirlineEntry[]
    if (Array.isArray(obj.airlines)) return obj.airlines as AtfAirlineEntry[]
    if (Array.isArray(obj.results)) return obj.results as AtfAirlineEntry[]
    if (Array.isArray(obj.data)) return obj.data as AtfAirlineEntry[]
  }
  return []
}

/**
 * Search ATF award availability for one route + date via the single
 * `search_all_airlines` tool (replaces the legacy per-airline fan-out).
 * Returns [] on no connection, refresh failure, or any error — never throws.
 */
export async function searchAtfAwards(
  userId: string,
  origin: string,
  destination: string,
  date: string,
  cabin: "economy" | "premium_economy" | "business" | "first" = "economy",
): Promise<UnifiedFlightResult[]> {
  const accessToken = await getAtfAccessToken(userId)
  if (!accessToken) return []

  // The live tool requires departure_code / arrival_code (NOT origin/destination)
  // and a single cabin per call; wrong names previously failed with "Invalid params".
  const payload = await callAtfMcp(accessToken, "search_all_airlines", {
    departure_code: origin,
    arrival_code: destination,
    date,
    cabin,
  })
  if (!payload) return []

  const entries = extractEntries(payload)
  const mapped = entries.flatMap((entry) => mapAirlineEntry(entry, origin, destination, date))

  // The per-flight entry shape inside `flights[]` is not yet verified against a
  // non-empty live result. If ATF returns flights none of which map, log the raw
  // shape once so the mapper can be finalized from real data (not another guess).
  if (entries.length > 0 && mapped.length === 0) {
    console.warn(
      `[travel] ATF returned ${entries.length} flight(s) but none mapped — entry shape:`,
      JSON.stringify(entries[0]).slice(0, 600),
    )
  }
  return mapped
}
