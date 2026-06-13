/**
 * Minimal protobuf wire-format encoder — faithful port of fli/search/_proto.py.
 *
 * Implements only the primitives needed (varint, length-delimited
 * string/bytes, nested message) plus two token builders:
 *
 * 1. buildBookingToken — the GetBookingResults outer[0][1] token.
 * 2. buildTfsToken — the `tfs` deep-link itinerary token embedded in
 *    https://www.google.com/travel/flights/booking?tfs=…
 *
 * Field numbers, constants (28, 2, max-u64, f19) and byte order are
 * reverse-engineered values from the Python source — do not "clean up".
 */

const textEncoder = new TextEncoder()

/** One physical leg within a booking-URL segment. (Python: LegSpec) */
export interface LegSpec {
  /** IATA code of the departure airport (e.g. "SFO"). */
  readonly origin: string
  /** Departure date in YYYY-MM-DD format. */
  readonly depDate: string
  /** IATA code of the arrival airport (e.g. "PHX"). */
  readonly dest: string
  /** Airline IATA code (e.g. "AA"). */
  readonly airline: string
  /** Flight number string (e.g. "2413"). */
  readonly flightNumber: string
}

/** Concatenate byte chunks into a single Uint8Array. */
export function concatBytes(...chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/** Encode an unsigned integer as a protobuf varint. (Python: _varint) */
export function encodeVarint(value: number | bigint): Uint8Array {
  let v = typeof value === "bigint" ? value : BigInt(value)
  if (v < 0n) throw new RangeError("varint encoder takes non-negative ints only")
  const out: number[] = []
  for (;;) {
    const byte = Number(v & 0x7fn)
    v >>= 7n
    if (v > 0n) {
      out.push(byte | 0x80)
    } else {
      out.push(byte)
      return Uint8Array.from(out)
    }
  }
}

/** Encode a protobuf field tag (field_number << 3 | wire_type). (Python: _tag) */
export function encodeTag(field: number, wire: number): Uint8Array {
  return encodeVarint((field << 3) | wire)
}

/** Encode a length-delimited field (wire type 2). (Python: _length_delim) */
export function lengthDelim(field: number, payload: Uint8Array): Uint8Array {
  return concatBytes(encodeTag(field, 2), encodeVarint(payload.length), payload)
}

/** Length-delimited field from a UTF-8 string (Python: payload.encode("utf-8")). */
export function lengthDelimText(field: number, text: string): Uint8Array {
  return lengthDelim(field, textEncoder.encode(text))
}

/** Encode a varint field (wire type 0). (Python: _varint_field) */
export function varintField(field: number, value: number | bigint): Uint8Array {
  return concatBytes(encodeTag(field, 0), encodeVarint(value))
}

/** Read one varint; returns [value, nextOffset]. (Python: _read_varint) */
export function readVarint(buf: Uint8Array, off: number): readonly [number | bigint, number] {
  let value = 0n
  let shift = 0n
  let offset = off
  for (;;) {
    const byte = buf[offset]
    if (byte === undefined) throw new RangeError("varint truncated")
    offset += 1
    value |= BigInt(byte & 0x7f) << shift
    if ((byte & 0x80) === 0) {
      const asNumber = value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value
      return [asNumber, offset]
    }
    shift += 7n
  }
}

/**
 * Construct the GetBookingResults outer[0][1] token. (Python: build_booking_token)
 *
 * Layout (reverse-engineered 2026-05-14 per the Python source):
 *   field 1 (len): shopping session id (search response inner[0][4])
 *   field 2 (len): "{airline}{flightNo}#{legIndex}"
 *   field 3 (len, nested): f1 varint priceCents, f2 varint 2, f3 len currency
 *   field 7 (varint): 28
 *   field 14 (varint): priceCents (duplicated)
 * Returned as STANDARD-alphabet base64 (captured tokens use + and /).
 */
export function buildBookingToken(
  sessionId: string,
  airlineCode: string,
  flightNumber: string,
  legIndex: number,
  priceCents: number,
  currency = "USD",
): string {
  if (priceCents < 0) throw new RangeError("priceCents must be non-negative")
  if (!sessionId) throw new RangeError("sessionId must be non-empty")
  if (!airlineCode) throw new RangeError("airlineCode must be non-empty")
  if (!flightNumber) throw new RangeError("flightNumber must be non-empty")
  if (!currency) throw new RangeError("currency must be non-empty")

  const nested = concatBytes(
    varintField(1, priceCents),
    varintField(2, 2),
    lengthDelimText(3, currency),
  )
  const payload = concatBytes(
    lengthDelimText(1, sessionId),
    lengthDelimText(2, `${airlineCode}${flightNumber}#${legIndex}`),
    lengthDelim(3, nested),
    varintField(7, 28),
    varintField(14, priceCents),
  )
  return Buffer.from(payload).toString("base64")
}

export type DecodedScalar = number | bigint | string
export type DecodedToken = Record<string, DecodedScalar | Record<string, DecodedScalar>>

const isPrintableAscii = (data: Uint8Array): boolean =>
  data.every((byte) => byte >= 0x20 && byte <= 0x7e)

const asciiWithReplacement = (data: Uint8Array): string =>
  Array.from(data, (byte) => (byte <= 0x7f ? String.fromCharCode(byte) : "�")).join("")

/** Decode a flat nested message (varint + string fields only). */
function decodeNestedMessage(data: Uint8Array): Record<string, DecodedScalar> {
  const nested: Record<string, DecodedScalar> = {}
  let off = 0
  while (off < data.length) {
    const [tag, afterTag] = readVarint(data, off)
    off = afterTag
    const field = Number(tag) >> 3
    const wire = Number(tag) & 0x7
    if (wire === 0) {
      const [value, next] = readVarint(data, off)
      nested[`field_${field}`] = value
      off = next
    } else if (wire === 2) {
      const [length, next] = readVarint(data, off)
      off = next
      nested[`field_${field}`] = asciiWithReplacement(data.subarray(off, off + Number(length)))
      off += Number(length)
    } else {
      nested[`field_${field}`] = `<wire ${wire}>`
    }
  }
  return nested
}

/**
 * Decode a booking token for debugging / round-trip tests.
 * Mirrors Python's decode_booking_token (printable-ASCII strings preferred,
 * nested message fallback, hex as the last resort).
 */
export function decodeBookingToken(token: string): DecodedToken {
  const padded = token + "=".repeat((4 - (token.length % 4)) % 4)
  const raw = new Uint8Array(
    Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
  )
  const result: DecodedToken = {}
  let offset = 0
  while (offset < raw.length) {
    const [tag, afterTag] = readVarint(raw, offset)
    offset = afterTag
    const field = Number(tag) >> 3
    const wire = Number(tag) & 0x7
    if (wire === 0) {
      const [value, next] = readVarint(raw, offset)
      result[`field_${field}`] = value
      offset = next
    } else if (wire === 2) {
      const [length, next] = readVarint(raw, offset)
      offset = next
      const data = raw.subarray(offset, offset + Number(length))
      offset += Number(length)
      if (isPrintableAscii(data)) {
        result[`field_${field}`] = asciiWithReplacement(data)
        continue
      }
      try {
        result[`field_${field}`] = decodeNestedMessage(data)
      } catch {
        result[`field_${field}`] = Buffer.from(data).toString("hex")
      }
    } else {
      throw new Error(`unsupported wire type ${wire} at offset ${offset}`)
    }
  }
  return result
}

/** URL-safe base64 without "=" padding. (Python: _to_urlsafe_b64) */
export function toUrlsafeB64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64url")
}

