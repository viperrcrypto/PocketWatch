/**
 * Pure response decoders for GetShoppingResults flight rows — faithful port
 * of the flight half of fli/search/_decoders.py.
 *
 * These functions take the already-deserialised inner-JSON value of a
 * `wrb.fr` chunk (see wire.ts) and produce typed FlightResult objects.
 * Index positions are the reverse-engineered wire layout — a wrong index
 * yields garbage or zero results. Mirror the Python literally.
 *
 * Flight row layout (row = one entry of inner[2][0] / inner[3][0]):
 *   row[0]            detail block
 *   row[1]            price block [[..., price], currencyToken]
 *   row[8]            per-row booking token (string)
 *   row[10]           mixed cabin (bool)
 *   detail[0]         primary airline IATA code ("multi" = codeshare placeholder)
 *   detail[1][0]      primary airline display name
 *   detail[2]         legs array
 *   detail[9]         total duration (minutes)
 *   detail[12]        self transfer (bool)
 *   detail[13]        layover entries [durMins, IATA, IATA, null, airportName, city, ...]
 *   detail[22]        emissions block ([3] deltaPct, [7] thisG, [8] typicalG, [11] tag)
 *   leg[3]/leg[6]     departure / arrival airport IATA
 *   leg[4]/leg[5]     departure / arrival airport display names
 *   leg[8]/leg[10]    departure / arrival time [h, m]
 *   leg[20]/leg[21]   departure / arrival date [y, m, d]
 *   leg[11]           leg duration (minutes)
 *   leg[12]           amenities slots ([1] wifi, [5] power, [9] video, [11] legroom rating)
 *   leg[14]/leg[30]   legroom short / long
 *   leg[17]           aircraft
 *   leg[19]           overnight (bool)
 *   leg[22]           airline info [code, flightNumber, operatingCode]
 *   leg[31]           leg CO2 grams
 */

import { extractCurrencyFromPriceToken } from "./currency"
import { asBool, asInt, asNonNegativeInt, asStr, requirePositiveInt, safeGet } from "./decode-helpers"
import { isKnownAirport } from "./filters"
import type { Amenities, FlightLeg, FlightResult, Layover } from "./result-types"

// Pseudo-codes Google emits in place of a real IATA carrier identifier.
// Treat as "no single primary airline". (Python: _AIRLINE_SENTINELS)
const AIRLINE_SENTINELS: ReadonlySet<string> = new Set(["multi"])

/** Parse an airline code defensively; null on missing/sentinel. (Python: _safe_airline)
 *  Deviation: unknown codes pass through (no vendored Airline enum). */
function safeAirline(code: unknown): string | null {
  if (typeof code !== "string" || code.length === 0) return null
  if (AIRLINE_SENTINELS.has(code)) return null
  return code
}

// Warn once per unknown airport code (Python warns per occurrence via logger).
const warnedAirports = new Set<string>()

/**
 * Validate an airport code leniently against airport-data.ts.
 * Deviation from Python (which skips the row on unknown Airport enum codes):
 * unknown codes pass through unchanged — Google is the source of truth.
 */
function parseAirport(code: unknown): string {
  if (typeof code !== "string" || code.length === 0) {
    throw new Error(`airport code missing: ${String(code)}`)
  }
  if (!isKnownAirport(code) && !warnedAirports.has(code)) {
    warnedAirports.add(code)
    console.warn(`[google-flights-direct] Unknown airport IATA code ${code} — passing through`)
  }
  return code
}

const pad = (n: number, width: number): string => String(n).padStart(width, "0")

const toComponent = (x: unknown): number => {
  if (x === null || x === undefined) return 0
  if (typeof x === "number" && Number.isInteger(x)) return x
  throw new Error(`non-integer datetime component: ${String(x)}`)
}

/**
 * Convert [y,m,d] + [h,m] arrays into a local-naive ISO string.
 * (Python: _parse_datetime → datetime(*(x or 0)...); the Date.UTC round-trip
 * reproduces Python's component validation, e.g. month 0 raises.)
 */
