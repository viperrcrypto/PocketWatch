/**
 * DeFi Llama protocol and TVL API functions.
 */

import { DEFILLAMA_BASE_URL, getCached, setCache } from "./helpers"

// ─── Types ───

export interface Protocol {
  id: string
  name: string
  address?: string
  symbol: string
  url?: string
  description?: string
  chain: string
  logo?: string
  audits?: string
  audit_note?: string
  gecko_id?: string
  cmcId?: string
  category?: string
  chains: string[]
  module?: string
  twitter?: string
  forkedFrom?: string[]
  oracles?: string[]
  listedAt?: number
  slug: string
  tvl: number
  chainTvls?: Record<string, number>
  change_1h?: number
  change_1d?: number
  change_7d?: number
  staking?: number
  fdv?: number
  mcap?: number
}

export interface HistoricalTVL {
  date: number // Unix timestamp
  tvl: number
}

export interface ChainTVL {
  gecko_id: string | null
  tvl: number
  tokenSymbol: string | null
  cmcId: string | null
  name: string
  chainId: number | null
}

export interface ProtocolDetails extends Omit<Protocol, 'chainTvls'> {
  tvl: number
  tokensInUsd?: HistoricalTVL[]
  tokens?: HistoricalTVL[]
  historicalTvl?: HistoricalTVL[]
  chainTvls?: Record<string, { tvl: HistoricalTVL[] }>
  currentChainTvls?: Record<string, number>
  raise?: {
    amount: number
    round: string
    date: number
  }
  metrics?: {
    tvl: number
    change_1h?: number
    change_1d?: number
    change_7d?: number
    change_1m?: number
  }
  governanceID?: string[]
  github?: string[]
  audits?: string
  audit_links?: string[]
}

// ─── Protocol Fetching ───

export async function getAllProtocols(): Promise<Protocol[]> {
  const cacheKey = "defillama:protocols"
  const cached = getCached<Protocol[]>(cacheKey)
  if (cached) return cached

  try {
    const response = await fetch(`${DEFILLAMA_BASE_URL}/protocols`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`DeFi Llama API error: ${response.status}`)
    }

    const data = await response.json()
    setCache(cacheKey, data, 5 * 60 * 1000)
    return data
  } catch (error) {
    console.error("Failed to fetch all protocols from DeFi Llama:", error)
    throw error
  }
}

export async function getTopProtocols(limit: number = 10): Promise<Protocol[]> {
  const protocols = await getAllProtocols()
  return protocols
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, limit)
}

export async function getProtocolDetails(
  protocol: string
): Promise<ProtocolDetails> {
  const cacheKey = `defillama:protocol-details:${protocol}`
  const cached = getCached<ProtocolDetails>(cacheKey)
  if (cached) return cached

  try {
    const response = await fetch(`${DEFILLAMA_BASE_URL}/protocol/${protocol}`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 120 },
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Protocol "${protocol}" not found`)
      }
      throw new Error(`DeFi Llama API error: ${response.status}`)
    }

    const data = await response.json()
    setCache(cacheKey, data, 2 * 60 * 1000)
    return data
  } catch (error) {
    console.error(`Failed to fetch protocol details for ${protocol}:`, error)
    throw error
  }
}

export async function getProtocolHistoricalTVL(
  protocol: string
): Promise<HistoricalTVL[]> {
  const details = await getProtocolDetails(protocol)
  return details.historicalTvl || details.tvl ? [{ date: Date.now() / 1000, tvl: details.tvl }] : []
}

export async function getChainTVLs(): Promise<ChainTVL[]> {
  const cacheKey = "defillama:chains"
  const cached = getCached<ChainTVL[]>(cacheKey)
  if (cached) return cached

  try {
    const response = await fetch(`${DEFILLAMA_BASE_URL}/chains`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`DeFi Llama API error: ${response.status}`)
    }

    const data = await response.json()
    setCache(cacheKey, data, 5 * 60 * 1000)
    return data
  } catch (error) {
    console.error("Failed to fetch chain TVLs from DeFi Llama:", error)
    throw error
  }
}

export async function getProtocolTVL(protocol: string): Promise<number> {
  const cacheKey = `defillama:tvl:${protocol}`
  const cached = getCached<number>(cacheKey)
  if (cached !== null) return cached

  try {
    const response = await fetch(`${DEFILLAMA_BASE_URL}/tvl/${protocol}`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 120 },
    })

    if (!response.ok) {
      throw new Error(`DeFi Llama API error: ${response.status}`)
    }

    const tvl = await response.json()
    setCache(cacheKey, tvl, 2 * 60 * 1000)
    return tvl
  } catch (error) {
    console.error(`Failed to fetch TVL for ${protocol} from DeFi Llama:`, error)
    throw error
  }
}

export async function getHistoricalChainTVL(
  chain: string
): Promise<HistoricalTVL[]> {
  const cacheKey = `defillama:chain:${chain}`
  const cached = getCached<HistoricalTVL[]>(cacheKey)
  if (cached) return cached

  try {
    const response = await fetch(`${DEFILLAMA_BASE_URL}/charts/${chain}`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`DeFi Llama API error: ${response.status}`)
    }

    const data = await response.json()
    setCache(cacheKey, data, 5 * 60 * 1000)
    return data
  } catch (error) {
    console.error(`Failed to fetch chain ${chain} from DeFi Llama:`, error)
    throw error
  }
}

export async function searchProtocols(
  query: string,
  limit: number = 10
): Promise<Protocol[]> {
  const protocols = await getAllProtocols()
  const searchLower = query.toLowerCase()

  return protocols
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.symbol?.toLowerCase().includes(searchLower)
    )
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, limit)
}

// ─── Protocol Data Helpers ───

export function getRecentTVLData(
  historicalTvl: HistoricalTVL[],
  days: number
): HistoricalTVL[] {
  if (!historicalTvl || historicalTvl.length === 0) return []

  const cutoffTime = Date.now() / 1000 - days * 24 * 60 * 60
  return historicalTvl.filter((item) => item.date >= cutoffTime)
}

export function getChainDistribution(
  protocol: ProtocolDetails
): { chain: string; tvl: number; percentage: number }[] {
  if (!protocol.currentChainTvls) return []

  const total = protocol.tvl
  const distribution = Object.entries(protocol.currentChainTvls)
    .filter(([chain]) => !chain.includes("-") && chain !== "tvl")
    .map(([chain, tvl]) => ({
      chain: chain.charAt(0).toUpperCase() + chain.slice(1),
      tvl,
      percentage: total > 0 ? (tvl / total) * 100 : 0,
    }))
    .sort((a, b) => b.tvl - a.tvl)

  return distribution
}

export function groupByCategory(
  protocols: Protocol[]
): Record<string, Protocol[]> {
  const grouped: Record<string, Protocol[]> = {}

  for (const protocol of protocols) {
    const category = protocol.category || "Other"
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(protocol)
  }

  return grouped
}
