/**
 * Adapter: direct Google Flights client (google-flights-direct/) →
 * UnifiedFlightResult rows with source "google".
 *
 * Used by searchGoogleFlights() in google-flights-client.ts as the primary
 * provider; the SerpAPI path remains as fallback. Round-trips are searched
 * natively (two FlightData legs → outbound candidates with round-trip
 * pricing, same semantics as SerpAPI type=1).
 */

import type { SearchConfig, UnifiedFlightResult } from "@/types/travel"
import { AIRLINE_NAMES, buildCashBookingUrl } from "./constants"
import { searchGoogleFlightsDirect } from "./google-flights-direct"
import { buildTfsToken } from "./google-flights-direct/proto"
import type { LegSpec } from "./google-flights-direct/proto"
import type { FlightResult } from "./google-flights-direct/result-types"
import { SeatType } from "./google-flights-direct/types"
import type { FlightData } from "./google-flights-direct/types"

// ─── Cabin Mapping ──────────────────────────────────────────────

const SEAT_TYPE_BY_CLASS: Record<"ECON" | "PREM_ECON" | "BIZ" | "FIRST", SeatType> = {
  ECON: SeatType.ECONOMY,
  PREM_ECON: SeatType.PREMIUM_ECONOMY,
  BIZ: SeatType.BUSINESS,
  FIRST: SeatType.FIRST,
}

const CABIN_NAMES: Record<SeatType, string> = {
  [SeatType.ECONOMY]: "economy",
  [SeatType.PREMIUM_ECONOMY]: "premium_economy",
  [SeatType.BUSINESS]: "business",
  [SeatType.FIRST]: "first",
}

/** "both" mirrors the SerpAPI path: economy + business. */
function seatTypesFor(searchClass: SearchConfig["searchClass"]): readonly SeatType[] {
  if (searchClass === "both") return [SeatType.ECONOMY, SeatType.BUSINESS]
  return [SEAT_TYPE_BY_CLASS[searchClass]]
}

// ─── Booking Deep Link ──────────────────────────────────────────

/**
 * Per-itinerary Google Flights deep link — port of the single-result form of
 * SearchFlights.build_flight_booking_url (fli/search/flights.py). The tfs
 * token is deterministic (airports + dates + flight numbers); null on
 * malformed input so callers can fall back to buildCashBookingUrl.
 */
export function buildDirectBookingUrl(flight: FlightResult): string | null {
  try {
    const legs: readonly LegSpec[] = flight.legs.map((leg) => ({
      origin: leg.departureAirport,
      depDate: leg.departureDateTime.slice(0, 10),
      dest: leg.arrivalAirport,
      airline: leg.airline,
      flightNumber: leg.flightNumber,
    }))
    if (legs.length === 0) return null
    const tfs = buildTfsToken([legs], true)
    return `https://www.google.com/travel/flights/booking?tfs=${tfs}`
  } catch {
    return null
  }
}

// ─── FlightResult → UnifiedFlightResult ─────────────────────────

interface MapContext {
  readonly seatType: SeatType
  readonly index: number
  /** "One way" | "Round trip" — same strings SerpAPI emits in fareClass. */
  readonly tripLabel: string
  readonly searchOrigin: string
  readonly searchDestination: string
  readonly searchDate: string
}

/** Map one direct-client FlightResult to the unified shape (source "google"). */
export function flightResultToUnified(
  flight: FlightResult,
  ctx: MapContext,
): UnifiedFlightResult {
  const firstLeg = flight.legs[0]
  const lastLeg = flight.legs[flight.legs.length - 1]
  const origin = firstLeg?.departureAirport || ctx.searchOrigin
  const destination = lastLeg?.arrivalAirport || ctx.searchDestination
  const airlineCodes = [...new Set(flight.legs.map((l) => l.airline).filter(Boolean))]
  const airlineNames = airlineCodes.map((code) => AIRLINE_NAMES[code] || code)
  const travelDate = /^\d{4}-\d{2}-\d{2}/.test(flight.departure)
    ? flight.departure.slice(0, 10)
    : ctx.searchDate
  const layoverAirports = (flight.layovers ?? []).map((l) => l.airport)
  return {
    id: `google-${origin}-${destination}-${travelDate}-${ctx.seatType}-${ctx.index}`,
    source: "google",
    type: "cash",
    origin,
    destination,
    airline: airlineNames.join(" / ") || "Unknown",
    operatingAirlines: airlineNames.length > 0 ? airlineNames : ["Unknown"],
    flightNumbers: flight.legs.map((l) => `${l.airline} ${l.flightNumber}`.trim()),
    stops: flight.stops,
    durationMinutes: flight.durationMinutes,
    departureTime: flight.departure,
    arrivalTime: flight.arrival,
    airports: [origin, ...layoverAirports, destination],
    cabinClass: CABIN_NAMES[ctx.seatType],
    equipment: flight.legs.map((l) => l.aircraft || "").filter(Boolean),
    points: null,
    pointsProgram: null,
    cashPrice: flight.price,
    taxes: 0,
    currency: flight.currency || "USD",
    cppValue: null,
    roameScore: null,
    availableSeats: null,
    bookingUrl:
      // The direct tfs token is ONE-WAY only; for round-trips its fare wouldn't
      // match the displayed RT total, so use the generic both-dates search URL.
      (ctx.tripLabel === "Round trip" ? null : buildDirectBookingUrl(flight)) ||
      buildCashBookingUrl(firstLeg?.airline || "", origin, destination, travelDate),
    fareClass: ctx.tripLabel,
    travelDate,
  }
}

// ─── Search Entry Point ─────────────────────────────────────────

/**
 * Search via the direct client and return unified rows. Round-trip configs
 * send both legs (outbound candidates carry round-trip pricing); one-way
 * configs send a single leg. With searchClass "both", a failing cabin is
 * tolerated when the other returned rows; throws only when every request
 * failed so the caller can fall back to SerpAPI.
 */
export async function searchGoogleFlightsDirectUnified(
  config: SearchConfig,
): Promise<UnifiedFlightResult[]> {
  const isRoundTrip = config.tripType === "round_trip" && Boolean(config.returnDate)
  const outbound: FlightData = {
    date: config.departureDate,
    fromAirport: config.origin,
    toAirport: config.destination,
  }
  const flightData: readonly FlightData[] = isRoundTrip
    ? [outbound, { date: config.returnDate!, fromAirport: config.destination, toAirport: config.origin }]
    : [outbound]
  const tripLabel = isRoundTrip ? "Round trip" : "One way"

  const allFlights: UnifiedFlightResult[] = []
  let firstError: Error | null = null
  for (const seatType of seatTypesFor(config.searchClass)) {
    try {
      const results = await searchGoogleFlightsDirect({
        flightData,
        seatType,
        currency: "USD",
        language: "en",
      })
      for (const flight of results) {
        allFlights.push(
          flightResultToUnified(flight, {
            seatType,
            index: allFlights.length,
            tripLabel,
            searchOrigin: config.origin,
            searchDestination: config.destination,
            searchDate: config.departureDate,
          }),
        )
      }
    } catch (error) {
      firstError ??= error instanceof Error ? error : new Error(String(error))
    }
  }
  if (allFlights.length === 0 && firstError) throw firstError
  return allFlights
}