function parseDateTime(dateArr: unknown, timeArr: unknown): string {
  if (!Array.isArray(dateArr) || !Array.isArray(timeArr)) {
    throw new Error("date/time arrays missing")
  }
  const dateHasValue = dateArr.some((x) => x !== null && x !== undefined)
  const timeHasValue = timeArr.some((x) => x !== null && x !== undefined)
  if (!dateHasValue || !timeHasValue) {
    throw new Error("Date and time arrays must contain at least one non-None value")
  }
  const [y = 0, mo = 0, d = 0] = dateArr.map(toComponent)
  const [h = 0, mi = 0] = timeArr.map(toComponent)
  const check = new Date(Date.UTC(y, mo - 1, d, h, mi))
  const valid =
    check.getUTCFullYear() === y &&
    check.getUTCMonth() === mo - 1 &&
    check.getUTCDate() === d &&
    check.getUTCHours() === h &&
    check.getUTCMinutes() === mi
  if (!valid) throw new Error(`invalid datetime components: ${y}-${mo}-${d} ${h}:${mi}`)
  return `${pad(y, 4)}-${pad(mo, 2)}-${pad(d, 2)}T${pad(h, 2)}:${pad(mi, 2)}`
}

/** Naive-datetime millis for layover math (mirrors Python naive subtraction). */
const isoToNaiveMs = (iso: string): number =>
  Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
    Number(iso.slice(11, 13)),
    Number(iso.slice(14, 16)),
  )

/**
 * Decode the 12-slot amenities array at leg[12]. (Python: _parse_amenities)
 * Slots: 1 wifi, 5 power outlet, 9 on-demand video, 11 legroom rating.
 * Returns null when no known slot carries a usable value.
 */
function parseAmenities(slots: unknown): Amenities | null {
  if (!Array.isArray(slots) || slots.length === 0) return null
  const wifi = asBool(safeGet(slots, 1))
  const power = asBool(safeGet(slots, 5))
  const onDemandVideo = asBool(safeGet(slots, 9))
  const legroomRating = asNonNegativeInt(safeGet(slots, 11))
  if (wifi === null && power === null && onDemandVideo === null && legroomRating === null) {
    return null
  }
  return { wifi, power, usbPower: null, inSeatVideo: null, onDemandVideo, legroomRating }
}

interface EmissionsInfo {
  readonly thisG: number | null
  readonly typicalG: number | null
  readonly deltaPct: number | null
  readonly tag: "lower" | "typical" | "higher" | null
}

const EMISSIONS_TAGS: Readonly<Record<number, "lower" | "typical" | "higher">> = {
  1: "lower",
  2: "typical",
  3: "higher",
}

/** Extract the four emissions metrics from detail[22]. (Python: _parse_emissions) */
function parseEmissions(detail: readonly unknown[]): EmissionsInfo {
  const block = safeGet(detail, 22)
  if (!Array.isArray(block)) return { thisG: null, typicalG: null, deltaPct: null, tag: null }
  const tagInt = asInt(safeGet(block, 11))
  return {
    thisG: asNonNegativeInt(safeGet(block, 7)),
    typicalG: asNonNegativeInt(safeGet(block, 8)),
    deltaPct: asInt(safeGet(block, 3)),
    tag: tagInt !== null ? (EMISSIONS_TAGS[tagInt] ?? null) : null,
  }
}

/**
 * Compute layovers from consecutive leg timestamps. (Python: _derive_layovers)
 * Durations / overnight / change-of-airport are derived structurally from the
 * parsed legs; Google's detail[13] block contributes airport name + city for
 * each layover but never overrides the derived numbers.
 */
function deriveLayovers(legs: readonly FlightLeg[], detailBlock: unknown): readonly Layover[] {
  const detailEntries: readonly unknown[] = Array.isArray(detailBlock) ? detailBlock : []
  const layovers: Layover[] = []
  for (let i = 0; i < legs.length - 1; i += 1) {
    const prev = legs[i] as FlightLeg
    const nxt = legs[i + 1] as FlightLeg
    const waitMs = isoToNaiveMs(nxt.departureDateTime) - isoToNaiveMs(prev.arrivalDateTime)
    const deltaMinutes = Math.max(Math.floor(waitMs / 60_000), 0)
    const entry = i < detailEntries.length ? detailEntries[i] : null
    layovers.push({
      airport: prev.arrivalAirport,
      durationMinutes: deltaMinutes,
      overnight: prev.arrivalDateTime.slice(0, 10) !== nxt.departureDateTime.slice(0, 10),
      changeOfAirport: prev.arrivalAirport !== nxt.departureAirport,
      airportName: asStr(safeGet(entry, 4)),
      city: asStr(safeGet(entry, 5)),
    })
  }
  return layovers
}

interface PriceInfo {
  readonly price: number | null
  readonly currency: string | null
}

/**
 * Extract numeric price + ISO currency from the price block at row[1].
 * (Python: _parse_price_info + _get_price_block)
 *
 * `[[], "<token>"]` — an empty head — is Google's "no shopping-list price"
 * marker (premium-cabin round-trips): return price null, keep the row.
 * Genuinely malformed blocks throw, and the caller skips the row.
 */
