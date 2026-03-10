/**
 * Merkl API incentive APR fetcher.
 * Fetches reward APRs from https://api.merkl.xyz/v4/opportunities (free, no API key).
 * Caches in memory for 30 minutes.
 */

const MERKL_BASE = "https://api.merkl.xyz/v4/opportunities"
const CACHE_TTL_MS = 30 * 60_000
const FETCH_TIMEOUT_MS = 15_000

// Zerion chain name → EVM chain ID
const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
  gnosis: 100,
  bsc: 56,
  fantom: 250,
  linea: 59144,
  scroll: 534352,
  blast: 81457,
  mantle: 5000,
  zksync: 324,
}

// Merkl protocol IDs for protocols that distribute incentives
const MERKL_PROTOCOL_IDS: Record<string, string> = {
  "aave-v3": "Aave",
}

interface MerklOpportunity {
  apr: number
  name: string
  identifier: string
  tokens: { symbol: string; address: string }[]
  explorerAddress?: string
}

interface CacheEntry {
  opportunities: MerklOpportunity[]
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (/^0x[a-f0-9]{40}$/.test(trimmed)) return trimmed
  return null
}

function extractAddresses(value: string | null | undefined): string[] {
  if (!value) return []
  const matches = value.toLowerCase().match(/0x[a-f0-9]{40}/g) ?? []
  return [...new Set(matches)]
}

function collectOpportunityAddresses(opp: MerklOpportunity): Set<string> {
  const addresses = new Set<string>()

  for (const token of opp.tokens ?? []) {
    const normalized = normalizeAddress(token.address)
    if (normalized) addresses.add(normalized)
  }

  const explorer = normalizeAddress(opp.explorerAddress)
  if (explorer) addresses.add(explorer)

  for (const extracted of extractAddresses(opp.identifier)) addresses.add(extracted)
  for (const extracted of extractAddresses(opp.name)) addresses.add(extracted)

  return addresses
}

async function fetchMerklOpportunities(
  chainId: number,
  merklProtocolId: string
): Promise<MerklOpportunity[]> {
  const cacheKey = `${chainId}:${merklProtocolId}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.opportunities
  }

  try {
    const url = `${MERKL_BASE}?chainId=${chainId}&mainProtocolId=${encodeURIComponent(merklProtocolId)}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    })

    if (!res.ok) {
      console.error(`[merkl] API returned ${res.status} for chain=${chainId} protocol=${merklProtocolId}`)
      return cached?.opportunities ?? []
    }

    const data: MerklOpportunity[] = await res.json()
    const opportunities = Array.isArray(data) ? data : []

    cache.set(cacheKey, { opportunities, timestamp: Date.now() })
    console.log(`[merkl] Cached ${opportunities.length} opportunities for ${merklProtocolId} on chain ${chainId}`)
    return opportunities
  } catch (err) {
    console.error("[merkl] Failed to fetch opportunities:", err)
    return cached?.opportunities ?? []
  }
}

/**
 * Get Merkl incentive APR for a specific position.
 * Returns the reward APR in percentage (e.g., 4.2 for 4.2%), or null if not found.
 */
export async function getMerklIncentiveApr(
  zerionChain: string,
  defiProject: string,
  input: {
    positionAddress?: string | null
    reserveAddresses?: Array<string | null | undefined>
  }
): Promise<number | null> {
  const chainId = CHAIN_ID_MAP[zerionChain.toLowerCase()]
  if (!chainId) return null

  const merklProtocolId = MERKL_PROTOCOL_IDS[defiProject]
  if (!merklProtocolId) return null

  const opportunities = await fetchMerklOpportunities(chainId, merklProtocolId)
  if (opportunities.length === 0) return null

  const candidateAddresses = new Set<string>()
  const positionAddress = normalizeAddress(input.positionAddress)
  if (positionAddress) candidateAddresses.add(positionAddress)
  for (const reserveAddress of input.reserveAddresses ?? []) {
    const normalized = normalizeAddress(reserveAddress)
    if (normalized) candidateAddresses.add(normalized)
  }
  if (candidateAddresses.size === 0) return null

  const match = opportunities.find((opp) => {
    const oppAddresses = collectOpportunityAddresses(opp)
    for (const candidate of candidateAddresses) {
      if (oppAddresses.has(candidate)) return true
    }
    return false
  })

  if (!match || !match.apr || match.apr <= 0) return null

  // Merkl returns APR as a percentage value already (e.g., 4.2 = 4.2%)
  return match.apr
}
