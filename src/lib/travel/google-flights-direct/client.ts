/**
 * HTTP client for Google Flights' FlightsFrontendService — faithful port of
 * the request layer in fli/search/client.py + fli/search/flights.py +
 * fli/core/links.py (with_locale_params).
 *
 * Runtime: Next.js / Node 20 global fetch (undici). The Python source uses
 * curl_cffi with impersonate="chrome" (full TLS fingerprint impersonation);
 * fetch cannot impersonate TLS, so we send a Chrome user-agent and the same
 * form-urlencoded content type — this is sufficient for these endpoints.
 */

/** GetShoppingResults endpoint. (Python: SearchFlights.BASE_URL) */
export const SHOPPING_URL =
  "https://www.google.com/_/FlightsFrontendUi/data/" +
  "travel.frontend.flights.FlightsFrontendService/GetShoppingResults"

/** GetBookingResults endpoint. (Python: SearchFlights.BOOKING_URL) */
export const BOOKING_URL =
  "https://www.google.com/_/FlightsFrontendUi/data/" +
  "travel.frontend.flights.FlightsFrontendService/GetBookingResults"

/** GetCalendarGraph endpoint. (Python: SearchDates.BASE_URL) */
export const CALENDAR_URL =
  "https://www.google.com/_/FlightsFrontendUi/data/" +
  "travel.frontend.flights.FlightsFrontendService/GetCalendarGraph"

/** Same content type the Python client sends; UA approximates impersonate="chrome". */
const DEFAULT_HEADERS: Readonly<Record<string, string>> = {
  "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "*/*",
}

/** Python: DEFAULT_TIMEOUT = 60.0 seconds. */
const DEFAULT_TIMEOUT_MS = 60_000

/** Python: tenacity stop_after_attempt(3). */
const MAX_ATTEMPTS = 3

/** Python: Google's published ceiling — 10 req/sec global budget. */
const MIN_REQUEST_INTERVAL_MS = 100

export interface PostOptions {
  /** ISO 4217 currency (uppercased into the `curr=` URL param). */
  readonly currency?: string | null
  /** BCP-47 language code (`hl=` URL param, passed verbatim). */
  readonly language?: string | null
  /** ISO 3166-1 alpha-2 country (uppercased into the `gl=` URL param). */
  readonly country?: string | null
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

/** HTTP-level failure from Google. (Python: SearchHTTPError) */
export class GoogleFlightsHttpError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, bodySnippet: string) {
    super(
      `Google Flights returned an error response (HTTP ${statusCode}). ` +
        `The request may be malformed, rate-limited, or blocked. ${bodySnippet}`,
    )
    this.name = "GoogleFlightsHttpError"
    this.statusCode = statusCode
  }
}

/**
 * Transient application-level error: HTTP 200 whose wrb.fr envelope carries a
 * travel.frontend.flights.ErrorResponse (gRPC-style code 13 INTERNAL) instead
 * of a payload. Observed ~15-20% of the time regardless of headers; the
 * browser's batchexecute layer silently retries these, so we do too.
 * (Deviation from the Python port, whose tenacity retry only covers HTTP
 * errors — curl_cffi callers see the same flake as a None result.)
 */
export class GoogleFlightsTransientError extends Error {
  constructor() {
    super(
      "Google Flights returned a transient ErrorResponse envelope (code 13) — retrying",
    )
    this.name = "GoogleFlightsTransientError"
  }
}

/** True when a 200 body is the ErrorResponse envelope, not a results payload. */
const isTransientErrorEnvelope = (body: string): boolean =>
  body.includes("travel.frontend.flights.ErrorResponse")

/**
 * Append optional curr/hl/gl parameters to a URL.
 * (Python: with_locale_params in fli/core/links.py)
 * Currency and country are uppercased — Google silently ignores lowercase.
 */
