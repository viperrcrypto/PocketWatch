/**
 * Kiwi client — free, keyless MCP (https://mcp.kiwi.com, bare root).
 * Adds cash flight inventory (Google-Flights-class data) to the search stack.
 *
 * Unlike Skiplagged, Kiwi enforces an MCP session: we must `initialize`,
 * capture the `Mcp-Session-Id` response header, then echo it (plus the
 * upgraded `Mcp-Protocol-Version`) on every subsequent request.
 *
 * KNOWN LIMITATION: Kiwi omits airline + flight-number fields, so
 * `airline`/`operatingAirlines`/`flightNumbers` are intentionally empty.
 */

import type { UnifiedFlightResult, SearchConfig } from "@/types/travel"
import { sanitizeExternalUrl } from "./url-safety"

const KIWI_MCP_URL = "https://mcp.kiwi.com"
const PROTOCOL_VERSION = "2025-06-18"
const INIT_PROTOCOL_VERSION = "2024-11-05"
const REQUEST_TIMEOUT_MS = 25_000

// Kiwi cabinClass letters: M (economy), W (premium economy), C (business), F (first)
type KiwiCabin = "M" | "W" | "C" | "F"

// SearchConfig.searchClass → Kiwi cabinClass letter
const CABIN_LETTER_MAP: Record<string, KiwiCabin> = {
  ECON: "M",
  PREM_ECON: "W",
  PREM: "W",
  BIZ: "C",
  FIRST: "F",
}

// Kiwi cabinClass letter → value-engine cabin label
const CABIN_LABEL_MAP: Record<KiwiCabin, string> = {
  M: "economy",
  W: "premium_economy",
  C: "business",
  F: "first",
}

export interface KiwiSearchConfig {
  origin: string
  destination: string
  /** ISO yyyy-mm-dd — converted to dd/mm/yyyy for the Kiwi request */
  departureDate: string
  searchClass: SearchConfig["searchClass"]
}

interface KiwiLayover {
  at?: string
  city?: string
  cityCode?: string
}

interface KiwiFlight {
  flyFrom?: string
  flyTo?: string
  cityFrom?: string
  cityTo?: string
  departure?: { utc?: string; local?: string }
  arrival?: { utc?: string; local?: string }
  totalDurationInSeconds?: number
  durationInSeconds?: number
  price?: number
  deepLink?: string
  currency?: string
  layovers?: KiwiLayover[]
}

/** Convert ISO yyyy-mm-dd → dd/mm/yyyy (Kiwi's required departureDate format). */
function toKiwiDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Kiwi: invalid ISO date "${iso}"`)
  const [year, month, day] = iso.split("-")
  return `${day}/${month}/${year}`
}

/** Parse an MCP streamable-HTTP body. Kiwi frames responses as SSE (`data: {json}`). */
function parseSsePayload(text: string): unknown {
  const trimmed = text.trimStart()
  if (trimmed.startsWith("{")) return JSON.parse(trimmed)

  let payload: unknown = null
  for (const line of text.split("\n")) {
    const t = line.trim()
    if (!t.startsWith("data:")) continue
    const body = t.slice(5).trim()
    if (!body || body === "[DONE]") continue
    try {
      const parsed = JSON.parse(body)
      if (parsed && typeof parsed === "object" && ("result" in parsed || "error" in parsed)) {
        payload = parsed
      }
    } catch {
      // ignore non-JSON keepalive frames
    }
  }
  if (payload === null) throw new Error("Kiwi: no JSON-RPC payload in response")
  return payload
}

/** Open an MCP session: `initialize` → capture session header → `notifications/initialized`. */
async function openSession(): Promise<string> {
  const res = await fetch(KIWI_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: INIT_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "pocketwatch", version: "1.0.0" },
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Kiwi MCP initialize HTTP ${res.status}`)

  const sessionId = res.headers.get("mcp-session-id")
  if (!sessionId) throw new Error("Kiwi MCP: no Mcp-Session-Id returned by initialize")

  const notifyRes = await fetch(KIWI_MCP_URL, {
    method: "POST",
    headers: sessionHeaders(sessionId),
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!notifyRes.ok) throw new Error(`Kiwi MCP initialized notification HTTP ${notifyRes.status}`)
  return sessionId
}

