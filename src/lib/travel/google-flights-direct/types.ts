/**
 * Types for the direct Google Flights (FlightsFrontendService) request encoder.
 *
 * Faithful TypeScript port of punitarani/fli's request/encode models:
 * - fli/models/google_flights/base.py (enums + filter sub-models)
 * - fli/models/google_flights/flights.py (FlightSearchFilters)
 *
 * Enum integer values are WIRE VALUES inside the tfs payload Google parses —
 * they must match the Python source exactly or searches return zero results.
 */

/** Available cabin classes for flights. (Python: SeatType) */
export enum SeatType {
  ECONOMY = 1,
  PREMIUM_ECONOMY = 2,
  BUSINESS = 3,
  FIRST = 4,
}

/**
 * Sorting options for flight results. (Python: SortBy)
 * Maps to the top-level sort_mode value (outer[2]) in the API payload.
 */
export enum SortBy {
  TOP_FLIGHTS = 0,
  BEST = 1,
  CHEAPEST = 2,
  DEPARTURE_TIME = 3,
  ARRIVAL_TIME = 4,
  DURATION = 5,
  EMISSIONS = 6,
}

/** Type of flight journey. (Python: TripType) */
export enum TripType {
  ROUND_TRIP = 1,
  ONE_WAY = 2,
  MULTI_CITY = 3,
}

/** Maximum number of stops allowed in flight search. (Python: MaxStops) */
export enum MaxStops {
  ANY = 0,
  NON_STOP = 1,
  ONE_STOP_OR_FEWER = 2,
  TWO_OR_FEWER_STOPS = 3,
}

/**
 * Filter flights by carbon emissions level. (Python: EmissionsFilter)
 * LESS corresponds to the "Less emissions" toggle on Google Flights.
 */
export enum EmissionsFilter {
  ALL = 0,
  LESS = 1,
}

/**
 * Airline alliances — drop-in values inside the airline include (segment[4])
 * or exclude (segment[5]) lists. STAR_ALLIANCE requires the underscore;
 * "Star Alliance" / "STAR ALLIANCE" both return zero results.
 */
export enum Alliance {
  ONEWORLD = "ONEWORLD",
  SKYTEAM = "SKYTEAM",
  STAR_ALLIANCE = "STAR_ALLIANCE",
}

/**
 * Airline IATA code (e.g. "AA", "B6").
 *
 * The Python source vendors a full Airline enum, but its wire serialization
 * is just `enum_member.name.removeprefix("_")` — i.e. the bare IATA code
 * string. Plain strings are therefore wire-identical; we do not vendor the
 * enum (PocketWatch 400-line cap).
 */
export type AirlineCode = string

/**
 * Airport IATA code (e.g. "JFK"). Same rationale as AirlineCode — the
 * Python Airport enum serializes to its bare IATA code on the wire.
 * Codes are validated leniently against src/lib/travel/airport-data.ts;
 * unknown codes pass through unchanged.
 */
export type AirportCode = string

/**
 * ISO 4217 currency code (e.g. "USD"). Not part of the tfs payload —
 * Google reads currency from the `curr=` URL query parameter only.
 */
export type CurrencyCode = string

/**
 * Time constraints for departure and arrival in local time.
 * All values are hours from midnight (e.g. 20 = 8:00 PM).
 * (Python: TimeRestrictions)
 */
export interface TimeRestrictions {
  readonly earliestDeparture?: number | null
  readonly latestDeparture?: number | null
  readonly earliestArrival?: number | null
  readonly latestArrival?: number | null
}

/** Passenger configuration for flight search. (Python: PassengerInfo) */
export interface PassengerInfo {
  readonly adults: number
  readonly children: number
  readonly infantsInSeat: number
  readonly infantsOnLap: number
}

/** Alias matching the name used in earlier fli releases. */
export type Passengers = PassengerInfo

/** Maximum price constraint for flight search. (Python: PriceLimit) */
export interface PriceLimit {
  readonly maxPrice: number
  /** Applied via the `curr=` URL param, NOT encoded into the tfs payload. */
  readonly currency?: CurrencyCode | null
}