export function withLocaleParams(
  url: string,
  currency?: string | null,
  language?: string | null,
  country?: string | null,
): string {
  const params: string[] = []
  if (currency) params.push(`curr=${encodeURIComponent(currency.toUpperCase())}`)
  if (language) params.push(`hl=${encodeURIComponent(language)}`)
  if (country) params.push(`gl=${encodeURIComponent(country.toUpperCase())}`)
  if (params.length === 0) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}${params.join("&")}`
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Module-level rate limiter: serializes request starts >=100ms apart,
// mirroring the Python client's global 10 req/sec token bucket.
let rateLimitQueue: Promise<void> = Promise.resolve()
let lastRequestAt = 0

function acquireRateLimit(): Promise<void> {
  const turn = rateLimitQueue.then(async () => {
    const waitMs = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now()
    if (waitMs > 0) await sleep(waitMs)
    lastRequestAt = Date.now()
  })
  rateLimitQueue = turn.catch(() => undefined)
  return turn
}

async function postOnce(url: string, body: string, options: PostOptions): Promise<string> {
  await acquireRateLimit()
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const signal = options.signal
    ? AbortSignal.any([timeoutSignal, options.signal])
    : timeoutSignal
  const response = await fetch(url, {
    method: "POST",
    headers: DEFAULT_HEADERS,
    body,
    redirect: "follow", // Python: allow_redirects=True
    signal,
  })
  if (!response.ok) {
    const snippet = (await response.text().catch(() => "")).slice(0, 200)
    throw new GoogleFlightsHttpError(response.status, snippet)
  }
  const text = await response.text()
  if (isTransientErrorEnvelope(text)) throw new GoogleFlightsTransientError()
  return text
}

/** Python: tenacity wait_exponential() → 1s, 2s between the 3 attempts. */
const backoffMs = (attempt: number): number => 1_000 * 2 ** (attempt - 1)

// Circuit breaker: Google intermittently IP-blocks (sustained 200-with-ErrorResponse).
// A single "search everything" can fan out ~48 direct requests; without a breaker a
// blocked endpoint gets hammered (3 attempts each) and the burst perpetuates the
// block. After CB_THRESHOLD consecutive transient failures, fail FAST for
// CB_COOLDOWN_MS so callers fall back to SerpAPI / other providers instead.
const CB_THRESHOLD = 3
const CB_COOLDOWN_MS = 10 * 60 * 1000
let cbConsecutiveFailures = 0
let cbCooldownUntil = 0

/**
 * POST `f.req=<encoded>` to a FlightsFrontendService endpoint with retries.
 * Returns the RAW response text (the `)]}'`-prefixed wrb.fr envelope) —
 * decoding is intentionally out of scope for this module.
 */
async function postFReq(baseUrl: string, encoded: string, options: PostOptions): Promise<string> {
  // Short-circuit while the breaker is open — no network, immediate fallback.
  if (Date.now() < cbCooldownUntil) throw new GoogleFlightsTransientError()

  const url = withLocaleParams(baseUrl, options.currency, options.language, options.country)
  const body = `f.req=${encoded}`
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) await sleep(backoffMs(attempt - 1))
    try {
      const result = await postOnce(url, body, options)
      cbConsecutiveFailures = 0 // success closes the breaker
      return result
    } catch (error) {
      lastError = error
      if (options.signal?.aborted) break
    }
  }
  if (lastError instanceof GoogleFlightsTransientError) {
    cbConsecutiveFailures += 1
    if (cbConsecutiveFailures >= CB_THRESHOLD) cbCooldownUntil = Date.now() + CB_COOLDOWN_MS
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * Issue a GetShoppingResults call with an encoded tfs payload (from
 * buildEncodedFilter / encodeFilters) and return the raw response text.
 */
export function postSearch(encoded: string, options: PostOptions = {}): Promise<string> {
  return postFReq(SHOPPING_URL, encoded, options)
}

/**
 * Issue a GetBookingResults call with an encoded booking payload and return
 * the raw response text. Provided for parity with the Python client.
 */
export function postBooking(encoded: string, options: PostOptions = {}): Promise<string> {
  return postFReq(BOOKING_URL, encoded, options)
}

/**
 * Issue a GetCalendarGraph call with an encoded date-search payload and
 * return the raw response text. (Python: SearchDates._search_chunk's POST)
 */
export function postCalendar(encoded: string, options: PostOptions = {}): Promise<string> {
  return postFReq(CALENDAR_URL, encoded, options)
}
