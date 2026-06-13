/**
 * Structured tool-result detection for the chat renderer.
 *
 * Flight/hotel tools return a JSON envelope with a top-level `type` discriminator
 * (`{ type: "flights", flights: [...] }` / `{ type: "hotels", hotels: [...] }`).
 * The renderer also accepts the same JSON inside a fenced code block the LLM can
 * embed in prose: ```pocket:flights\n{json}\n``` / ```pocket:hotels\n{json}\n```.
 *
 * EXACT CONTRACT with the tools builder:
 *   flights -> { type: "flights", total?, showing?, flights: FlightItem[] }
 *   hotels  -> { type: "hotels",  total?, showing?, hotels:  HotelItem[]  }
 * The top-level `type` discriminator is REQUIRED — a bare `{ flights: [...] }`
 * is NOT a card payload (analyze_fare_details returns `{ count, flights }` of
 * fare-flexibility objects, which must not render as a flight carousel).
 *
 * All fields are treated as UNTRUSTED data. Strings render only through React
 * text nodes; URLs pass through `sanitizeExternalUrl` (https-only).
 */

import { sanitizeExternalUrl } from "@/lib/travel/url-safety"

// ─── Item shapes (mirror the flat objects the tools emit) ──────────

export interface FlightItem {
  airline: string
  flightNumbers: string[]
  route: string
  airports: string[]
  stops: number
  duration: string
  cabin: string
  type: "award" | "cash"
  points: number | null
  program: string | null
  taxes: number
  cashPrice: number | null
  valueScore: number
  cppValue: number | null
  cppRating: string | null
  canAfford: boolean
  affordDetails: string
  sweetSpot: string | null
  departureTime: string
  arrivalTime: string
  bookingUrl: string
}

export interface HotelItem {
  name: string
  brand: string | null
  description: string
  hotelClass: number
  rating: number
  reviews: number
  amenities: string[]
  image: string | null
  cashPerNight: number | null
  cashTotal: number | null
  pointsPerNight: number | null
  pointsProgram: string | null
  bookingUrl: string
}

export interface HoldingItem {
  symbol: string
  name: string
  chain: string
  positionType: string
  protocol: string | null
  quantity: number
  value: number
}

export interface BudgetItem {
  id: string
  category: string
  monthlyLimit: number
  spent: number
  rollover: boolean
  isActive: boolean
}

export type ResultPayload =
  | { kind: "flights"; items: FlightItem[] }
  | { kind: "hotels"; items: HotelItem[] }
  | {
      kind: "holdings"
      items: HoldingItem[]
      totalValue: number
      onchainTotalValue: number
      exchangeTotalValue: number
      shown: number
      totalPositions: number
    }
  | {
      kind: "budgets"
      items: BudgetItem[]
      created: boolean
      updated: boolean
    }

// ─── Coercion helpers (defensive — provider data is untrusted) ─────

const str = (v: unknown): string => (typeof v === "string" ? v : "")
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null)
const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : 0)
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && isFinite(v) ? v : null
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []

function toFlight(raw: unknown): FlightItem {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    airline: str(o.airline),
    flightNumbers: strList(o.flightNumbers),
    route: str(o.route),
    airports: strList(o.airports),
    stops: num(o.stops),
    duration: str(o.duration),
    cabin: str(o.cabin),
    type: o.type === "cash" ? "cash" : "award",
    points: numOrNull(o.points),
    program: strOrNull(o.program),
    taxes: num(o.taxes),
    cashPrice: numOrNull(o.cashPrice),
    valueScore: num(o.valueScore),
    cppValue: numOrNull(o.cppValue),
    cppRating: strOrNull(o.cppRating),
    canAfford: o.canAfford === true,
    affordDetails: str(o.affordDetails),
    sweetSpot: strOrNull(o.sweetSpot),
    departureTime: str(o.departureTime),
    arrivalTime: str(o.arrivalTime),
    bookingUrl: sanitizeExternalUrl(str(o.bookingUrl)),
  }
}

