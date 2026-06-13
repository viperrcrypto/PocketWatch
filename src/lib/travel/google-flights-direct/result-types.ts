/**
 * Typed response models for the direct Google Flights client — faithful port
 * of the result half of fli/models/google_flights/base.py (Amenities,
 * Layover, FlightLeg, FlightResult, BookingOption).
 *
 * Differences from the Python source (intentional):
 * - Airline / Airport enums are NOT vendored (7,905-line enum): codes are
 *   plain IATA strings, validated leniently against airport-data.ts.
 * - datetimes are local-naive ISO strings ("YYYY-MM-DDTHH:mm") exactly as
 *   Google reports them — no timezone math is performed.
 * - `duration` fields are named `durationMinutes` for clarity.
 */

/**
 * Per-leg amenities reported by Google Flights. All fields are tri-state
 * (true, false, or null when Google did not publish that signal).
 */
export interface Amenities {
  readonly wifi: boolean | null
  readonly power: boolean | null
  readonly usbPower: boolean | null
  readonly inSeatVideo: boolean | null
  readonly onDemandVideo: boolean | null
  readonly legroomRating: number | null
}

/** Layover info between two flight legs. (Python: Layover) */
export interface Layover {
  /** IATA code of the layover airport (the previous leg's arrival). */
  readonly airport: string
  /** Wait time at the layover airport in minutes. */
  readonly durationMinutes: number
  /** Set when the layover crosses local midnight. */
  readonly overnight: boolean
  /** Set when the next leg departs from a different airport (e.g. JFK→LGA). */
  readonly changeOfAirport: boolean
  readonly city: string | null
  readonly airportName: string | null
}

/** A single flight leg (segment) with airline and timing details. (Python: FlightLeg) */
export interface FlightLeg {
  /** Airline IATA code (e.g. "AA"). */
  readonly airline: string
  readonly flightNumber: string
  /** IATA code (e.g. "JFK"). */
  readonly departureAirport: string
  readonly arrivalAirport: string
  /** Local-naive ISO "YYYY-MM-DDTHH:mm" (Python: departure_datetime). */
  readonly departureDateTime: string
  readonly arrivalDateTime: string
  readonly durationMinutes: number
  readonly departureAirportName: string | null
  readonly arrivalAirportName: string | null
  readonly operatingAirline: string | null
  readonly operatingFlightNumber: string | null
  readonly aircraft: string | null
  readonly legroom: string | null
  readonly legroomShort: string | null
  readonly amenities: Amenities | null
  readonly overnight: boolean
  readonly co2EmissionsG: number | null
}

/**
 * Complete flight search result with pricing and timing. (Python: FlightResult)
 *
 * `price` is null when Google did not surface a per-row aggregate price
 * (predictable for premium-cabin round-trips with multi-passenger configs) —
 * `bookingToken` is still populated in that case so GetBookingResults can
 * resolve real fares.
 */
export interface FlightResult {
  readonly legs: readonly FlightLeg[]
  readonly price: number | null
  readonly currency: string | null
  /** Total duration in minutes. (Python: duration) */
  readonly durationMinutes: number
  readonly stops: number
  /** Primary airline IATA code; falls back to the first leg's airline. */
  readonly airline: string | null
  /** Local-naive ISO departure of the first leg. */
  readonly departure: string
  /** Local-naive ISO arrival of the last leg. */
  readonly arrival: string
  readonly layovers: readonly Layover[] | null
  readonly co2EmissionsG: number | null
  readonly co2EmissionsTypicalG: number | null
  readonly co2EmissionsDeltaPct: number | null
  readonly emissionsTag: "lower" | "typical" | "higher" | null
  readonly selfTransfer: boolean | null
  readonly mixedCabin: boolean | null
  /** Google's row-level primary airline code (null when "multi"/absent). */
  readonly primaryAirline: string | null
  readonly primaryAirlineName: string | null
  /** Per-row booking token from row[8], when present. */
  readonly bookingToken: string | null
}

/** A single bookable fare exposed by GetBookingResults. (Python: BookingOption) */
export interface BookingOption {
  readonly vendorCode: string | null
  readonly vendorName: string | null
  readonly isAirlineDirect: boolean
  readonly price: number | null
  readonly currency: string | null
  readonly fareName: string | null
  readonly bookingUrl: string | null
  readonly googleClickUrl: string | null
  /** [(airlineCode, flightNumber), ...] or null when unknown. */
  readonly flights: ReadonlyArray<readonly [string, string]> | null
}
