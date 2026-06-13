/**
 * google-flights-direct — direct client for Google Flights'
 * FlightsFrontendService (no scraping, no third-party API).
 *
 * This file ports the top-level orchestration of fli/search/flights.py:
 * build (filters.ts) → post (client.ts) → split (wire.ts) → decode
 * (decoders.ts), returning typed FlightResult objects.
 *
 * Scope note: the Python SearchFlights.search() additionally expands
 * round-trip/multi-city itineraries into tuples via follow-up requests.
 * searchGoogleFlightsDirect performs the single GetShoppingResults call
 * (Python's _fetch_flights): for ROUND_TRIP the rows are outbound
 * candidates — pass `selectedFlight` on the next FlightData leg to fetch
 * return-leg options, exactly as the encoder supports.
 */

import { postSearch } from "./client"
import { parseFlightRow } from "./decoders"
import { buildFilters, encodeFilters } from "./filters"
import type { SearchOptions } from "./filters"
import type { FlightResult } from "./result-types"
import type { FlightData } from "./types"
import { parseFirstWrbPayload } from "./wire"
import { safeGet } from "./decode-helpers"

/**
 * Raised when a successful HTTP response cannot be parsed into flights.
 * Distinct from network / HTTP errors — "Google responded but the shape
 * changed" vs "Google didn't respond at all". (Python: SearchParseError)
 */
export class SearchParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SearchParseError"
  }
}

/** Parameters for searchGoogleFlightsDirect. */
export interface GoogleFlightsDirectParams extends SearchOptions {
  /** One leg per travel direction; dates are YYYY-MM-DD, airports IATA codes. */
  readonly flightData: readonly FlightData[]
  /** ISO 4217 currency (`curr=` URL param). */
  readonly currency?: string | null
  /** BCP-47 language code (`hl=` URL param). */
  readonly language?: string | null
  /** ISO 3166-1 alpha-2 country (`gl=` URL param). */
  readonly country?: string | null
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

/**
 * Pull every flight row out of the decoded inner payload.
 * (Python: the `inner[i][0] for i in (2, 3)` comprehension in _fetch_flights —
 * IndexError/TypeError there becomes SearchParseError.)
 */
function collectFlightRows(inner: unknown): readonly unknown[] {
  if (!Array.isArray(inner) || inner.length < 4) {
    throw new SearchParseError(
      "Shopping response shape changed — no flights array at inner[2]/[3]",
    )
  }
  const rows: unknown[] = []
  for (const i of [2, 3] as const) {
    const block: unknown = inner[i]
    if (!Array.isArray(block)) continue
    const first: unknown = block[0]
    if (!Array.isArray(first)) {
      throw new SearchParseError(
        `Shopping response shape changed — no flights array at inner[${i}]`,
      )
    }
    rows.push(...(first as readonly unknown[]))
  }
  return rows
}

/**
 * Decode all flight rows of a GetShoppingResults inner payload, skipping
 * unparseable rows (advert / sponsor placements). Throws SearchParseError
 * when EVERY row fails — a likely wire-format change.
 * (Python: the decode loop in SearchFlights._fetch_flights)
 */
export function decodeShoppingResponse(inner: unknown): readonly FlightResult[] {
  const rows = collectFlightRows(inner)
  const flights: FlightResult[] = []
  const failureSamples: string[] = []
  let anyFailure = false
  for (const row of rows) {
    try {
      flights.push(parseFlightRow(row))
    } catch (error) {
      anyFailure = true
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      if (!failureSamples.includes(reason) && failureSamples.length < 3) {
        failureSamples.push(reason)
      }
    }
  }
  if (rows.length > 0 && anyFailure && flights.length === 0) {
    throw new SearchParseError(
      `Parsed 0/${rows.length} flight rows — Google response shape may have changed ` +
        `(sample reasons: ${failureSamples.join("; ")})`,
    )
  }
  return flights
}

/**
 * Cache-free port of SearchFlights._capture_session_id: the shopping session
 * id at inner[0][4], used to derive GetBookingResults tokens.
 */
export function extractSessionId(inner: unknown): string | null {
  const sessionId = safeGet(safeGet(inner, 0), 4)
  return typeof sessionId === "string" && sessionId.length > 0 ? sessionId : null
}

/**
 * Search Google Flights directly: encode the tfs filter payload, POST it to
 * GetShoppingResults, split the `)]}'` wrb.fr envelope, and decode the
 * nested arrays into FlightResult objects (price, durationMinutes, stops,
 * legs, airline, departure/arrival ISO, bookingToken).
 *
 * Returns an empty array when Google has no results (Python returns None).
 * Throws GoogleFlightsHttpError on HTTP failure, SearchParseError when the
 * response shape is unrecognisable.
 */
export async function searchGoogleFlightsDirect(
  params: GoogleFlightsDirectParams,
): Promise<readonly FlightResult[]> {
  const { flightData, currency, language, country, timeoutMs, signal, ...options } = params
  const filters = buildFilters(flightData, options)
  const encoded = encodeFilters(filters)
  const rawBody = await postSearch(encoded, { currency, language, country, timeoutMs, signal })
  const inner = parseFirstWrbPayload(rawBody)
  if (inner === null || inner === undefined) return []
  return decodeShoppingResponse(inner)
}

// ---------------------------------------------------------------------------
// Public surface re-exports
// ---------------------------------------------------------------------------

export { parseBookingChunk } from "./booking-decoders"
export {
  GoogleFlightsHttpError,
  GoogleFlightsTransientError,
  postBooking,
  postCalendar,
  postSearch,
  withLocaleParams,
} from "./client"
export type { PostOptions } from "./client"
export { extractCurrencyFromPriceToken } from "./currency"
export { searchDateGrid } from "./dates"
export type { DateGridParams, DatePrice } from "./dates"
export { parseFlightRow } from "./decoders"
export { buildEncodedFilter, buildFilters, encodeFilters } from "./filters"
export type { SearchOptions } from "./filters"
export type {
  Amenities,
  BookingOption,
  FlightLeg,
  FlightResult,
  Layover,
} from "./result-types"
export {
  EmissionsFilter,
  MaxStops,
  SeatType,
  SortBy,
  TripType,
} from "./types"
export type { FlightData, PassengerInfo } from "./types"
export { parseFirstWrbPayload, splitWrbChunks } from "./wire"
