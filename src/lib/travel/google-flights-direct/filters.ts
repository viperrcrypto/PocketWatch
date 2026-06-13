/**
 * Filter formatting + encoding — faithful port of
 * FlightSearchFilters.format()/encode() (fli/models/google_flights/flights.py)
 * and the segment builders (fli/core/builders.py).
 *
 * The nested-array structure, index positions, and null placeholders below
 * are the reverse-engineered GetShoppingResults payload — a wrong index or
 * field order yields zero results. Mirror the Python literally.
 */

import { AIRPORTS } from "../airport-data"
import {
  Alliance,
  EmissionsFilter,
  MaxStops,
  SeatType,
  SortBy,
  TripType,
} from "./types"
import type {
  AirlineCode,
  AirportCode,
  BagsFilter,
  FlightData,
  FlightSearchFilters,
  FlightSegment,
  LayoverRestrictions,
  PassengerInfo,
  PriceLimit,
  TfsJson,
  TimeRestrictions,
} from "./types"

// ---------------------------------------------------------------------------
// Lenient airport validation against the existing airport database
// ---------------------------------------------------------------------------

const KNOWN_IATA: ReadonlySet<string> = new Set(AIRPORTS.map((airport) => airport.iata))

/** True when the code exists in src/lib/travel/airport-data.ts. */
export function isKnownAirport(code: string): boolean {
  return KNOWN_IATA.has(code.trim().toUpperCase())
}

/**
 * Normalize an IATA code (trim + uppercase). Lenient by design: unknown
 * codes pass through unchanged — Google itself is the source of truth.
 */
export function normalizeAirportCode(code: AirportCode): string {
  return code.trim().toUpperCase()
}

// ---------------------------------------------------------------------------
// Builders (port of fli/core/builders.py)
// ---------------------------------------------------------------------------

