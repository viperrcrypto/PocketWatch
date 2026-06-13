/**
 * Seats.aero Partner API client — PAID, dormant until a Partner API key is added.
 * Award-availability search across mileage programs, returned as UnifiedFlightResult[].
 *
 * DRAFT: the response mapping below follows the official Partner API docs
 * (developers.seats.aero — PascalCase fields, string MileageCost) but has NOT
 * been live-tested (needs a Pro key). Validate against a real response before
 * wiring this into search-orchestrator.ts. It is intentionally NOT yet imported.
 *
 * API: GET https://seats.aero/partnerapi/search
 *   Header: "Partner-Authorization: <apiKey>"
 *   Response: { data: [ { ID, Route:{OriginAirport,DestinationAirport}, Date,
 *   Source, YAvailable, YMileageCost (STRING), YDirect, YRemainingSeats, ... } ] }
 *   Cabin prefixes: Y=economy, W=premium, J=business, F=first.
 * Mapped like ATF (source:"atf" + tags:["seatsaero"]) so the source union is unchanged.
 */

import type { UnifiedFlightResult, SearchConfig } from "@/types/travel"

const SEATS_AERO_SEARCH_URL = "https://seats.aero/partnerapi/search"
const REQUEST_TIMEOUT_MS = 25_000

// SearchConfig.searchClass → Seats.aero `cabins` query value
const CABIN_PARAM_MAP: Record<string, string> = {
  ECON: "economy",
  PREM_ECON: "premium",
  PREM: "premium",
  BIZ: "business",
  FIRST: "first",
}

// Seats.aero response cabin prefix (Y/W/J/F) → value-engine cabin label
const CABIN_PREFIXES = [
  { prefix: "Y", label: "economy" },
  { prefix: "W", label: "premium_economy" },
  { prefix: "J", label: "business" },
  { prefix: "F", label: "first" },
] as const

// Seats.aero `Source` slug → PocketWatch UPPER_SNAKE program key + airline name,
// so affordability / funding / sweet-spot scoring (which key on program keys) work.
const SEATS_PROGRAM: Record<string, { programKey: string; airline: string }> = {
  united: { programKey: "UNITED", airline: "United" },
  aeroplan: { programKey: "AEROPLAN", airline: "Air Canada" },
  american: { programKey: "AMERICAN", airline: "American" },
  delta: { programKey: "DELTA", airline: "Delta" },
  alaska: { programKey: "ALASKA", airline: "Alaska" },
  jetblue: { programKey: "JETBLUE", airline: "JetBlue" },
  virginatlantic: { programKey: "VIRGIN_ATLANTIC", airline: "Virgin Atlantic" },
  flyingblue: { programKey: "FLYING_BLUE", airline: "Air France/KLM" },
  lifemiles: { programKey: "LIFEMILES", airline: "Avianca" },
  emirates: { programKey: "EMIRATES", airline: "Emirates" },
  etihad: { programKey: "ETIHAD", airline: "Etihad" },
  qantas: { programKey: "QANTAS", airline: "Qantas" },
  singapore: { programKey: "SINGAPORE", airline: "Singapore Airlines" },
  ana: { programKey: "ANA", airline: "ANA" },
  turkish: { programKey: "TURKISH", airline: "Turkish Airlines" },
  velocity: { programKey: "VELOCITY", airline: "Virgin Australia" },
  smiles: { programKey: "SMILES", airline: "GOL" },
  aeromexico: { programKey: "AEROMEXICO", airline: "Aeromexico" },
}

function mapProgram(slug: string | null): { programKey: string | null; airline: string } {
  if (!slug) return { programKey: null, airline: "" }
  return SEATS_PROGRAM[slug.toLowerCase()] ?? { programKey: slug.toUpperCase(), airline: slug }
}

interface SeatsAeroRoute {
  OriginAirport?: string
  DestinationAirport?: string
}

/** A cached-availability row. Cabin-prefixed fields share a flat shape by prefix. */
interface SeatsAeroAvailability {
  ID?: string
  Route?: SeatsAeroRoute
  Date?: string
  Source?: string
  // Prefixed fields, e.g. YAvailable (bool) / YMileageCost (STRING) / YDirect (bool)
  [key: string]: unknown
}

interface SeatsAeroResponse {
  data?: SeatsAeroAvailability[]
}

/** Coerce a value (Seats.aero returns MileageCost as a string like "35000"). */
function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function buildDeepLink(id: string | undefined): string {
  return id ? `https://seats.aero/availability/${id}` : "https://seats.aero/search"
}

function mapAvailability(item: SeatsAeroAvailability): UnifiedFlightResult[] {
  const origin = item.Route?.OriginAirport
  const destination = item.Route?.DestinationAirport
  if (!origin || !destination) return []

  const { programKey, airline } = mapProgram(typeof item.Source === "string" ? item.Source : null)
  const date = typeof item.Date === "string" ? item.Date : ""
  const results: UnifiedFlightResult[] = []

  for (const { prefix, label } of CABIN_PREFIXES) {
    if (item[`${prefix}Available`] !== true) continue
    const points = num(item[`${prefix}MileageCost`])
    if (points === null) continue

    results.push({
      id: `seatsaero-${programKey ?? "unknown"}-${prefix}-${origin}-${destination}-${date}`,
      source: "atf",
      type: "award",
      tags: ["seatsaero"],
      origin,
      destination,
      airline,
      operatingAirlines: airline ? [airline] : [],
      flightNumbers: [],
      stops: item[`${prefix}Direct`] === true ? 0 : 1,
      durationMinutes: 0,
      departureTime: date,
      arrivalTime: date,
      airports: [origin, destination],
      cabinClass: label,
      equipment: [],
      points,
      pointsProgram: programKey,
      cashPrice: null,
      taxes: 0,
      currency: "USD",
      cppValue: null,
      roameScore: null,
      availableSeats: num(item[`${prefix}RemainingSeats`]),
      bookingUrl: buildDeepLink(typeof item.ID === "string" ? item.ID : undefined),
      fareClass: `seatsaero:${programKey ?? "unknown"}:${label}`,
      travelDate: date,
    })
  }

  return results
}

/**
 * Search Seats.aero award availability for a single route + date.
 * Returns [] on any non-200, parse failure, or abort (never throws past here).
 */
export async function searchSeatsAero(
  apiKey: string,
  config: {
    origin: string
    destination: string
    departureDate: string
    searchClass: SearchConfig["searchClass"]
  },
): Promise<UnifiedFlightResult[]> {
  const cabin = config.searchClass === "both" ? undefined : CABIN_PARAM_MAP[config.searchClass]

  const params = new URLSearchParams({
    origin_airport: config.origin,
    destination_airport: config.destination,
    start_date: config.departureDate,
    end_date: config.departureDate,
    order_by: "lowest_mileage",
  })
  if (cabin) params.set("cabins", cabin)

  try {
    const res = await fetch(`${SEATS_AERO_SEARCH_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "Partner-Authorization": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[travel] Seats.aero HTTP ${res.status} (${config.origin}→${config.destination})`)
      return []
    }

    const json = (await res.json()) as SeatsAeroResponse
    const data = Array.isArray(json.data) ? json.data : []
    return data.flatMap(mapAvailability)
  } catch (err) {
    console.warn(`[travel] Seats.aero search failed (${config.origin}→${config.destination}):`, (err as Error).message)
    return []
  }
}
