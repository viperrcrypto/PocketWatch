/**
 * Pendle REST API client.
 * Fetches accurate implied APY and user P&L from Pendle's free API.
 * Replaces DefiLlama for Pendle positions — values match app.pendle.finance.
 */

const PENDLE_API_BASE = "https://api-v2.pendle.finance/core/v1"
const FETCH_TIMEOUT_MS = 15_000
const CACHE_TTL_MS = 2 * 60_000 // 2 minutes

// ─── Supported chains ───

const PENDLE_CHAIN_IDS = new Set([1, 42161, 10, 56, 8453, 5000])

// ─── Types ───

export interface PendleMarket {
  address: string
  name: string
  expiry: string              // ISO date
  pt: { address: string; symbol: string }
  yt: { address: string; symbol: string }
  sy: { address: string; symbol: string }
  underlyingAsset: { address: string; symbol: string }
  impliedApy: number          // decimal (0.0901 = 9.01%)
  underlyingApy: number       // decimal
  maxBoostedApy?: number
  tvl?: number
}

interface PendleMarketRaw {
  address?: string
  name?: string
  symbol?: string
  expiry?: string
  pt?: { address?: string; symbol?: string } | string
  yt?: { address?: string; symbol?: string } | string
  sy?: { address?: string; symbol?: string } | string
  underlyingAsset?: { address?: string; symbol?: string } | string
  impliedApy?: number
  tvl?: number
  details?: {
    impliedApy?: number
    liquidity?: number
  }
}

export interface PendlePosition {
  chainId: number
  marketId: string
  ptValuation: number
  ptBalance: string
  ytValuation: number
  ytBalance: string
  lpValuation: number
}

// ─── Cache ───

interface MarketsCache {
  markets: PendleMarket[]
  timestamp: number
}

interface PositionsCache {
  positions: PendlePosition[]
  timestamp: number
}

const marketsCache = new Map<number, MarketsCache>()
const positionsCache = new Map<string, PositionsCache>()

// ─── Fetch helpers ───

async function pendleFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.warn(`[pendle] API returned ${res.status} for ${url}${body ? ` — ${body.slice(0, 180)}` : ""}`)
      return null
    }
    return await res.json() as T
  } catch (err) {
    console.warn(`[pendle] Fetch failed for ${url}:`, err)
    return null
  }
}

// ─── Markets ───

interface PendleMarketsResponse {
  results?: PendleMarketRaw[]
  total: number
}

interface PendleActiveMarketsResponse {
  markets?: PendleMarketRaw[]
}

function parseCaipAddress(input?: string): string {
  if (!input) return ""
  const parts = input.split("-")
  return parts.length > 1 ? parts[1].toLowerCase() : input.toLowerCase()
}

function normalizePendleMarket(raw: PendleMarketRaw): PendleMarket | null {
  const address = String(raw.address ?? "").toLowerCase()
  if (!address) return null

  const name = String(raw.name ?? raw.symbol ?? "Unknown")
  const expiry = String(raw.expiry ?? "")

  const ptObj = typeof raw.pt === "string" ? null : raw.pt
  const ytObj = typeof raw.yt === "string" ? null : raw.yt
  const syObj = typeof raw.sy === "string" ? null : raw.sy
  const uaObj = typeof raw.underlyingAsset === "string" ? null : raw.underlyingAsset

  const ptAddress = ptObj?.address?.toLowerCase() ?? parseCaipAddress(typeof raw.pt === "string" ? raw.pt : "")
  const ytAddress = ytObj?.address?.toLowerCase() ?? parseCaipAddress(typeof raw.yt === "string" ? raw.yt : "")
  const syAddress = syObj?.address?.toLowerCase() ?? parseCaipAddress(typeof raw.sy === "string" ? raw.sy : "")
  const underAddress = uaObj?.address?.toLowerCase() ?? parseCaipAddress(typeof raw.underlyingAsset === "string" ? raw.underlyingAsset : "")

  const underSymbol = uaObj?.symbol ?? name
  const fallbackBase = name.replace(/\s+/g, "")

  return {
    address,
    name,
    expiry,
    pt: {
      address: ptAddress,
      symbol: ptObj?.symbol ?? `PT-${fallbackBase}`,
    },
    yt: {
      address: ytAddress,
      symbol: ytObj?.symbol ?? `YT-${fallbackBase}`,
    },
    sy: {
      address: syAddress,
      symbol: syObj?.symbol ?? `SY-${fallbackBase}`,
    },
    underlyingAsset: {
      address: underAddress,
      symbol: underSymbol,
    },
    impliedApy: Number(raw.impliedApy ?? raw.details?.impliedApy ?? 0),
    underlyingApy: 0,
    tvl: Number(raw.tvl ?? raw.details?.liquidity ?? 0),
  }
}