/** Normalize a date string to zero-padded YYYY-MM-DD. (Python: normalize_date) */
export function normalizeDate(dateStr: string): string {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateStr.trim())
  if (!match) throw new Error(`Invalid date: ${dateStr} (expected YYYY-MM-DD)`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  const valid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  if (!valid) throw new Error(`Invalid date: ${dateStr}`)
  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

const swapIfReversed = (
  earliest: number | null,
  latest: number | null,
): readonly [number | null, number | null] =>
  earliest !== null && latest !== null && earliest > latest ? [latest, earliest] : [earliest, latest]

/**
 * Port of TimeRestrictions' validator: swaps earliest/latest pairs so
 * "from" is always before "to". Returns null when no restriction is set.
 */
export function normalizeTimeRestrictions(
  restrictions: TimeRestrictions | null | undefined,
): TimeRestrictions | null {
  if (!restrictions) return null
  const [earliestDeparture, latestDeparture] = swapIfReversed(
    restrictions.earliestDeparture ?? null,
    restrictions.latestDeparture ?? null,
  )
  const [earliestArrival, latestArrival] = swapIfReversed(
    restrictions.earliestArrival ?? null,
    restrictions.latestArrival ?? null,
  )
  return { earliestDeparture, latestDeparture, earliestArrival, latestArrival }
}

const toCodeList = (value: AirportCode | readonly AirportCode[]): readonly string[] =>
  (typeof value === "string" ? [value] : value).map(normalizeAirportCode)

export const localTodayIso = (): string => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

/** Convert one FlightData leg into a wire-ready FlightSegment. */
export function flightDataToSegment(data: FlightData): FlightSegment {
  const origins = toCodeList(data.fromAirport)
  const destinations = toCodeList(data.toAirport)
  if (origins.length === 0 || destinations.length === 0) {
    throw new Error("Both departure and arrival airports must be specified")
  }
  if (origins[0] === destinations[0]) {
    throw new Error("Departure and arrival airports must be different")
  }
  const travelDate = normalizeDate(data.date)
  if (travelDate < localTodayIso()) throw new Error("Travel date cannot be in the past")
  return {
    departureAirport: origins.map((code) => [code, 0] as const),
    arrivalAirport: destinations.map((code) => [code, 0] as const),
    travelDate,
    timeRestrictions: normalizeTimeRestrictions(data.timeRestrictions),
    selectedFlight: data.selectedFlight ?? null,
  }
}

const firstCode = (value: AirportCode | readonly AirportCode[]): string =>
  normalizeAirportCode(typeof value === "string" ? value : (value[0] ?? ""))

/** 1 leg → ONE_WAY; 2 mirrored legs → ROUND_TRIP; otherwise MULTI_CITY. */
export function inferTripType(flightData: readonly FlightData[]): TripType {
  if (flightData.length === 1) return TripType.ONE_WAY
  const [outbound, inbound] = flightData
  if (flightData.length === 2 && outbound && inbound) {
    const mirrored =
      firstCode(outbound.fromAirport) === firstCode(inbound.toAirport) &&
      firstCode(outbound.toAirport) === firstCode(inbound.fromAirport)
    if (mirrored) return TripType.ROUND_TRIP
  }
  return TripType.MULTI_CITY
}

// ---------------------------------------------------------------------------
// format() — the tfs nested-array structure
// ---------------------------------------------------------------------------

/**
 * Build the dual-purpose airline include/exclude token list: airline IATA
 * codes first, alliance identifiers appended after, both sorted.
 *
 * NOTE (deviation): Python sorts airline codes by the enum's *display name*
 * ("American Airlines"); we sort by IATA code. The comment in the Python
 * source states ordering "only matters for snapshot tests" — Google treats
 * the list as a set.
 */
export function buildAirlineTokens(
  airlines: readonly AirlineCode[] | null | undefined,
  alliances: readonly Alliance[] | null | undefined,
): readonly string[] | null {
  const tokens: string[] = []
  if (airlines && airlines.length > 0) {
    tokens.push(...airlines.map((code) => code.trim().toUpperCase()).sort())
  }
  if (alliances && alliances.length > 0) {
    tokens.push(...[...alliances].sort())
  }
  return tokens.length > 0 ? tokens : null
}

/** segment[8]: selected flight legs (round-trip / multi-city next-leg fetch). */
function formatSelectedFlights(filters: FlightSearchFilters, segment: FlightSegment): TfsJson {
  const isMultiLeg =
    filters.tripType === TripType.ROUND_TRIP || filters.tripType === TripType.MULTI_CITY
  const selected = segment.selectedFlight
  if (!isMultiLeg || !selected) return null
  return selected.legs.map((leg) => [
    normalizeAirportCode(leg.departureAirport),
    leg.departureDate,
    normalizeAirportCode(leg.arrivalAirport),
    null,
    leg.airline.trim().toUpperCase(),
    leg.flightNumber,
  ])
}

/** One formatted segment — index comments mirror the Python source. */
function formatSegment(
  filters: FlightSearchFilters,
  segment: FlightSegment,
  segIdx: number,
): readonly TfsJson[] {
  const restrictions = segment.timeRestrictions ?? null
  const timeFilters: TfsJson = restrictions
    ? [
        restrictions.earliestDeparture ?? null,
        restrictions.latestDeparture ?? null,
        restrictions.earliestArrival ?? null,
        restrictions.latestArrival ?? null,
      ]
    : null
  const layover: LayoverRestrictions | null = filters.layoverRestrictions ?? null
  const layoverAirports =
    layover?.airports && layover.airports.length > 0
      ? layover.airports.map(normalizeAirportCode)
      : null
  const emissionsFilter: TfsJson =
    filters.emissions !== EmissionsFilter.ALL ? [filters.emissions] : null
  // Classifier (segment[14]): 3 = outbound (or only leg), 1 = return leg of
  // a round-trip. GetShoppingResults tolerates a uniform 3; GetBookingResults
  // rejects with INVALID_ARGUMENT unless it matches the UI's pattern.
  const isReturn = filters.tripType === TripType.ROUND_TRIP && segIdx > 0
  return [
    [segment.departureAirport.map(([code, kind]) => [normalizeAirportCode(code), kind])], // 0
    [segment.arrivalAirport.map(([code, kind]) => [normalizeAirportCode(code), kind])], // 1
    timeFilters, // 2: [edep, ldep, earr, larr]
    filters.stops, // 3: stops int
    buildAirlineTokens(filters.airlines, filters.alliances), // 4: INCLUDE list
    buildAirlineTokens(filters.airlinesExclude, filters.alliancesExclude), // 5: EXCLUDE list
    segment.travelDate, // 6: travel date
    filters.maxDuration ? [filters.maxDuration] : null, // 7: max duration
    formatSelectedFlights(filters, segment), // 8: selected flight
    layoverAirports, // 9: layover airport include list
    null, // 10: ? (rejects scalars; no observed effect)
    layover?.minDuration ?? null, // 11: min layover duration (mins)
    layover?.maxDuration ?? null, // 12: max layover duration (mins)
    emissionsFilter, // 13: emissions filter [1]=less emissions
    isReturn ? 1 : 3, // 14: classifier (3=outbound, 1=return)
  ]
}

/**
 * Format filters into the Google Flights API structure.
 * (Python: FlightSearchFilters.format() — see its index map for filters[1].)
 */
export function formatFilters(filters: FlightSearchFilters): readonly TfsJson[] {
  const formattedSegments = filters.flightSegments.map((segment, segIdx) =>
    formatSegment(filters, segment, segIdx),
  )
  const bags: BagsFilter | null = filters.bags ?? null
  const bagsFilter: TfsJson = bags ? [bags.checkedBags, bags.carryOn ? 1 : 0] : null
  const priceLimit: PriceLimit | null = filters.priceLimit ?? null
  const passengers: PassengerInfo = filters.passengerInfo
  return [
    [], // outer[0]
    [
      null, // [0] seemingly no effect
      null, // [1] seemingly no effect (not currency)
      filters.tripType, // [2] trip type
      null, // [3] seemingly no effect
      [], // [4] seemingly no effect
      filters.seatType, // [5] seat/cabin type
      [passengers.adults, passengers.children, passengers.infantsOnLap, passengers.infantsInSeat],
      priceLimit ? [null, priceLimit.maxPrice] : null, // [7] price limit
      null, // [8] seemingly no effect
      null, // [9] seemingly no effect
      bagsFilter, // [10] bags filter [checked_bags, carry_on]
      null, // [11] seemingly no effect
      null, // [12] seemingly no effect
      formattedSegments, // [13] flight segments
      null, // [14] seemingly no effect
      null, // [15] seemingly no effect
      null, // [16] seemingly no effect
      1, // [17] seemingly no effect (hardcoded to 1)
      null, // [18]
      null, // [19]
      null, // [20]
      null, // [21]
      null, // [22]
      null, // [23]
      null, // [24]
      null, // [25]
      null, // [26]
      null, // [27]
      filters.excludeBasicEconomy ? 1 : 0, // [28]
    ],
    filters.sortBy, // outer[2] sort mode
    filters.showAllResults ? 1 : 0, // outer[3] 0=~30, 1=all results
    0, // outer[4] seemingly no effect
    1, // outer[5] seemingly no effect
  ]
}

/**
 * Match Python's urllib.parse.quote(s) (safe="/"): also escape !'()* which
 * encodeURIComponent leaves bare, and keep "/" unescaped.
 */
export function quoteLikePython(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/g, "/")
}

