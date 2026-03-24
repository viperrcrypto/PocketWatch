/** Zerion API v1 client — HTTP Basic auth (apiKey as username, empty password). */

const ZERION_BASE = "https://api.zerion.io/v1"
const TIMEOUT_MS = 30_000
const RETRY_MAX = 2
const RETRY_DELAYS = [1000, 3000] // fast retries — governor handles longer backoff

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export interface ZerionFetchResult {
  response: Response
  hit429: boolean
}

/** Fetch with automatic retry on 429 (rate limit). */
async function fetchWithRetry(
  url: string,
  headers: Headers,
  maxRetries = RETRY_MAX,
): Promise<ZerionFetchResult> {
  let res: Response | undefined
  let hit429 = false
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status !== 429 || attempt === maxRetries) return { response: res, hit429 }
    hit429 = true
    const wait = RETRY_DELAYS[attempt] ?? 8000
    console.warn(`[zerion] 429 — retry ${attempt + 1}/${maxRetries} in ${wait}ms`)
    await sleep(wait)
  }
  return { response: res!, hit429 }
}

/** Thrown on unrecoverable 429 — callers can check `instanceof` for health tracking */
export class ZerionRateLimitError extends Error {
  readonly status = 429
  constructor(message: string) {
    super(message)
    this.name = "ZerionRateLimitError"
  }
}

export interface ZerionPosition {
  id: string
  symbol: string
  name: string
  chain: string           // Zerion chain ID: "ethereum", "polygon", "arbitrum", etc.
  quantity: number
  price: number
  value: number           // USD value
  iconUrl: string | null
  positionType: string    // "wallet" | "deposit" | "locked" | "staked" | "reward" | "loan" | "investment"
  contractAddress: string | null
  protocol: string | null       // e.g. "Aave V3", "Uniswap V3", "Lido"
  protocolIcon: string | null   // protocol icon URL
  protocolUrl: string | null    // protocol website
  isDefi: boolean               // true for deposit, locked, staked, reward, loan, investment
}

export interface ZerionWalletData {
  address: string
  totalValue: number
  positions: ZerionPosition[]
}

function makeHeaders(apiKey: string): Headers {
  const token = btoa(`${apiKey}:`)
  return new Headers({
    Authorization: `Basic ${token}`,
    Accept: "application/json",
  })
}

/** Fetch all positions for a single wallet address. */
export async function fetchWalletPositions(
  apiKey: string,
  address: string
): Promise<ZerionPosition[]> {
  const url =
    `${ZERION_BASE}/wallets/${encodeURIComponent(address)}/positions/` +
    `?filter[position_types]=wallet,deposit,locked,staked,reward,loan,investment&currency=usd&sort=-value`

  const { response: res, hit429 } = await fetchWithRetry(url, makeHeaders(apiKey))

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.error(`[zerion] ${res.status} for ${address}: ${body.slice(0, 500)}`)
    if (res.status === 401) throw new Error("Invalid Zerion API key")
    if (res.status === 429) throw new ZerionRateLimitError("Zerion rate limit exceeded — try again shortly")
    throw new Error(`Zerion API error: ${res.status}`)
  }

  if (hit429) {
    // Succeeded after retries but did encounter 429s — signal partial throttle
    console.warn(`[zerion] Request for ${address.slice(0, 10)}… succeeded after 429 retries`)
  }

  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positions = (json.data || []).map((item: any): ZerionPosition => {
    const attr = item.attributes ?? {}
    const chainId: string = item.relationships?.chain?.data?.id ?? "unknown"
    const fi = attr.fungible_info ?? {}
    return {
      id: item.id,
      symbol: fi.symbol ?? attr.name ?? "?",
      name: fi.name ?? attr.name ?? "Unknown",
      chain: chainId,
      quantity: Number(attr.quantity?.float ?? attr.quantity?.numeric ?? 0),
      price: Number(attr.price ?? 0),
      value: Number(attr.value ?? 0),
      iconUrl: fi.icon?.url ?? null,
      positionType: attr.position_type ?? "wallet",
      contractAddress:
        fi.implementations?.[0]?.address ?? null,
      protocol: attr.application_metadata?.name ?? null,
      protocolIcon: attr.application_metadata?.icon?.url ?? null,
      protocolUrl: attr.application_metadata?.url ?? null,
      isDefi: (attr.position_type ?? "wallet") !== "wallet",
    }
  })

  // ─── aToken price correction ───
  // Zerion sometimes returns inflated prices for Aave receipt tokens (aTokens).
  // Detect them by prefix, look up the underlying asset price, and correct.
  const ATOKEN_PREFIX = /^a(Eth|Arb|Pol|Opt|Base|Ava)/
  const KNOWN_STABLECOINS = new Set([
    "USDC", "USDT", "DAI", "PYUSD", "RLUSD", "LUSD", "FRAX", "GUSD", "USDP",
    "NUSD", "sNUSD", "sUSDai", "USDai",
  ])

  // Build price lookup from non-aToken positions
  const priceRef = new Map<string, number>()
  for (const p of positions) {
    if (!ATOKEN_PREFIX.test(p.symbol) && p.price > 0) {
      priceRef.set(p.symbol.toUpperCase(), p.price)
    }
  }

  const corrected = positions.map((pos: ZerionPosition) => {
    const match = pos.symbol.match(ATOKEN_PREFIX)
    if (!match) return pos
    const underlying = pos.symbol.slice(match[0].length) // "aEthPYUSD" → "PYUSD"
    const upperUnderlying = underlying.toUpperCase()

    let fairPrice = priceRef.get(upperUnderlying)
    if (!fairPrice && KNOWN_STABLECOINS.has(underlying)) {
      fairPrice = 1.0
    }
    if (!fairPrice) return pos

    // Only correct if Zerion price deviates >50% from underlying
    if (pos.price > fairPrice * 1.5) {
      console.warn(
        `[zerion] Price fix: ${pos.symbol} $${pos.price.toFixed(4)} → $${fairPrice.toFixed(4)} (underlying: ${underlying})`
      )
      return { ...pos, price: fairPrice, value: pos.quantity * fairPrice }
    }
    return pos
  })

  return corrected
}