/** Encode one leg as the repeated f4 message within a tfs segment. */
function encodeLegSpec(leg: LegSpec): Uint8Array {
  const legProto = concatBytes(
    lengthDelimText(1, leg.origin),
    lengthDelimText(2, leg.depDate),
    lengthDelimText(3, leg.dest),
    lengthDelimText(5, leg.airline),
    lengthDelimText(6, leg.flightNumber),
  )
  return lengthDelim(4, legProto)
}

/** Encode one travel direction as the repeated f3 message of the tfs payload. */
function encodeTfsSegment(seg: readonly LegSpec[]): Uint8Array {
  const first = seg[0]
  const last = seg[seg.length - 1]
  if (!first || !last) throw new RangeError("segment has no legs")
  const legsProto = concatBytes(...seg.map(encodeLegSpec))
  const segProto = concatBytes(
    lengthDelimText(2, first.depDate),
    legsProto,
    lengthDelim(13, concatBytes(varintField(1, 1), lengthDelimText(2, first.origin))),
    lengthDelim(14, concatBytes(varintField(1, 1), lengthDelimText(2, last.dest))),
  )
  return lengthDelim(3, segProto)
}

/**
 * Build the `tfs` query parameter for a Google Flights deep-link URL.
 * (Python: build_tfs_token, reverse-engineered 2026-05-28)
 *
 * @param segments Ordered travel directions; each is the list of physical
 *   legs in that direction (one for nonstop, more for connections).
 * @param isOneWay true for one-way / multi-city, false for round-trip
 *   (controls the f19 constant: 2 vs 1).
 */
export function buildTfsToken(
  segments: ReadonlyArray<readonly LegSpec[]>,
  isOneWay = true,
): string {
  if (segments.length === 0) throw new RangeError("segments must be non-empty")
  segments.forEach((seg, i) => {
    if (seg.length === 0) throw new RangeError(`segment ${i} has no legs`)
  })

  const segmentProtos = concatBytes(...segments.map(encodeTfsSegment))
  const MAX_U64 = (1n << 64n) - 1n
  const f19 = isOneWay ? 2 : 1

  const payload = concatBytes(
    varintField(1, 28),
    varintField(2, 2),
    segmentProtos,
    varintField(8, 1),
    varintField(9, 1),
    varintField(14, 1),
    lengthDelim(16, varintField(1, MAX_U64)),
    varintField(19, f19),
  )
  return toUrlsafeB64(payload)
}
