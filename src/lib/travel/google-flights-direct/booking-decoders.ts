/**
 * Booking-option decoders for GetBookingResults — faithful port of the
 * booking half of fli/search/_decoders.py.
 *
 * Booking row layout (positions verified from a live capture, May 2026):
 *   [0]     int index
 *   [1]     vendor list [[code, name, ?, isAirlineDirect]]
 *   [3]     flight list [[airlineCode, flightNo], ...]
 *   [5]     URL block [vendorUrl, null, [googleClickUrl, ...]]
 *   [7]     price block [[null, price], currencyToken]
 *   [14]    fare-code wrapper [[[null, [airline, FARE_CODE], 1]]]
 *   [21][3] human-readable fare name
 */

import { extractCurrencyFromPriceToken } from "./currency"
import type { BookingOption } from "./result-types"

/** Walk a decoded `wrb.fr` chunk and collect every booking-option row.
 *  (Python: parse_booking_chunk) */
export function parseBookingChunk(chunk: unknown): readonly BookingOption[] {
  const options: BookingOption[] = []
  walkForBookingRows(chunk, options)
  return options
}

/** Recurse into `node` looking for booking-row-shaped lists. (Python: _walk_for_booking_rows) */
function walkForBookingRows(node: unknown, out: BookingOption[]): void {
  if (!Array.isArray(node)) return
  const opt = tryParseBookingRow(node)
  if (opt !== null) {
    out.push(opt)
    return
  }
  for (const child of node) walkForBookingRows(child, out)
}

interface VendorInfo {
  readonly code: string
  readonly name: string
  readonly isDirect: boolean
}

/** Validate row[1] = [[code, name, ?, isAirlineDirect], ...]; null on shape mismatch. */
function parseVendorBlock(block: unknown): VendorInfo | null {
  if (!Array.isArray(block) || block.length === 0) return null
  const first: unknown = block[0]
  if (!Array.isArray(first) || first.length < 2) return null
  const code: unknown = first[0]
  const name: unknown = first[1]
  if (typeof code !== "string" || typeof name !== "string") return null
  const isDirect = first.length >= 4 && typeof first[3] === "boolean" ? first[3] : false
  return { code, name, isDirect }
}

/** Gather (airline, flightNumber) pairs from row[3]. */
function parseFlightsBlock(block: unknown): ReadonlyArray<readonly [string, string]> | null {
  if (!Array.isArray(block)) return null
  const gathered = block
    .filter(
      (entry): entry is readonly [string, string] =>
        Array.isArray(entry) &&
        entry.length >= 2 &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "string",
    )
    .map((entry) => [entry[0], entry[1]] as const)
  return gathered.length > 0 ? gathered : null
}

/** (Python: _extract_booking_urls) */
function extractBookingUrls(block: unknown): readonly [string | null, string | null] {
  if (!Array.isArray(block)) return [null, null]
  const vendorUrl = block.length > 0 && typeof block[0] === "string" ? block[0] : null
  let googleClickUrl: string | null = null
  if (block.length > 2 && Array.isArray(block[2]) && block[2].length > 0) {
    const candidate: unknown = block[2][0]
    if (typeof candidate === "string" && candidate.includes("/travel/clk")) {
      googleClickUrl = candidate
    }
  }
  return [vendorUrl, googleClickUrl]
}

/** Price + currency from row[7] (same block shape as flight rows). */
function parseBookingPrice(block: unknown): readonly [number | null, string | null] {
  if (!Array.isArray(block)) return [null, null]
  let price: number | null = null
  const head: unknown = block[0]
  if (Array.isArray(head) && head.length >= 2) {
    const rawPrice: unknown = head[head.length - 1]
    if (typeof rawPrice === "number" && Number.isFinite(rawPrice)) price = rawPrice
  }
  const currency =
    block.length > 1 && typeof block[1] === "string"
      ? extractCurrencyFromPriceToken(block[1])
      : null
  return [price, currency]
}

/** Prefer the human-readable name at row[21][3]; fall back to row[14][0][0][1][1].
 *  (Python: _extract_fare_name) */
function extractFareName(row: readonly unknown[]): string | null {
  if (row.length > 21 && Array.isArray(row[21]) && row[21].length > 3) {
    const candidate: unknown = row[21][3]
    if (typeof candidate === "string" && candidate.length > 0) return candidate
  }
  if (row.length > 14 && Array.isArray(row[14]) && row[14].length > 0) {
    const wrapper = row[14] as readonly unknown[]
    const level1 = Array.isArray(wrapper[0]) ? (wrapper[0] as readonly unknown[])[0] : null
    const level2 = Array.isArray(level1) ? (level1 as readonly unknown[])[1] : null
    const label = Array.isArray(level2) ? (level2 as readonly unknown[])[1] : null
    if (typeof label === "string" && label.length > 0) return label
  }
  return null
}

/**
 * Parse a booking row using positional indices; null when the shape doesn't
 * match — false positives are unwanted because the walker visits every
 * nested list. (Python: _try_parse_booking_row)
 */
function tryParseBookingRow(row: readonly unknown[]): BookingOption | null {
  if (row.length < 8) return null
  if (typeof row[0] !== "number" || !Number.isInteger(row[0])) return null
  const vendor = parseVendorBlock(row[1])
  if (vendor === null) return null

  const flights = parseFlightsBlock(row[3])
  const [bookingUrl, googleClickUrl] = extractBookingUrls(row[5])
  const [price, currency] = parseBookingPrice(row[7])

  return {
    vendorCode: vendor.code,
    vendorName: vendor.name,
    isAirlineDirect: vendor.isDirect,
    price,
    currency,
    fareName: extractFareName(row),
    bookingUrl,
    googleClickUrl,
    flights,
  }
}
