/**
 * Trivago client — free, keyless MCP (https://mcp.trivago.com/mcp).
 * Adds OTA-aggregated cash hotel prices (Booking/Expedia/Agoda/Hotels.com).
 *
 * Trivago returns EUR only (no currency param), so prices are converted to USD
 * via the free Frankfurter ECB endpoint. Responses embed an LLM-directed
 * `system_message` which we deliberately ignore (prompt-injection hygiene) —
 * we read only structuredContent.accommodations. Transport is plain JSON, and
 * the server enforces an MCP session header like Kiwi.
 */

import type { UnifiedHotelResult } from "@/types/travel"
import { sanitizeExternalUrl } from "./url-safety"

const TRIVAGO_MCP_URL = "https://mcp.trivago.com/mcp"
const PROTOCOL_VERSION = "2025-06-18"
const INIT_PROTOCOL_VERSION = "2024-11-05"
const REQUEST_TIMEOUT_MS = 25_000
const FX_URL = "https://api.frankfurter.app/latest?from=EUR&to=USD"

export interface TrivagoSearchConfig {
  query: string
  /** ISO yyyy-mm-dd check-in */
  checkInDate: string
  /** ISO yyyy-mm-dd check-out */
  checkOutDate: string
  adults: number
}

interface TrivagoSuggestion {
  id?: number
  ns?: number
  location?: string
}

interface TrivagoAccommodation {
  accommodation_id?: number | string
  accommodation_name?: string
  address?: string
  currency?: string
  price_per_night?: string
  price_per_stay?: string
  hotel_rating?: number
  review_rating?: string
  review_count?: number
  top_amenities?: string
  accommodation_url?: string
  latitude?: number
  longitude?: number
  main_image?: string
  description?: string
}

function sessionHeaders(sessionId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Mcp-Session-Id": sessionId,
    "Mcp-Protocol-Version": PROTOCOL_VERSION,
  }
}

/** Open an MCP session: initialize → capture session header → notifications/initialized. */
async function openSession(): Promise<string> {
  const res = await fetch(TRIVAGO_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
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
  if (!res.ok) throw new Error(`Trivago MCP initialize HTTP ${res.status}`)

  const sessionId = res.headers.get("mcp-session-id")
  if (!sessionId) throw new Error("Trivago MCP: no Mcp-Session-Id returned by initialize")

  const notifyRes = await fetch(TRIVAGO_MCP_URL, {
    method: "POST",
    headers: sessionHeaders(sessionId),
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!notifyRes.ok) throw new Error(`Trivago MCP initialized notification HTTP ${notifyRes.status}`)
  return sessionId
}

/** Call a tool and return its structuredContent (plain JSON transport). */
async function callTrivago(
  sessionId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(TRIVAGO_MCP_URL, {
    method: "POST",
    headers: sessionHeaders(sessionId),
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Trivago MCP tools/call HTTP ${res.status}`)

  const json = (await res.json()) as {
    error?: { message?: string }
    result?: { structuredContent?: Record<string, unknown> }
  }
  if (json.error) throw new Error(`Trivago MCP error: ${json.error.message ?? "unknown"}`)
  // Read only structuredContent — never the system_message/text envelope.
  return json.result?.structuredContent ?? {}
}

/** Strip the currency glyph + thousands separators from a price string like "€1,257". */
function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.]/g, "")
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** EUR→USD rate from Frankfurter; null if unavailable (caller keeps EUR). */
async function fetchEurToUsd(): Promise<number | null> {
  try {
    const res = await fetch(FX_URL, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!res.ok) return null
    const json = (await res.json()) as { rates?: { USD?: number } }
    const rate = json.rates?.USD
    return typeof rate === "number" && rate > 0 ? rate : null
  } catch {
    return null
  }
}

function mapAccommodation(a: TrivagoAccommodation, usdRate: number | null): UnifiedHotelResult | null {
  const name = a.accommodation_name
  if (!name) return null

  const eurNight = parsePrice(a.price_per_night)
  const eurStay = parsePrice(a.price_per_stay)
  const toUsd = (eur: number | null) => (eur !== null && usdRate !== null ? Math.round(eur * usdRate) : eur)
  const cashPerNight = toUsd(eurNight)
  const cashTotal = toUsd(eurStay)
  const currency = usdRate !== null ? "USD" : a.currency ?? "EUR"

  return {
    id: a.accommodation_id != null ? `trivago-${a.accommodation_id}` : `trivago-${name}`,
    name,
    description: a.description ?? "",
    location: a.address ?? "",
    hotelClass: typeof a.hotel_rating === "number" ? a.hotel_rating : 0,
    overallRating: a.review_rating ? Number(a.review_rating) || 0 : 0,
    reviews: typeof a.review_count === "number" ? a.review_count : 0,
    amenities: a.top_amenities ? a.top_amenities.split(",").map((s) => s.trim()).filter(Boolean) : [],
    images: [sanitizeExternalUrl(a.main_image)].filter(Boolean),
    cashPerNight,
    cashTotal,
    currency,
    bookingLinks: sanitizeExternalUrl(a.accommodation_url)
      ? [{ source: "trivago", link: sanitizeExternalUrl(a.accommodation_url), rate: cashPerNight ?? 0 }]
      : [],
    pointsPerNight: null,
    pointsProgram: null,
    brand: null,
    subBrand: null,
    hotelCode: null,
    latitude: typeof a.latitude === "number" ? a.latitude : null,
    longitude: typeof a.longitude === "number" ? a.longitude : null,
    sources: ["trivago"],
  }
}

/**
 * Search Trivago for cash hotel prices. Keyless. Resolves the query to a
 * location id via trivago-search-suggestions, then runs accommodation-search.
 * Returns [] on any failure so the hotel orchestrator never crashes.
 */
export async function searchTrivagoHotels(config: TrivagoSearchConfig): Promise<UnifiedHotelResult[]> {
  try {
    const sessionId = await openSession()

    const suggestRes = (await callTrivago(sessionId, "trivago-search-suggestions", {
      query: config.query,
    })) as { suggestions?: TrivagoSuggestion[] }
    const first = suggestRes.suggestions?.[0]
    if (!first || first.id == null || first.ns == null) return []

    const [searchRes, usdRate] = await Promise.all([
      callTrivago(sessionId, "trivago-accommodation-search", {
        id: first.id,
        ns: first.ns,
        arrival: config.checkInDate,
        departure: config.checkOutDate,
        adults: config.adults,
        rooms: 1,
      }) as Promise<{ accommodations?: TrivagoAccommodation[] }>,
      fetchEurToUsd(),
    ])

    const accommodations = searchRes.accommodations
    if (!Array.isArray(accommodations)) return []
    return accommodations
      .map((a) => mapAccommodation(a, usdRate))
      .filter((h): h is UnifiedHotelResult => h !== null)
  } catch (err) {
    console.error("[travel] Trivago hotel search failed:", (err as Error).message)
    return []
  }
}