/** Fetch aggregate portfolio value for a wallet (lighter than positions). */
export async function fetchWalletTotal(
  apiKey: string,
  address: string
): Promise<number> {
  const url =
    `${ZERION_BASE}/wallets/${encodeURIComponent(address)}/portfolio/?currency=usd`

  const { response: res } = await fetchWithRetry(url, makeHeaders(apiKey))

  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid Zerion API key")
    if (res.status === 429) throw new ZerionRateLimitError("Zerion rate limit exceeded")
    throw new Error(`Zerion API error: ${res.status}`)
  }

  const json = await res.json()
  return Number(json.data?.attributes?.total?.value ?? 0)
}

// Zerion chart period options
export type ZerionChartPeriod = "hour" | "day" | "week" | "month" | "3months" | "6months" | "year" | "5years" | "max"

/** Fetch historical portfolio chart for a single wallet. Returns [timestamp_sec, usd_value] pairs. */
export async function fetchWalletChart(
  apiKey: string,
  address: string,
  period: ZerionChartPeriod = "max"
): Promise<[number, number][]> {
  const url =
    `${ZERION_BASE}/wallets/${encodeURIComponent(address)}/charts/${period}?currency=usd`

  const { response: res } = await fetchWithRetry(url, makeHeaders(apiKey))

  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid Zerion API key")
    if (res.status === 429) throw new ZerionRateLimitError("Zerion rate limit exceeded")
    throw new Error(`Zerion chart API error: ${res.status}`)
  }

  const json = await res.json()
  // points is an array of [unix_timestamp, value] tuples
  return (json.data?.attributes?.points ?? []) as [number, number][]
}

/** Fetch chart data for multiple wallets sequentially and sum into a single series. */
export async function fetchMultiWalletChart(
  apiKey: string,
  addresses: string[],
  period: ZerionChartPeriod = "max"
): Promise<[number, number][]> {
  if (addresses.length === 0) return []
  if (addresses.length === 1) return fetchWalletChart(apiKey, addresses[0], period)

  // Fetch all wallets concurrently; tolerate individual failures
  const settled = await Promise.allSettled(
    addresses.map((addr) => fetchWalletChart(apiKey, addr, period))
  )
  const charts: [number, number][][] = []
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]
    if (result.status === "fulfilled") {
      charts.push(result.value)
    } else {
      console.warn(`[zerion] Chart fetch failed for ${addresses[i].slice(0, 10)}…: ${result.reason?.message ?? "unknown"}`)
    }
  }

  if (charts.length === 0) return []
  if (charts.length === 1) return charts[0]

  // Merge with forward-fill: when a wallet has no data at a timestamp,
  // carry forward its last known value instead of contributing $0.
  // This prevents cliffs when wallets have different date ranges.

  // 1. Collect all unique timestamps across all wallets
  const tsSet = new Set<number>()
  for (const chart of charts) {
    for (const [ts] of chart) {
      tsSet.add(ts)
    }
  }
  const allTimestamps = Array.from(tsSet).sort((a, b) => a - b)

  // 2. Build sorted arrays per wallet for efficient lookup
  const sortedCharts = charts.map((chart) =>
    [...chart].sort((a, b) => a[0] - b[0])
  )

  // 3. Find the earliest timestamp where ALL wallets have data.
  //    Before this point, the sum only reflects a subset of wallets → misleading.
  const walletStarts = sortedCharts.map((wChart) =>
    wChart.length > 0 ? wChart[0][0] : Number.POSITIVE_INFINITY
  )
  const fullCoverageStart = Math.max(...walletStarts)

  // 4. For each timestamp, forward-fill each wallet and sum
  const merged: [number, number][] = []
  const cursors = new Array<number>(charts.length).fill(0)
  const lastKnown = new Array<number>(charts.length).fill(0)

  for (const ts of allTimestamps) {
    let sum = 0
    for (let w = 0; w < sortedCharts.length; w++) {
      const wChart = sortedCharts[w]
      while (cursors[w] < wChart.length && wChart[cursors[w]][0] <= ts) {
        lastKnown[w] = wChart[cursors[w]][1]
        cursors[w]++
      }
      sum += lastKnown[w]
    }
    // Emit all points — wallets without data at this timestamp contribute 0
    // via the forward-fill (lastKnown[w] starts at 0). This allows the chart
    // to show early history from wallets that existed before others were added.
    merged.push([ts, sum])
  }

  return merged
}

