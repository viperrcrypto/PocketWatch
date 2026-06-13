/**
 * ISO currency extraction from Google Flights price tokens — faithful port
 * of the decoding half of fli/core/currency.py
 * (extract_currency_from_price_token and its protobuf varint walk).
 *
 * The token is a base64url protobuf blob attached to every price block;
 * the ISO code lives at field 3 → nested field 3 (length-delimited UTF-8).
 * The babel-based display formatting in the Python source is presentation
 * only and intentionally not ported.
 */

const utf8Strict = new TextDecoder("utf-8", { fatal: true })

interface VarintRead {
  readonly value: number
  readonly next: number
}

/** Read a protobuf-style varint value. (Python: _read_varint) */
function readVarint(data: Uint8Array, offset: number): VarintRead {
  let value = 0
  let shift = 0
  let off = offset
  while (off < data.length) {
    const byte = data[off] as number
    off += 1
    // Multiplication instead of << to stay safe past 32 bits.
    value += (byte & 0x7f) * 2 ** shift
    if ((byte & 0x80) === 0) return { value, next: off }
    shift += 7
    if (shift >= 64) throw new Error("Varint is too large to decode")
  }
  throw new Error("Unexpected end of data while decoding varint")
}

interface BytesRead {
  readonly bytes: Uint8Array
  readonly next: number
}

/** Read a protobuf-style length-delimited field. (Python: _read_length_delimited) */
function readLengthDelimited(data: Uint8Array, offset: number): BytesRead {
  const { value: length, next } = readVarint(data, offset)
  const end = next + length
  if (end > data.length) throw new Error("Length-delimited field exceeds payload size")
  return { bytes: data.subarray(next, end), next: end }
}

/** Skip over a protobuf field we do not need. (Python: _skip_field) */
function skipField(data: Uint8Array, offset: number, wireType: number): number {
  if (wireType === 0) return readVarint(data, offset).next
  if (wireType === 1) {
    const end = offset + 8
    if (end > data.length) throw new Error("Fixed64 field exceeds payload size")
    return end
  }
  if (wireType === 2) return readLengthDelimited(data, offset).next
  if (wireType === 5) {
    const end = offset + 4
    if (end > data.length) throw new Error("Fixed32 field exceeds payload size")
    return end
  }
  throw new Error(`Unsupported wire type: ${wireType}`)
}

/** Extract the nested ISO currency code. (Python: _extract_currency_from_message) */
function extractCurrencyFromMessage(data: Uint8Array): string | null {
  let offset = 0
  while (offset < data.length) {
    const tagRead = readVarint(data, offset)
    offset = tagRead.next
    const fieldNumber = tagRead.value >> 3
    const wireType = tagRead.value & 0x07

    if (fieldNumber === 3 && wireType === 2) {
      const nestedRead = readLengthDelimited(data, offset)
      offset = nestedRead.next
      const nested = nestedRead.bytes
      let nestedOffset = 0
      while (nestedOffset < nested.length) {
        const nestedTag = readVarint(nested, nestedOffset)
        nestedOffset = nestedTag.next
        const nestedField = nestedTag.value >> 3
        const nestedWireType = nestedTag.value & 0x07
        if (nestedField === 3 && nestedWireType === 2) {
          const currencyRead = readLengthDelimited(nested, nestedOffset)
          return utf8Strict.decode(currencyRead.bytes).toUpperCase()
        }
        nestedOffset = skipField(nested, nestedOffset, nestedWireType)
      }
      continue
    }

    offset = skipField(data, offset, wireType)
  }
  return null
}

/** Pure-function inner — base64url decode + protobuf walk. (Python: _decode_token) */
function decodeToken(token: string): string | null {
  try {
    const padded = token + "=".repeat((4 - (token.length % 4)) % 4)
    const standard = padded.replace(/-/g, "+").replace(/_/g, "/")
    const decoded = new Uint8Array(Buffer.from(standard, "base64"))
    return extractCurrencyFromMessage(decoded)
  } catch {
    return null
  }
}

// Python uses @lru_cache(maxsize=256): the same token is repeated on every
// row of a response (one currency per response), so cache decode results.
const TOKEN_CACHE_MAX = 256
const tokenCache = new Map<string, string | null>()

/**
 * Extract the ISO currency code from a Google Flights price token.
 * (Python: extract_currency_from_price_token)
 *
 * Accepts unknown so callers can pass raw response slots verbatim —
 * non-string / empty values return null (the Python call sites catch
 * TypeError to the same effect).
 */
export function extractCurrencyFromPriceToken(token: unknown): string | null {
  if (typeof token !== "string" || token.length === 0) return null
  const cached = tokenCache.get(token)
  if (cached !== undefined) return cached
  const result = decodeToken(token)
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    const oldest = tokenCache.keys().next().value
    if (oldest !== undefined) tokenCache.delete(oldest)
  }
  tokenCache.set(token, result)
  return result
}
