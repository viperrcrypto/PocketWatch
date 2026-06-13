/**
 * Small structural helpers shared by the response decoders — faithful port
 * of fli/search/_helpers.py.
 *
 * Every helper is a one-line defensive accessor over the raw nested-list
 * responses returned by Google Flights' RPC endpoints, so the decoders read
 * like a list of position look-ups rather than nested defensive code.
 */

/** Return `seq[idx]` when `seq` is a list and idx is in range, else null. */
export function safeGet(seq: unknown, idx: number): unknown {
  if (Array.isArray(seq) && idx >= 0 && idx < seq.length) return seq[idx] as unknown
  return null
}

/**
 * Return `v` only if it is a boolean — null for any other type.
 * Google encodes many tri-state fields as bool|null; preserve the
 * "null means unknown" distinction.
 */
export function asBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null
}

/** Return `v` only if it is a non-empty string, else null. */
export function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null
}

/**
 * Return `v` only if it is an integer, else null. (JSON has no separate
 * int/float types client-side — Number.isInteger is the closest analogue
 * to Python's `isinstance(v, int) and not isinstance(v, bool)`.)
 */
export function asInt(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) ? v : null
}

/** Return `v` only if it is an integer >= 0, else null. */
export function asNonNegativeInt(v: unknown): number | null {
  const n = asInt(v)
  return n !== null && n >= 0 ? n : null
}

/** Return `v` only if it is a positive integer — throws otherwise (pydantic PositiveInt). */
export function requirePositiveInt(v: unknown, label: string): number {
  const n = asInt(v)
  if (n === null || n <= 0) throw new Error(`${label} is not a positive int: ${String(v)}`)
  return n
}