function parseSymbolExpiryTag(symbol: string): string | null {
  const m = symbol.match(/-(\d{2}[A-Z]{3}\d{4})$/)
  return m?.[1] ?? null
}

function toExpiryTag(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (!Number.isFinite(d.getTime())) return null
  const day = String(d.getUTCDate()).padStart(2, "0")
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const mon = months[d.getUTCMonth()]
  const year = String(d.getUTCFullYear())
  return `${day}${mon}${year}`
}

/**
 * Fetch all active Pendle markets for a chain.
 * Caches for 2 minutes.
 */
export async function getPendleMarkets(chainId: number): Promise<PendleMarket[]> {
  if (!PENDLE_CHAIN_IDS.has(chainId)) return []

  const cached = marketsCache.get(chainId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.markets
  }

  // Fetch active markets with explicit filter; this endpoint returns PT/YT symbols.
  // API max limit is 100, so we paginate.
  const limit = 100
  let skip = 0
  let total = Number.POSITIVE_INFINITY
  const pagedMarkets: PendleMarketRaw[] = []

  while (skip < total && skip <= 1000) {
    const params = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
      is_active: "true",
    })
    const data = await pendleFetch<PendleMarketsResponse>(
      `${PENDLE_API_BASE}/${chainId}/markets?${params.toString()}`,
    )
    if (!data?.results || data.results.length === 0) break

    pagedMarkets.push(...data.results)
    total = Number(data.total ?? pagedMarkets.length)
    if (data.results.length < limit) break
    skip += limit
  }

  let rawMarkets: PendleMarketRaw[] = pagedMarkets
  if (rawMarkets.length === 0) {
    // Fallback endpoint with leaner shape (no PT/YT symbols).
    const active = await pendleFetch<PendleActiveMarketsResponse>(
      `${PENDLE_API_BASE}/${chainId}/markets/active`,
    )
    rawMarkets = active?.markets ?? []
  }

  if (rawMarkets.length === 0) return cached?.markets ?? []

  const deduped = Array.from(
    new Map(
      rawMarkets
        .map((m) => [String(m.address ?? "").toLowerCase(), m] as const)
        .filter(([addr]) => !!addr),
    ).values(),
  )

  const markets = deduped
    .map(normalizePendleMarket)
    .filter((m): m is PendleMarket => m !== null)

  if (markets.length === 0) return cached?.markets ?? []
  marketsCache.set(chainId, { markets, timestamp: Date.now() })
  console.log(`[pendle] Cached ${markets.length} markets for chain ${chainId}`)
  return markets
}

/**
 * Get implied APY for a Pendle position by matching PT/YT symbol to a market.
 * @param chainId - EVM chain ID
 * @param tokenSymbol - e.g. "PT-sUSDe-29MAY2025" or "YT-aUSDC"
 * @returns implied APY as percentage (e.g. 9.01), or null
 */
