/**
 * DeFi Llama Yields API: pool data, filtering, sorting, risk assessment.
 */

import { YIELDS_BASE_URL, getCached, setCache } from "./helpers"

// ─── Types ───

export interface YieldPool {
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apyBase: number | null
  apyReward: number | null
  apy: number
  rewardTokens: string[] | null
  pool: string
  apyPct1D: number | null
  apyPct7D: number | null
  apyPct30D: number | null
  stablecoin: boolean
  ilRisk: "no" | "yes" | null
  exposure: string | null
  predictions: {
    predictedClass: string
    predictedProbability: number
    binnedConfidence: number
  } | null
  poolMeta: string | null
  mu: number | null
  sigma: number | null
  count: number | null
  outlier: boolean | null
  underlyingTokens: string[] | null
  il7d: number | null
  apyBase7d: number | null
  apyMean30d: number | null
  volumeUsd1d: number | null
  volumeUsd7d: number | null
  apyBaseInception: number | null
}

export interface YieldChartPoint {
  timestamp: string
  tvlUsd: number
  apy: number
  apyBase: number | null
  apyReward: number | null
}

export interface YieldFilters {
  chain?: string | string[]
  protocol?: string | string[]
  minTvl?: number
  maxTvl?: number
  minApy?: number
  maxApy?: number
  stablecoin?: boolean
  excludeIL?: boolean
  limit?: number
  offset?: number
}

export type YieldSortKey = "apy" | "tvlUsd" | "apyBase" | "apyReward" | "project"
export type YieldSortOrder = "asc" | "desc"

export interface PoolRiskScore {
  score: number
  level: "low" | "medium" | "high" | "extreme"
  factors: {
    apy: string
    tvl: string
    il: string
    stability: string
    outlier: string
  }
}

export const CHAIN_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  polygon: "Polygon",
  base: "Base",
  avalanche: "Avalanche",
  bsc: "BNB Chain",
  fantom: "Fantom",
  solana: "Solana",
  near: "NEAR",
  sui: "Sui",
  aptos: "Aptos",
}

// ─── Pool Fetching ───

export async function getAllYieldPools(): Promise<YieldPool[]> {
  const cacheKey = "defillama:yields:pools"
  const cached = getCached<YieldPool[]>(cacheKey)
  if (cached) return cached

  try {
    const response = await fetch(`${YIELDS_BASE_URL}/pools`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`DeFi Llama Yields API error: ${response.status}`)
    }

    const data = await response.json()
    const pools = data.data || []
    setCache(cacheKey, pools, 5 * 60 * 1000)
    return pools
  } catch (error) {
    console.error("Failed to fetch yield pools from DeFi Llama:", error)
    throw error
  }
}