export interface MultiWalletResult {
  wallets: ZerionWalletData[]
  failedCount: number
}

// ─── Transaction history ───────────────────────────────────────────────────

export interface ZerionTransactionsResponse {
  links: { next?: string | null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
}

/**
 * Fetch one page of transaction history for a wallet address.
 * Uses the provider-governor path — the caller is responsible for rate limiting.
 * Returns the raw API response; use zerion-tx-mapper to convert records.
 */
export async function fetchWalletTransactions(
  apiKey: string,
  address: string,
  opts?: {
    cursor?: string | null
    minMinedAt?: string | null
    pageSize?: number
  },
): Promise<ZerionTransactionsResponse> {
  const params = new URLSearchParams()
  params.set("page[size]", String(opts?.pageSize ?? 100))
  params.set("currency", "usd")
  if (opts?.cursor) params.set("page[after]", opts.cursor)
  if (opts?.minMinedAt) params.set("filter[min_mined_at]", opts.minMinedAt)

  const url = `${ZERION_BASE}/wallets/${encodeURIComponent(address)}/transactions/?${params}`
  const res = await fetch(url, {
    headers: makeHeaders(apiKey),
    signal: AbortSignal.timeout(30_000),
  })

  if (res.status === 429) {
    throw new ZerionRateLimitError("Zerion rate limited on transactions endpoint")
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    if (res.status === 401) throw new Error("Invalid Zerion API key")
    throw Object.assign(
      new Error(`Zerion transactions ${res.status}: ${body.slice(0, 200)}`),
      { status: res.status },
    )
  }

  const json = await res.json()
  const count = Array.isArray(json.data) ? json.data.length : "?"
  console.log(`[zerion-tx] ${address.slice(0, 10)}… page returned ${count} txs, next=${json.links?.next ? "yes" : "no"}`)
  return json
}

/** Fetch data for multiple wallets with controlled concurrency. */
export async function fetchMultiWalletPositions(
  apiKey: string,
  addresses: string[]
): Promise<MultiWalletResult> {
  const wallets: ZerionWalletData[] = []
  const failed: string[] = []

  // Process wallets in batches of 3 — fast enough for responsiveness
  // while staying under Zerion's rate limits with brief delays between batches.
  const BATCH_SIZE = 3
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (address) => {
        const positions = await fetchWalletPositions(apiKey, address)
        return {
          address,
          totalValue: positions.reduce((sum, p) => sum + p.value, 0),
          positions,
        }
      })
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === "fulfilled") {
        wallets.push(result.value)
      } else {
        failed.push(batch[j])
        console.warn(`[zerion] Wallet ${batch[j].slice(0, 10)}… failed: ${result.reason?.message}`)
        // Bail immediately on 429 — let multi-balance-fetcher try next provider
        if (result.reason?.status === 429 || result.reason instanceof ZerionRateLimitError) {
          throw result.reason
        }
      }
    }

    // Minimal delay between batches — governor handles rate limiting
    if (i + BATCH_SIZE < addresses.length) {
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  if (failed.length > 0) {
    console.warn(`[zerion] ${failed.length}/${addresses.length} wallet(s) failed: ${failed.join(", ")}`)
  }

  // If ALL wallets failed, throw so callers can report it
  if (wallets.length === 0 && addresses.length > 0) {
    throw new Error(`All ${addresses.length} wallet fetches failed`)
  }

  return { wallets, failedCount: failed.length }
}
