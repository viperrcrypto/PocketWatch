/**
 * Skiplagged client — free, keyless MCP (https://mcp.skiplagged.com/mcp).
 * Adds cash + hidden-city flight inventory the SerpAPI/Roame stack can't see.
 * Hidden-city itineraries populate the reserved source:"hidden-city" slot.
 */

import type { UnifiedFlightResult, SearchConfig } from "@/types/travel"
import { sanitizeExternalUrl } from "./url-safety"

const SKIPLAGGED_MCP_URL = "https://mcp.skiplagged.com/mcp"
const REQUEST_TIMEOUT_MS = 20_000
const DEFAULT_LIMIT = 20

// SearchConfig.searchClass → Skiplagged fareClass (words, not codes)
const FARE_CLASS_MAP: Record<string, string> = {
  ECON: "economy",
  PREM_ECON: "premium",
  PREM: "premium",
  BIZ: "business",
  FIRST: "first",
}

// Skiplagged fareClass → the cabin label value-engine.ts scores on
const CABIN_LABEL_MAP: Record<string, string> = {
  "basic-economy": "economy",
  economy: "economy",
  premium: "premium_economy",
  business: "business",
  first: "first",
}

export interface SkiplaggedSearchConfig {
  origin: string
  destination: string
  /** ISO yyyy-mm-dd — matches Skiplagged's expected format directly */
  departureDate: string
  returnDate?: string
  searchClass: SearchConfig["searchClass"]
  limit?: number
}

interface SkiplaggedFlight {
  id?: string
  airlines?: string
  departure?: { airport?: string; dateTime?: string }
  arrival?: { airport?: string; dateTime?: string }
  duration?: string
  layovers?: number
  price?: { amount?: number; currency?: string }
  deepLink?: string
  attributes?: string[]
}

/**
 * Parse an MCP streamable-HTTP response. Skiplagged frames results as SSE
 * (`event: message\ndata: {json}`) but a plain-JSON body is tolerated too.
 */
async function parseMcpResponse(res: Response): Promise<unknown> {
  const text = await res.text()
  const trimmed = text.trimStart()
  if (trimmed.startsWith("{")) return JSON.parse(trimmed)

  // SSE: collect the data: payloads, return the last one carrying a result/error
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
  if (payload === null) throw new Error("Skiplagged: no JSON-RPC payload in response")
  return payload
}

async function callSkiplaggedTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(SKIPLAGGED_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Skiplagged MCP HTTP ${res.status}`)

  const json = (await parseMcpResponse(res)) as {
    error?: { message?: string }
    result?: { structuredContent?: { flights?: SkiplaggedFlight[] } }
  }
  if (json.error) throw new Error(`Skiplagged MCP error: ${json.error.message ?? "unknown"}`)
  return json.result?.structuredContent ?? {}
}

function parseDurationMinutes(duration: string | undefined): number {
  if (!duration) return 0
  const match = duration.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/)
  if (!match) return 0
  const hours = match[1] ? parseInt(match[1], 10) : 0
  const mins = match[2] ? parseInt(match[2], 10) : 0
  return hours * 60 + mins
}

/** Flight numbers live in the id trip token, e.g. "...-trip=DL742,UA6825~". */
function parseFlightNumbers(id: string | undefined): string[] {
  if (!id) return []
  const idx = id.indexOf("trip=")
  if (idx === -1) return []
  return id
    .slice(idx + 5)
    .replace(/~$/, "") // strip the hidden-city marker
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function mapFlight(f: SkiplaggedFlight, cabinLabel: string, fareClass: string): UnifiedFlightResult | null {
  const origin = f.departure?.airport
  const destination = f.arrival?.airport
  if (!origin || !destination) return null

  const isHiddenCity = (f.attributes ?? []).includes("hidden-city")
  const airline = f.airlines ?? ""

  return {
    id: f.id ?? `skiplagged-${origin}-${destination}-${f.departure?.dateTime ?? ""}`,
    source: isHiddenCity ? "hidden-city" : "google",
    type: "cash",
    tags: f.attributes ?? [],
    origin,
    destination,
    airline,
    operatingAirlines: airline ? [airline] : [],
    flightNumbers: parseFlightNumbers(f.id),
    stops: typeof f.layovers === "number" ? f.layovers : 0,
    durationMinutes: parseDurationMinutes(f.duration),
    departureTime: f.departure?.dateTime ?? "",
    arrivalTime: f.arrival?.dateTime ?? "",
    airports: [origin, destination],
    cabinClass: cabinLabel,
    equipment: [],
    points: null,
    pointsProgram: null,
    cashPrice: typeof f.price?.amount === "number" ? f.price.amount : null,
    taxes: 0,
    currency: f.price?.currency ?? "USD",
    cppValue: null,
    roameScore: null,
    availableSeats: null,
    bookingUrl: sanitizeExternalUrl(f.deepLink),
    fareClass,
  }
}

async function searchOneClass(
  config: SkiplaggedSearchConfig,
  fareClass: string,
): Promise<UnifiedFlightResult[]> {
  const args: Record<string, unknown> = {
    origin: config.origin,
    destination: config.destination,
    departureDate: config.departureDate,
    fareClass,
    limit: config.limit ?? DEFAULT_LIMIT,
    sort: "value",
    includeHiddenCity: true,
    renderMode: "text",
  }
  if (config.returnDate) args.returnDate = config.returnDate

  const structured = (await callSkiplaggedTool("sk_flights_search", args)) as { flights?: SkiplaggedFlight[] }
  const cabinLabel = CABIN_LABEL_MAP[fareClass] ?? "economy"
  return (structured.flights ?? [])
    .map((f) => mapFlight(f, cabinLabel, fareClass))
    .filter((f): f is UnifiedFlightResult => f !== null)
}

/**
 * Search Skiplagged for cash + hidden-city flights. Keyless. "both" runs
 * economy and business in parallel (one fareClass per call, like Roame/point.me).
 */
export async function searchSkiplaggedFlights(
  config: SkiplaggedSearchConfig,
): Promise<UnifiedFlightResult[]> {
  const fareClasses =
    config.searchClass === "both"
      ? ["economy", "business"]
      : [FARE_CLASS_MAP[config.searchClass] ?? "economy"]

  const results = await Promise.all(fareClasses.map((fc) => searchOneClass(config, fc)))
  return results.flat()
}
