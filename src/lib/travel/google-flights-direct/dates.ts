/**
 * Cheapest-date calendar search (GetCalendarGraph) — faithful port of
 * fli/search/dates.py + the DateSearchFilters model in
 * fli/models/google_flights/dates.py.
 *
 * Calendar item layout (item = one entry of the response's terminal array):
 *   item[0]        outbound date "YYYY-MM-DD"
 *   item[1]        return date "YYYY-MM-DD" (round trip)
 *   item[2][0][1]  price (number)
 *   item[2][1]     currency token (same protobuf token as flight rows)
 */

import { postCalendar } from "./client"
import type { PostOptions } from "./client"
import { extractCurrencyFromPriceToken } from "./currency"
import {
  buildAirlineTokens,
  flightDataToSegment,
  inferTripType,
  localTodayIso,
  normalizeAirportCode,
  normalizeDate,
  quoteLikePython,
} from "./filters"
import { EmissionsFilter, MaxStops, SeatType, TripType } from "./types"
import type {
  AirlineCode,
  Alliance,
  BagsFilter,
  FlightData,
  FlightSegment,
  LayoverRestrictions,
  PassengerInfo,
  PriceLimit,
  TfsJson,
} from "./types"
import { parseFirstWrbPayload } from "./wire"

/** Python: SearchDates.MAX_DAYS_PER_SEARCH (can't search >305 days out). */
export const MAX_DAYS_PER_SEARCH = 61

/** Python: MAX_PAST_FROM_DATE_DAYS — past from_dates older than this clamp to today. */
const MAX_PAST_FROM_DATE_DAYS = 6

/** Flight price for a specific date. (Python: DatePrice) */
export interface DatePrice {
  /** Outbound date, YYYY-MM-DD. */
  readonly date: string
  /** Return date, YYYY-MM-DD — null for one-way searches. */
  readonly returnDate: string | null
  readonly price: number
  readonly currency: string | null
}

/** Mirror of Python's DateSearchFilters model (public for parity/testing). */
export interface DateSearchFilters {
  readonly tripType: TripType
  readonly passengerInfo: PassengerInfo
  readonly flightSegments: readonly FlightSegment[]
  readonly stops: MaxStops
  readonly seatType: SeatType
  readonly priceLimit: PriceLimit | null
  readonly airlines: readonly AirlineCode[] | null
  readonly airlinesExclude: readonly AirlineCode[] | null
  readonly alliances: readonly Alliance[] | null
  readonly alliancesExclude: readonly Alliance[] | null
  readonly maxDuration: number | null
  readonly layoverRestrictions: LayoverRestrictions | null
  readonly emissions: EmissionsFilter
  readonly bags: BagsFilter | null
  readonly fromDate: string
  readonly toDate: string
  readonly duration: number | null
}

// ---------------------------------------------------------------------------
// Date math (UTC-anchored, YYYY-MM-DD strings)
// ---------------------------------------------------------------------------

const isoToUtcMs = (iso: string): number =>
  Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))

const dayDiff = (fromIso: string, toIso: string): number =>
  Math.round((isoToUtcMs(toIso) - isoToUtcMs(fromIso)) / 86_400_000)