export async function getPendleMarketApy(
  chainId: number,
  tokenSymbol: string,
  contractAddress?: string | null,
): Promise<{
  impliedApy: number
  maturityDate: string | null
  marketAddress: string | null
} | null> {
  const markets = await getPendleMarkets(chainId)
  if (markets.length === 0) return null

  const contract = contractAddress?.toLowerCase()

  // Pass 1: Exact token contract match against PT / YT / SY / market address.
  let match = contract
    ? markets.find((m) => {
        const addresses = [
          m.pt?.address?.toLowerCase() ?? "",
          m.yt?.address?.toLowerCase() ?? "",
          m.sy?.address?.toLowerCase() ?? "",
          m.address?.toLowerCase() ?? "",
        ]
        return addresses.includes(contract)
      })
    : undefined

  // Pass 2: Exact PT/YT symbol match (strongest symbol signal — Pendle PT symbols
  // use the same format as Zerion's, e.g. "PT-sUSDai-15OCT2026")
  const tokenLower = tokenSymbol.toLowerCase()
  const tokenExpiryTag = parseSymbolExpiryTag(tokenSymbol.toUpperCase())
  if (!match) {
    match = markets.find((m) => {
      const ptSym = m.pt?.symbol?.toLowerCase() ?? ""
      const ytSym = m.yt?.symbol?.toLowerCase() ?? ""
      return ptSym === tokenLower || ytSym === tokenLower
    })
  }

  // Pass 3: Scored fallback — extract underlying and score each market
  if (!match) {
    const stripped = tokenSymbol
      .replace(/^(PT|YT)-/i, "")
      .replace(/-\d{2}[A-Z]{3}\d{4}$/, "")
      .toLowerCase()

    let bestScore = 0
    for (const m of markets) {
      let score = 0
      const ptSym = m.pt?.symbol?.toLowerCase() ?? ""
      const ytSym = m.yt?.symbol?.toLowerCase() ?? ""
      const underSym = m.underlyingAsset?.symbol?.toLowerCase() ?? ""
      const mName = m.name?.toLowerCase() ?? ""
      const marketExpiryTag = toExpiryTag(m.expiry)

      // PT/YT symbol contains our stripped name (strong)
      if (ptSym.includes(stripped) || ytSym.includes(stripped)) score = 3
      // Underlying exact match (good)
      else if (underSym === stripped) score = 2
      // Name contains (weakest)
      else if (mName.includes(stripped)) score = 1

      if (tokenExpiryTag && marketExpiryTag === tokenExpiryTag) score += 4

      // Require stronger evidence for fallback matching to avoid APY drift.
      if (score >= 4 && score > bestScore) {
        bestScore = score
        match = m
      }
    }
  }

  if (!match) return null

  // impliedApy is decimal (0.0901 = 9.01%) — convert to percentage
  const impliedApy = (match.impliedApy ?? 0) * 100

  console.log(`[pendle] Matched "${tokenSymbol}" → market "${match.name}" APY: ${impliedApy.toFixed(2)}%`)

  return {
    impliedApy,
    maturityDate: match.expiry ?? null,
    marketAddress: match.address ?? null,
  }
}

// ─── User Positions (cross-chain) ───

interface PendleDashboardResponse {
  positions?: {
    chainId: number
    totalOpen: number
    openPositions?: {
      marketId: string
      pt: { valuation: number; balance: string }
      yt: { valuation: number; balance: string }
      lp: { valuation: number; balance: string }
    }[]
  }[]
}

/**
 * Get all Pendle positions for a user across all chains.
 * Uses the cross-chain dashboard endpoint (replaces per-chain endpoint that 404s).
 */
export async function getPendleUserPositions(
  userAddress: string,
): Promise<PendlePosition[]> {
  const cacheKey = userAddress.toLowerCase()
  const cached = positionsCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.positions
  }

  const data = await pendleFetch<PendleDashboardResponse>(
    `https://api-v2.pendle.finance/core/v1/dashboard/positions/database/${userAddress}`
  )

  const positions: PendlePosition[] = []
  for (const chain of data?.positions ?? []) {
    for (const pos of chain.openPositions ?? []) {
      positions.push({
        chainId: chain.chainId,
        marketId: pos.marketId,
        ptValuation: pos.pt?.valuation ?? 0,
        ptBalance: pos.pt?.balance ?? "0",
        ytValuation: pos.yt?.valuation ?? 0,
        ytBalance: pos.yt?.balance ?? "0",
        lpValuation: pos.lp?.valuation ?? 0,
      })
    }
  }

  positionsCache.set(cacheKey, { positions, timestamp: Date.now() })

  if (positions.length > 0) {
    console.log(`[pendle] User ${userAddress.slice(0, 10)}... has ${positions.length} open position(s) across chains`)
  }

  return positions
}

/** Check if a chain is supported by Pendle */
export function isPendleSupported(chainId: number): boolean {
  return PENDLE_CHAIN_IDS.has(chainId)
}