function parsePriceInfo(row: readonly unknown[]): PriceInfo {
  const block = safeGet(row, 1)
  if (!Array.isArray(block)) throw new Error("price block missing — skip row")
  const head: unknown = block[0]
  if (!Array.isArray(head)) throw new Error("price head is not a list")
  let price: number | null = null
  if (head.length > 0) {
    const rawPrice: unknown = head[head.length - 1]
    if (typeof rawPrice !== "number" || !Number.isFinite(rawPrice)) {
      throw new Error(`price field is not numeric: ${String(rawPrice)}`)
    }
    price = rawPrice
  }
  // Currency is optional metadata; decode failure is not fatal.
  const currency = block.length > 1 ? extractCurrencyFromPriceToken(block[1]) : null
  return { price, currency }
}

/** Decode a single leg array. (Python: _parse_leg — indices in the header map) */
function parseLeg(fl: unknown): FlightLeg {
  if (!Array.isArray(fl)) throw new Error("flight leg is not a list")
  const airlineInfo: unknown = fl[22] ?? []
  if (!Array.isArray(airlineInfo)) throw new Error("airline info block malformed")
  const airline = safeAirline(safeGet(airlineInfo, 0))
  // Python: FlightLeg.airline is required — a missing code skips the row.
  if (airline === null) throw new Error("leg airline code missing")
  const opCode = safeGet(airlineInfo, 2)
  const legroomShort = asStr(safeGet(fl, 14))
  const legroomLong = asStr(safeGet(fl, 30))
  return {
    airline,
    flightNumber: asStr(safeGet(airlineInfo, 1)) ?? "",
    departureAirport: parseAirport(fl[3]),
    arrivalAirport: parseAirport(fl[6]),
    departureDateTime: parseDateTime(fl[20], fl[8]),
    arrivalDateTime: parseDateTime(fl[21], fl[10]),
    durationMinutes: requirePositiveInt(fl[11], "leg duration"),
    departureAirportName: asStr(safeGet(fl, 4)),
    arrivalAirportName: asStr(safeGet(fl, 5)),
    operatingAirline: opCode ? safeAirline(opCode) : null,
    operatingFlightNumber: null,
    aircraft: asStr(safeGet(fl, 17)),
    legroomShort,
    legroom: legroomLong ?? legroomShort,
    amenities: parseAmenities(safeGet(fl, 12)),
    overnight: asBool(safeGet(fl, 19)) ?? false,
    co2EmissionsG: asNonNegativeInt(safeGet(fl, 31)),
  }
}

/**
 * Decode a single flight row into a structured FlightResult.
 * (Python: parse_flight_row)
 *
 * Throws on malformed rows; callers should treat that as "skip this row"
 * rather than a hard failure (Google occasionally returns half-populated
 * rows for advert / sponsor placements).
 */
export function parseFlightRow(row: unknown): FlightResult {
  if (!Array.isArray(row)) throw new Error("flight row is not a list")
  const detail: unknown = row[0]
  if (!Array.isArray(detail)) throw new Error("flight detail block missing")
  const { price, currency } = parsePriceInfo(row)

  const rawLegs: unknown = detail[2] ?? []
  if (!Array.isArray(rawLegs)) throw new Error("legs block is not a list")
  const legs = rawLegs.map((fl) => parseLeg(fl))
  const layovers = legs.length > 1 ? deriveLayovers(legs, safeGet(detail, 13)) : null

  const emissions = parseEmissions(detail)
  const primaryAirline = safeAirline(safeGet(detail, 0))
  const namesField = safeGet(detail, 1)
  const primaryAirlineName = asStr(safeGet(namesField, 0))

  const firstLeg = legs[0]
  const lastLeg = legs[legs.length - 1]
  if (!firstLeg || !lastLeg) throw new Error("flight row has no legs")

  return {
    legs,
    price,
    currency,
    durationMinutes: requirePositiveInt(detail[9], "total duration"),
    stops: Math.max(legs.length - 1, 0),
    airline: primaryAirline ?? firstLeg.airline,
    departure: firstLeg.departureDateTime,
    arrival: lastLeg.arrivalDateTime,
    layovers: layovers && layovers.length > 0 ? layovers : null,
    co2EmissionsG: emissions.thisG,
    co2EmissionsTypicalG: emissions.typicalG,
    co2EmissionsDeltaPct: emissions.deltaPct,
    emissionsTag: emissions.tag,
    selfTransfer: asBool(safeGet(detail, 12)),
    mixedCabin: asBool(safeGet(row, 10)),
    primaryAirline,
    primaryAirlineName,
    bookingToken: asStr(safeGet(row, 8)),
  }
}