const addDays = (iso: string, days: number): string => {
  const d = new Date(isoToUtcMs(iso) + days * 86_400_000)
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${d.getUTCFullYear()}-${mo}-${day}`
}

const minIso = (a: string, b: string): string => (a <= b ? a : b)

// ---------------------------------------------------------------------------
// format() / encode() — port of DateSearchFilters.format()/encode()
// ---------------------------------------------------------------------------

/** One formatted segment — flights layout, but [8]=null and [14]=3 hardcoded. */
function formatDateSegment(filters: DateSearchFilters, segment: FlightSegment): readonly TfsJson[] {
  const r = segment.timeRestrictions ?? null
  const timeFilters: TfsJson = r
    ? [r.earliestDeparture ?? null, r.latestDeparture ?? null, r.earliestArrival ?? null, r.latestArrival ?? null]
    : null
  const layover = filters.layoverRestrictions ?? null
  const layoverAirports =
    layover?.airports && layover.airports.length > 0
      ? layover.airports.map(normalizeAirportCode)
      : null
  return [
    [segment.departureAirport.map(([code, kind]) => [normalizeAirportCode(code), kind])], // 0
    [segment.arrivalAirport.map(([code, kind]) => [normalizeAirportCode(code), kind])], // 1
    timeFilters, // 2: time restrictions
    filters.stops, // 3: stops int
    buildAirlineTokens(filters.airlines, filters.alliances), // 4: INCLUDE list
    buildAirlineTokens(filters.airlinesExclude, filters.alliancesExclude), // 5: EXCLUDE list
    segment.travelDate, // 6: travel date
    filters.maxDuration ? [filters.maxDuration] : null, // 7: max duration
    null, // 8: selected flight (unused in date search)
    layoverAirports, // 9: layover airport include list
    null, // 10: ? (rejects scalars; no observed effect)
    layover?.minDuration ?? null, // 11: min layover duration (mins)
    layover?.maxDuration ?? null, // 12: max layover duration (mins)
    filters.emissions !== EmissionsFilter.ALL ? [filters.emissions] : null, // 13
    3, // 14: classifier hardcoded
  ]
}

/**
 * Format date filters into the GetCalendarGraph structure.
 * Differences vs the flights payload: outer[0] is null (not []), the main
 * struct ends at index 17, outer[2] is [fromDate, toDate], and round trips
 * append (null, [duration, duration]).
 */
export function formatDateFilters(filters: DateSearchFilters): readonly TfsJson[] {
  const formattedSegments = filters.flightSegments.map((s) => formatDateSegment(filters, s))
  const bags = filters.bags ?? null
  const passengers = filters.passengerInfo
  const main: readonly TfsJson[] = [
    null, // [0] seemingly no effect
    null, // [1] seemingly no effect (not currency)
    filters.tripType, // [2] trip type
    null, // [3] seemingly no effect
    [], // [4] seemingly no effect
    filters.seatType, // [5] seat/cabin type
    [passengers.adults, passengers.children, passengers.infantsOnLap, passengers.infantsInSeat],
    filters.priceLimit ? [null, filters.priceLimit.maxPrice] : null, // [7] price limit
    null, // [8] seemingly no effect
    null, // [9] seemingly no effect
    bags ? [bags.checkedBags, bags.carryOn ? 1 : 0] : null, // [10] bags filter
    null, // [11] seemingly no effect
    null, // [12] seemingly no effect
    formattedSegments, // [13] flight segments
    null, // [14] seemingly no effect
    null, // [15] seemingly no effect
    null, // [16] seemingly no effect
    1, // [17] historically 1; value doesn't seem to matter
  ]
  const durationFilters: readonly TfsJson[] =
    filters.tripType === TripType.ROUND_TRIP
      ? [null, [filters.duration, filters.duration]]
      : []
  return [null, main, [filters.fromDate, filters.toDate], ...durationFilters]
}

/** URL-encode for the f.req body. (Python: DateSearchFilters.encode()) */
export function encodeDateFilters(filters: DateSearchFilters): string {
  const formattedJson = JSON.stringify(formatDateFilters(filters))
  return quoteLikePython(JSON.stringify([null, formattedJson]))
}

// ---------------------------------------------------------------------------
// Filter construction + validation (port of the pydantic validators)
// ---------------------------------------------------------------------------

/** Search-window parameters for the cheapest-date calendar. */
export interface DateGridParams {
  /** One leg for one-way, two mirrored legs for round trip (travel dates anchor the grid). */
  readonly flightData: readonly FlightData[]
  /** Start of the date window, YYYY-MM-DD. */
  readonly fromDate: string
  /** End of the date window, YYYY-MM-DD. */
  readonly toDate: string
  /** Trip length in days — REQUIRED for round trips (Python parity). */
  readonly duration?: number | null
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
  readonly emissions?: EmissionsFilter
  readonly bags?: BagsFilter | null
  readonly currency?: string | null
  readonly language?: string | null
  readonly country?: string | null
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

/** Port of the validators on DateSearchFilters (trip shape + date window). */
function validateDateFilters(filters: DateSearchFilters): void {
  const segments = filters.flightSegments
  if (filters.tripType === TripType.ONE_WAY && segments.length !== 1) {
    throw new Error("One-way trip must have one flight segment")
  }
  if (filters.tripType === TripType.ROUND_TRIP) {
    if (segments.length !== 2) throw new Error("Round trip must have two flight segments")
    if (filters.duration === null) throw new Error("Duration must be set for round trip flights")
  }
  if (filters.duration !== null && segments.length === 2) {
    const first = segments[0] as FlightSegment
    const second = segments[1] as FlightSegment
    if (dayDiff(first.travelDate, second.travelDate) !== filters.duration) {
      throw new Error("Flight segments travel dates difference must match duration")
    }
  }
  if (filters.toDate <= localTodayIso()) throw new Error("To date must be in the future")
}

/** Normalize the window: swap reversed bounds, clamp far-past from_dates to today. */
function normalizeWindow(fromDate: string, toDate: string): readonly [string, string] {
  let from = normalizeDate(fromDate)
  let to = normalizeDate(toDate)
  if (from > to) [from, to] = [to, from]
  const today = localTodayIso()
  if (from < today && dayDiff(from, today) > MAX_PAST_FROM_DATE_DAYS) from = today
  return [from, to]
}

export function buildDateFilters(params: DateGridParams): DateSearchFilters {
  if (params.flightData.length === 0) throw new Error("flightData must contain at least one leg")
  const [fromDate, toDate] = normalizeWindow(params.fromDate, params.toDate)
  const filters: DateSearchFilters = {
    tripType: params.tripType ?? inferTripType(params.flightData),
    passengerInfo: { adults: 1, children: 0, infantsInSeat: 0, infantsOnLap: 0, ...params.passengers },
    flightSegments: params.flightData.map(flightDataToSegment),
    stops: params.stops ?? MaxStops.ANY,
    seatType: params.seatType ?? SeatType.ECONOMY,
    priceLimit: params.priceLimit ?? null,
    airlines: params.airlines ?? null,
    airlinesExclude: params.airlinesExclude ?? null,
    alliances: params.alliances ?? null,
    alliancesExclude: params.alliancesExclude ?? null,
    maxDuration: params.maxDuration ?? null,
    layoverRestrictions: params.layoverRestrictions ?? null,
    emissions: params.emissions ?? EmissionsFilter.ALL,
    bags: params.bags ?? null,
    fromDate,
    toDate,
    duration: params.duration ?? null,
  }
  validateDateFilters(filters)
  return filters
}

// ---------------------------------------------------------------------------
// Chunking (>61-day windows) — port of SearchDates._build_chunk_filters
// ---------------------------------------------------------------------------

function buildChunkFilters(filters: DateSearchFilters): readonly DateSearchFilters[] {
  const chunks: DateSearchFilters[] = []
  let currentFrom = filters.fromDate
  let chunkIndex = 0
  while (dayDiff(currentFrom, filters.toDate) >= 0) {
    const currentTo = minIso(addDays(currentFrom, MAX_DAYS_PER_SEARCH - 1), filters.toDate)
    const shift = MAX_DAYS_PER_SEARCH * chunkIndex
    const segments =
      chunkIndex === 0
        ? filters.flightSegments
        : filters.flightSegments.map((s) => ({ ...s, travelDate: addDays(s.travelDate, shift) }))
    chunks.push({ ...filters, flightSegments: segments, fromDate: currentFrom, toDate: currentTo })
    currentFrom = addDays(currentTo, 1)
    chunkIndex += 1
  }
  return chunks
}

// ---------------------------------------------------------------------------
// Response decoding — port of SearchDates.__parse_date/__parse_price/__parse_currency
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const parseGridDate = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new Error(`Date grid ${label} is not YYYY-MM-DD: ${String(value)}`)
  }
  return value
}

/** Price at item[2][0][1]; null when absent/invalid. (Python: __parse_price) */
function parseGridPrice(item: unknown): number | null {
  if (!Array.isArray(item) || item.length <= 2) return null
  const block: unknown = item[2]
  if (!Array.isArray(block) || block.length === 0) return null
  const head: unknown = block[0]
  if (!Array.isArray(head) || head.length <= 1) return null
  const raw: unknown = head[1]
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN
  return Number.isFinite(n) ? n : null
}

/** Currency token at item[2][1]. (Python: __parse_currency) */
function parseGridCurrency(item: unknown): string | null {
  if (!Array.isArray(item) || item.length <= 2) return null
  const block: unknown = item[2]
  if (!Array.isArray(block) || block.length <= 1) return null
  return extractCurrencyFromPriceToken(block[1])
}

/** One GetCalendarGraph call for a single <=61-day chunk. (Python: _search_chunk) */
async function searchDateChunk(
  filters: DateSearchFilters,
  post: PostOptions,
): Promise<readonly DatePrice[]> {
  const encoded = encodeDateFilters(filters)
  const body = await postCalendar(encoded, post)
  const data = parseFirstWrbPayload(body)
  if (data === null || data === undefined) return []
  if (!Array.isArray(data) || data.length === 0) {
    console.warn("[google-flights-direct] Date search response shape unexpected: no terminal array")
    return []
  }
  const items: unknown = data[data.length - 1]
  if (!Array.isArray(items)) return []
  const results: DatePrice[] = []
  for (const item of items) {
    const price = parseGridPrice(item)
    if (!price) continue // Python: `if self.__parse_price(item)` — 0 is excluded too
    const row = item as readonly unknown[]
    results.push({
      date: parseGridDate(row[0], "outbound date"),
      returnDate:
        filters.tripType === TripType.ONE_WAY ? null : parseGridDate(row[1], "return date"),
      price,
      currency: parseGridCurrency(item),
    })
  }
  return results
}

/**
 * Search flight prices across a date range — the cheapest-date calendar.
 * (Python: SearchDates.search)
 *
 * Windows longer than 61 days are split into parallel chunk requests with
 * the segment travel dates advanced per chunk (the client's global rate
 * limiter spaces the POSTs). Returns one {date, price} entry per date that
 * Google priced; empty array when no results.
 */
export async function searchDateGrid(params: DateGridParams): Promise<readonly DatePrice[]> {
  const filters = buildDateFilters(params)
  const post: PostOptions = {
    currency: params.currency,
    language: params.language,
    country: params.country,
    timeoutMs: params.timeoutMs,
    signal: params.signal,
  }
  const rangeDays = dayDiff(filters.fromDate, filters.toDate) + 1
  const chunkFilters =
    rangeDays <= MAX_DAYS_PER_SEARCH ? [filters] : buildChunkFilters(filters)
  const chunkResults = await Promise.all(chunkFilters.map((cf) => searchDateChunk(cf, post)))
  return chunkResults.flat()
}