export async function getYieldPoolChart(poolId: string): Promise<YieldChartPoint[]> {
  const cacheKey = `defillama:yields:chart:${poolId}`
  const cached = getCached<YieldChartPoint[]>(cacheKey)
  if (cached) return cached

  try {
    const response = await fetch(`${YIELDS_BASE_URL}/chart/${poolId}`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch chart for pool ${poolId}`)
    }

    const data = await response.json()
    const chartData = data.data || []
    setCache(cacheKey, chartData, 5 * 60 * 1000)
    return chartData
  } catch (error) {
    console.error(`Failed to fetch chart for pool ${poolId}:`, error)
    throw error
  }
}

// ─── Filtering & Sorting ───

export function applyYieldFilters(pools: YieldPool[], filters: YieldFilters): YieldPool[] {
  let filtered = pools

  if (filters.chain) {
    const chains = Array.isArray(filters.chain) ? filters.chain : [filters.chain]
    filtered = filtered.filter((p) =>
      chains.some((chain) => p.chain.toLowerCase() === chain.toLowerCase())
    )
  }

  if (filters.protocol) {
    const protocols = Array.isArray(filters.protocol) ? filters.protocol : [filters.protocol]
    filtered = filtered.filter((p) =>
      protocols.some((protocol) => p.project.toLowerCase().includes(protocol.toLowerCase()))
    )
  }

  if (filters.minTvl !== undefined) {
    filtered = filtered.filter((p) => p.tvlUsd >= filters.minTvl!)
  }

  if (filters.maxTvl !== undefined) {
    filtered = filtered.filter((p) => p.tvlUsd <= filters.maxTvl!)
  }

  if (filters.minApy !== undefined) {
    filtered = filtered.filter((p) => p.apy >= filters.minApy!)
  }

  if (filters.maxApy !== undefined) {
    filtered = filtered.filter((p) => p.apy <= filters.maxApy!)
  }

  if (filters.stablecoin !== undefined) {
    filtered = filtered.filter((p) => p.stablecoin === filters.stablecoin)
  }

  if (filters.excludeIL) {
    filtered = filtered.filter((p) => p.ilRisk === "no" || p.ilRisk === null)
  }

  if (filters.offset !== undefined) {
    filtered = filtered.slice(filters.offset)
  }

  if (filters.limit !== undefined) {
    filtered = filtered.slice(0, filters.limit)
  }

  return filtered
}

export function sortYieldPools(
  pools: YieldPool[],
  sortKey: YieldSortKey = "apy",
  sortOrder: YieldSortOrder = "desc"
): YieldPool[] {
  const sorted = [...pools].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]

    if (aVal === null && bVal === null) return 0
    if (aVal === null) return 1
    if (bVal === null) return -1

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }

    return sortOrder === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
  })

  return sorted
}

// ─── Risk Assessment ───

export function assessPoolRisk(pool: YieldPool): PoolRiskScore {
  let score = 0
  const factors = { apy: "", tvl: "", il: "", stability: "", outlier: "" }

  if (pool.apy > 100) {
    score += 30
    factors.apy = "Very high APY (>100%)"
  } else if (pool.apy > 50) {
    score += 20
    factors.apy = "High APY (50-100%)"
  } else if (pool.apy > 20) {
    score += 10
    factors.apy = "Moderate APY (20-50%)"
  } else {
    factors.apy = "Conservative APY (<20%)"
  }

  if (pool.tvlUsd < 100_000) {
    score += 30
    factors.tvl = "Very low TVL (<$100k)"
  } else if (pool.tvlUsd < 1_000_000) {
    score += 20
    factors.tvl = "Low TVL (<$1M)"
  } else if (pool.tvlUsd < 10_000_000) {
    score += 10
    factors.tvl = "Moderate TVL (<$10M)"
  } else {
    factors.tvl = "High TVL (>$10M)"
  }

  if (pool.ilRisk === "yes") {
    score += 25
    factors.il = "IL risk present"
  } else {
    factors.il = "No IL risk"
  }

  if (pool.apyPct30D && Math.abs(pool.apyPct30D) > 50) {
    score += 15
    factors.stability = "High APY volatility (30d)"
  } else if (pool.apyPct30D && Math.abs(pool.apyPct30D) > 25) {
    score += 10
    factors.stability = "Moderate APY volatility (30d)"
  } else {
    factors.stability = "Stable APY"
  }

  if (pool.outlier) {
    score += 10
    factors.outlier = "Flagged as outlier"
  } else {
    factors.outlier = "No outlier flags"
  }

  let level: "low" | "medium" | "high" | "extreme"
  if (score < 25) level = "low"
  else if (score < 50) level = "medium"
  else if (score < 75) level = "high"
  else level = "extreme"

  return { score, level, factors }
}

// ─── Formatting Helpers ───

export function formatChainName(chain: string): string {
  return CHAIN_NAMES[chain.toLowerCase()] || chain
}

export function formatAPY(apy: number | null): string {
  if (apy === null || apy === undefined) return "N/A"
  return `${apy.toFixed(2)}%`
}

export function getAPYColor(apy: number): "green" | "yellow" | "orange" | "red" {
  if (apy < 20) return "green"
  if (apy < 50) return "yellow"
  if (apy < 100) return "orange"
  return "red"
}

export function getRiskColor(level: PoolRiskScore["level"]): string {
  switch (level) {
    case "low":
      return "green"
    case "medium":
      return "yellow"
    case "high":
      return "orange"
    case "extreme":
      return "red"
  }
}
