/**
 * Wire-format reader for FlightsFrontendService responses — faithful port of
 * fli/search/_wire.py.
 *
 * The service returns JSONP-flavoured bodies of the form:
 *
 *   )]}'\n\n
 *   <chunk1_byte_len>\n
 *   [["wrb.fr", null, "<inner JSON string>"]]
 *   <chunk2_byte_len>\n
 *   [["wrb.fr", null, "<inner JSON string>"]]
 *   ...
 *
 * GetShoppingResults / GetCalendarGraph emit a single chunk with no length
 * headers; GetBookingResults emits two, so a proper multi-chunk reader is
 * required.
 *
 * Important quirk: the length headers count UTF-8 BYTES, not string
 * characters. Non-ASCII content (airport names, airline names) makes the
 * offsets diverge, so the reader operates over the byte representation.
 */

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** Python: _PREFIX = b")]}'" */
const PREFIX = textEncoder.encode(")]}'")

/** ASCII whitespace per Python bytes.lstrip(): \t \n \v \f \r space. */
const isWhitespaceByte = (byte: number): boolean => byte === 0x20 || (byte >= 0x09 && byte <= 0x0d)

const lstripBytes = (raw: Uint8Array): Uint8Array => {
  let start = 0
  while (start < raw.length && isWhitespaceByte(raw[start] as number)) start += 1
  return raw.subarray(start)
}

const startsWithPrefix = (raw: Uint8Array): boolean =>
  raw.length >= PREFIX.length && PREFIX.every((byte, i) => raw[i] === byte)

const findNewline = (raw: Uint8Array, from: number): number => {
  for (let i = from; i < raw.length; i += 1) {
    if (raw[i] === 0x0a) return i
  }
  return -1
}

/** JSON.parse over trimmed bytes; undefined on failure (JSON can't be undefined). */
function parseJsonBytes(payload: Uint8Array): unknown {
  try {
    return JSON.parse(textDecoder.decode(payload).trim()) as unknown
  } catch {
    return undefined
  }
}

/**
 * Walk a top-level chunk list and collect decoded inner-JSON payloads.
 * (Python: _chunks_from_outer)
 */
function chunksFromOuter(outer: unknown, out: unknown[]): void {
  if (!Array.isArray(outer)) return
  for (const row of outer) {
    if (!Array.isArray(row) || row.length < 3) continue
    if (row[0] !== "wrb.fr") continue
    const inner: unknown = row[2]
    if (typeof inner !== "string" || inner.length === 0) continue
    try {
      out.push(JSON.parse(inner) as unknown)
    } catch {
      console.warn("[google-flights-direct] Failed to decode wrb.fr inner JSON payload")
    }
  }
}

/** Read `<len>\n<chunk>` framing. (Python: the cursor loop in iter_wrb_chunks) */
function readLengthPrefixedChunks(raw: Uint8Array): readonly unknown[] {
  const chunks: unknown[] = []
  let cursor = 0
  while (cursor < raw.length) {
    // Read the decimal length prefix terminated by \n.
    const end = findNewline(raw, cursor)
    if (end === -1) break
    const header = textDecoder.decode(raw.subarray(cursor, end)).trim()
    if (!/^-?\d+$/.test(header)) {
      console.warn(
        `[google-flights-direct] Malformed length header at offset ${cursor}; truncating chunk stream`,
      )
      break
    }
    const length = Number(header)
    // Google's length header counts the leading newline after the header AND
    // the trailing newline that separates this chunk from the next. We've
    // already consumed the leading newline (it terminated the header), so we
    // read `length - 1` bytes which gives JSON + trailing \n.
    cursor = end + 1
    const chunkBytes = Math.max(length - 1, 0)
    const payload = raw.subarray(cursor, cursor + chunkBytes)
    cursor += chunkBytes
    const outer = parseJsonBytes(payload)
    if (outer === undefined) {
      console.warn("[google-flights-direct] Discarding malformed wrb.fr chunk")
      continue
    }
    chunksFromOuter(outer, chunks)
  }
  return chunks
}

/**
 * Return the inner JSON of every `wrb.fr` chunk in `body`.
 * (Python: iter_wrb_chunks — materialised to an array instead of a generator.)
 *
 * Robust to single-chunk responses with no length headers (the older
 * GetShoppingResults / GetCalendarGraph shape) — those fall back to a single
 * JSON parse over the trimmed body.
 */
export function splitWrbChunks(body: string | Uint8Array): readonly unknown[] {
  let raw = typeof body === "string" ? textEncoder.encode(body) : body
  raw = lstripBytes(raw)
  if (startsWithPrefix(raw)) raw = raw.subarray(PREFIX.length)
  raw = lstripBytes(raw)
  if (raw.length === 0) return []

  // Fast path: no length headers (legacy single-chunk responses).
  const first = raw[0] as number
  if (first < 0x30 || first > 0x39) {
    const outer = parseJsonBytes(raw)
    if (outer === undefined) {
      console.warn("[google-flights-direct] Failed to decode single-chunk wrb.fr body as JSON")
      return []
    }
    const chunks: unknown[] = []
    chunksFromOuter(outer, chunks)
    return chunks
  }

  return readLengthPrefixedChunks(raw)
}

/**
 * Return the inner JSON of the first `wrb.fr` chunk, or null.
 * (Python: parse_first_wrb_payload)
 */
export function parseFirstWrbPayload(body: string | Uint8Array): unknown {
  const chunks = splitWrbChunks(body)
  return chunks.length > 0 ? chunks[0] : null
}