function toHotel(raw: unknown): HotelItem {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    name: str(o.name),
    brand: strOrNull(o.brand),
    description: str(o.description),
    hotelClass: num(o.hotelClass),
    rating: num(o.rating ?? o.overallRating),
    reviews: num(o.reviews),
    amenities: strList(o.amenities),
    image: o.image != null ? sanitizeExternalUrl(str(o.image)) || null : null,
    cashPerNight: numOrNull(o.cashPerNight),
    cashTotal: numOrNull(o.cashTotal),
    pointsPerNight: numOrNull(o.pointsPerNight),
    pointsProgram: strOrNull(o.pointsProgram),
    bookingUrl: sanitizeExternalUrl(str(o.bookingUrl)),
  }
}

function toHolding(raw: unknown): HoldingItem {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    symbol: str(o.symbol),
    name: str(o.name),
    chain: str(o.chain),
    positionType: str(o.positionType),
    protocol: strOrNull(o.protocol),
    quantity: num(o.quantity),
    value: num(o.value),
  }
}

function toBudget(raw: unknown): BudgetItem {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    id: str(o.id),
    category: str(o.category),
    monthlyLimit: num(o.monthlyLimit),
    spent: num(o.spent),
    rollover: o.rollover === true,
    isActive: o.isActive !== false,
  }
}

/** Parse a raw JSON object into a typed payload, or null if it isn't one. */
export function parseResultObject(obj: unknown): ResultPayload | null {
  if (!obj || typeof obj !== "object") return null
  const o = obj as Record<string, unknown>

  const flights = Array.isArray(o.flights) ? o.flights : null
  if (o.type === "flights" && flights) {
    const items = flights.map(toFlight)
    return items.length > 0 ? { kind: "flights", items } : null
  }

  const hotels = Array.isArray(o.hotels) ? o.hotels : null
  if (o.type === "hotels" && hotels) {
    const items = hotels.map(toHotel)
    return items.length > 0 ? { kind: "hotels", items } : null
  }

  const holdings = Array.isArray(o.holdings) ? o.holdings : null
  if (o.type === "holdings" && holdings) {
    const items = holdings.map(toHolding)
    return items.length > 0
      ? {
          kind: "holdings",
          items,
          totalValue: num(o.totalValue),
          onchainTotalValue: num(o.onchainTotalValue),
          exchangeTotalValue: num(o.exchangeTotalValue),
          shown: num(o.shown),
          totalPositions: num(o.totalPositions),
        }
      : null
  }

  const budgets = Array.isArray(o.budgets) ? o.budgets : null
  if (o.type === "budgets" && budgets) {
    const items = budgets.map(toBudget)
    return items.length > 0
      ? {
          kind: "budgets",
          items,
          created: o.created === true,
          updated: o.updated === true,
        }
      : null
  }

  return null
}

/** Try to parse a tool-result string (raw JSON) into a payload. */
export function parseToolResult(result: string | undefined): ResultPayload | null {
  if (!result) return null
  try {
    return parseResultObject(JSON.parse(result))
  } catch {
    return null
  }
}

const FENCE_RE = /```pocket:(flights|hotels|holdings|budgets)\s*\n([\s\S]*?)```/

/**
 * Split assistant markdown around a `pocket:flights` / `pocket:hotels` fence.
 * Returns the prose before, the parsed payload, and the prose after, or null
 * when no valid fence is present (renderer then keeps the plain markdown path).
 */
export function extractFencePayload(
  content: string
): { before: string; payload: ResultPayload; after: string } | null {
  const match = FENCE_RE.exec(content)
  if (!match) return null
  let payload: ResultPayload | null = null
  try {
    payload = parseResultObject(JSON.parse(match[2]!.trim()))
  } catch {
    payload = null
  }
  if (!payload) return null
  return {
    before: content.slice(0, match.index).trim(),
    payload,
    after: content.slice(match.index + match[0].length).trim(),
  }
}