/**
 * Include checked/carry-on bag fees in displayed prices.
 * (Python: BagsFilter)
 */
export interface BagsFilter {
  readonly checkedBags: number
  readonly carryOn: boolean
}

/**
 * Constraints for layovers in multi-leg flights. `airports` is an include
 * list; durations bound the wait between legs in minutes.
 * (Python: LayoverRestrictions)
 */
export interface LayoverRestrictions {
  readonly airports?: readonly AirportCode[] | null
  readonly minDuration?: number | null
  readonly maxDuration?: number | null
}

/**
 * One leg of a previously selected flight — used to fetch return/next-leg
 * options for round-trip and multi-city searches (segment[8]).
 * (Python: the FlightLeg fields read by FlightSearchFilters.format())
 */
export interface SelectedFlightLeg {
  readonly departureAirport: AirportCode
  /** YYYY-MM-DD (Python formats departure_datetime with "%Y-%m-%d"). */
  readonly departureDate: string
  readonly arrivalAirport: AirportCode
  readonly airline: AirlineCode
  readonly flightNumber: string
}

/** The selected-flight subset of Python's FlightResult used in encoding. */
export interface SelectedFlight {
  readonly legs: readonly SelectedFlightLeg[]
}

/**
 * Airport entry: [IATA code, kind]. The Python source always uses kind 0
 * (built as `[[airport, 0]]` in fli/core/builders.py).
 */
export type AirportPair = readonly [AirportCode, number]

/**
 * A single portion of a journey between two airports. (Python: FlightSegment)
 * `departureAirport` / `arrivalAirport` are lists of [code, kind] pairs to
 * support multi-airport search (e.g. JFK + EWR + LGA).
 */
export interface FlightSegment {
  readonly departureAirport: readonly AirportPair[]
  readonly arrivalAirport: readonly AirportPair[]
  /** YYYY-MM-DD */
  readonly travelDate: string
  readonly timeRestrictions?: TimeRestrictions | null
  readonly selectedFlight?: SelectedFlight | null
}

/**
 * Simple one-leg descriptor accepted by buildEncodedFilter(). Mirrors the
 * FlightData dataclass from earlier fli releases (date, from, to); the
 * current source builds FlightSegments via fli/core/builders.py instead.
 */
export interface FlightData {
  /** YYYY-MM-DD (lenient: "2026-7-2" is normalized to "2026-07-02"). */
  readonly date: string
  readonly fromAirport: AirportCode | readonly AirportCode[]
  readonly toAirport: AirportCode | readonly AirportCode[]
  readonly timeRestrictions?: TimeRestrictions | null
  readonly selectedFlight?: SelectedFlight | null
}

/**
 * Complete set of filters for flight search. (Python: FlightSearchFilters)
 * Defaults (applied by buildFilters in filters.ts) match the Python model:
 * tripType ONE_WAY, stops ANY, seatType ECONOMY, sortBy BEST,
 * excludeBasicEconomy false, emissions ALL, showAllResults true.
 */
export interface FlightSearchFilters {
  readonly tripType: TripType
  readonly passengerInfo: PassengerInfo
  readonly flightSegments: readonly FlightSegment[]
  readonly stops: MaxStops
  readonly seatType: SeatType
  readonly priceLimit?: PriceLimit | null
  readonly airlines?: readonly AirlineCode[] | null
  readonly airlinesExclude?: readonly AirlineCode[] | null
  readonly alliances?: readonly Alliance[] | null
  readonly alliancesExclude?: readonly Alliance[] | null
  readonly maxDuration?: number | null
  readonly layoverRestrictions?: LayoverRestrictions | null
  readonly sortBy: SortBy
  readonly excludeBasicEconomy: boolean
  readonly emissions: EmissionsFilter
  readonly bags?: BagsFilter | null
  readonly showAllResults: boolean
}

/** JSON-able value inside the formatted tfs structure. */
export type TfsJson = string | number | null | readonly TfsJson[]