/**
 * URL-encode the formatted filters for the f.req POST body.
 * (Python: FlightSearchFilters.encode())
 * Output shape: quote(json.dumps([null, json.dumps(format())])).
 */
export function encodeFilters(filters: FlightSearchFilters): string {
  const formattedJson = JSON.stringify(formatFilters(filters))
  return quoteLikePython(JSON.stringify([null, formattedJson]))
}

// ---------------------------------------------------------------------------
// High-level entry point
// ---------------------------------------------------------------------------

/** Optional knobs mirroring FlightSearchFilters' non-segment fields. */
export interface SearchOptions {
  readonly tripType?: TripType
  readonly passengers?: Partial<PassengerInfo>
  readonly stops?: MaxStops
  readonly seatType?: SeatType
  readonly priceLimit?: PriceLimit | null
  readonly airlines?: readonly AirlineCode[] | null
  readonly airlinesExclude?: readonly AirlineCode[] | null
  readonly alliances?: readonly Alliance[] | null
  readonly alliancesExclude?: readonly Alliance[] | null
  readonly maxDuration?: number | null
  readonly layoverRestrictions?: LayoverRestrictions | null
  readonly sortBy?: SortBy
  readonly excludeBasicEconomy?: boolean
  readonly emissions?: EmissionsFilter
  readonly bags?: BagsFilter | null
  readonly showAllResults?: boolean
}

/** Assemble a full FlightSearchFilters from FlightData legs + options. */
export function buildFilters(
  flightData: readonly FlightData[],
  options: SearchOptions = {},
): FlightSearchFilters {
  if (flightData.length === 0) throw new Error("flightData must contain at least one leg")
  return {
    tripType: options.tripType ?? inferTripType(flightData),
    passengerInfo: {
      adults: 1,
      children: 0,
      infantsInSeat: 0,
      infantsOnLap: 0,
      ...options.passengers,
    },
    flightSegments: flightData.map(flightDataToSegment),
    stops: options.stops ?? MaxStops.ANY,
    seatType: options.seatType ?? SeatType.ECONOMY,
    priceLimit: options.priceLimit ?? null,
    airlines: options.airlines ?? null,
    airlinesExclude: options.airlinesExclude ?? null,
    alliances: options.alliances ?? null,
    alliancesExclude: options.alliancesExclude ?? null,
    maxDuration: options.maxDuration ?? null,
    layoverRestrictions: options.layoverRestrictions ?? null,
    sortBy: options.sortBy ?? SortBy.BEST,
    excludeBasicEconomy: options.excludeBasicEconomy ?? false,
    emissions: options.emissions ?? EmissionsFilter.ALL,
    bags: options.bags ?? null,
    showAllResults: options.showAllResults ?? true,
  }
}

/**
 * Build the percent-encoded tfs request payload from FlightData legs —
 * ready to be sent as `f.req=<encoded>` via postSearch() in client.ts.
 */
export function buildEncodedFilter(
  flightData: readonly FlightData[],
  options: SearchOptions = {},
): string {
  return encodeFilters(buildFilters(flightData, options))
}