function sessionHeaders(sessionId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "Mcp-Session-Id": sessionId,
    "Mcp-Protocol-Version": PROTOCOL_VERSION,
  }
}

/** Call `tools/call` on an open session and return the parsed JSON-RPC payload. */
async function callKiwiTool(
  sessionId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<KiwiFlight[]> {
  const res = await fetch(KIWI_MCP_URL, {
    method: "POST",
    headers: sessionHeaders(sessionId),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Kiwi MCP tools/call HTTP ${res.status}`)

  const json = (await parseSsePayload(await res.text())) as {
    error?: { message?: string }
    result?: { content?: { type?: string; text?: string }[] }
  }
  if (json.error) throw new Error(`Kiwi MCP error: ${json.error.message ?? "unknown"}`)

  const text = json.result?.content?.[0]?.text
  if (!text) return []
  // content[0].text is a STRINGIFIED JSON array of flights — but Kiwi returns
  // plain prose (e.g. "No flights found...") for empty results, so guard the parse.
  const trimmed = text.trimStart()
  if (!trimmed.startsWith("[")) return []
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return Array.isArray(parsed) ? (parsed as KiwiFlight[]) : []
  } catch {
    return []
  }
}

function mapFlight(f: KiwiFlight, cabinLetter: KiwiCabin): UnifiedFlightResult | null {
  const origin = f.flyFrom
  const destination = f.flyTo
  if (!origin || !destination) return null

  const cabinLabel = CABIN_LABEL_MAP[cabinLetter]
  const totalSeconds = typeof f.totalDurationInSeconds === "number" ? f.totalDurationInSeconds : 0
  const departureLocal = f.departure?.local ?? ""

  return {
    id: f.deepLink ?? `kiwi-${origin}-${destination}-${departureLocal}`,
    // Kiwi is cash Google-Flights-class data; stay within the source union.
    source: "google",
    type: "cash",
    tags: ["kiwi"],
    origin,
    destination,
    // Kiwi omits airline + flight-number data — known limitation.
    airline: "",
    operatingAirlines: [],
    flightNumbers: [],
    stops: Array.isArray(f.layovers) ? f.layovers.length : 0,
    durationMinutes: Math.round(totalSeconds / 60),
    departureTime: departureLocal,
    arrivalTime: f.arrival?.local ?? "",
    airports: [origin, destination],
    cabinClass: cabinLabel,
    equipment: [],
    points: null,
    pointsProgram: null,
    cashPrice: typeof f.price === "number" ? f.price : null,
    taxes: 0,
    currency: f.currency ?? "USD",
    cppValue: null,
    roameScore: null,
    availableSeats: null,
    bookingUrl: sanitizeExternalUrl(f.deepLink),
    fareClass: cabinLabel,
  }
}

async function searchOneCabin(
  config: KiwiSearchConfig,
  cabinLetter: KiwiCabin,
): Promise<UnifiedFlightResult[]> {
  const args: Record<string, unknown> = {
    flyFrom: config.origin,
    flyTo: config.destination,
    departureDate: toKiwiDate(config.departureDate),
    passengers: { adults: 1, children: 0, infants: 0 },
    cabinClass: cabinLetter,
    sort: "price",
    curr: "USD",
    locale: "en",
  }

  const sessionId = await openSession()
  const flights = await callKiwiTool(sessionId, "search-flight", args)
  return flights
    .map((f) => mapFlight(f, cabinLetter))
    .filter((f): f is UnifiedFlightResult => f !== null)
}

/**
 * Search Kiwi for cash flights. Keyless (MCP session handshake handled internally).
 * "both" runs economy (M) and business (C) in parallel and merges — Kiwi accepts
 * one cabinClass per call, mirroring the Roame/Skiplagged pattern.
 */
export async function searchKiwiFlights(config: KiwiSearchConfig): Promise<UnifiedFlightResult[]> {
  const cabinLetters: KiwiCabin[] =
    config.searchClass === "both" ? ["M", "C"] : [CABIN_LETTER_MAP[config.searchClass] ?? "M"]

  const results = await Promise.allSettled(cabinLetters.map((c) => searchOneCabin(config, c)))
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
}
