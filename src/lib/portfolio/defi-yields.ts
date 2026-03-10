/**
 * DefiLlama yield data fetcher.
 * Fetches pool APY data from https://yields.llama.fi/pools (free, no API key).
 * Caches in memory for 30 minutes.
 */

const YIELDS_URL = "https://yields.llama.fi/pools"
const CACHE_TTL_MS = 30 * 60_000
const FETCH_TIMEOUT_MS = 15_000

interface LlamaPool {
  pool: string
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apy: number | null
  apyBase: number | null
  apyReward: number | null
}

export interface YieldInfo {
  apy: number
  apyBase: number | null
  apyReward: number | null
  pool: string
  tvlUsd: number
}

// ─── Chain name mapping: Zerion → DefiLlama ───

const CHAIN_MAP: Record<string, string> = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
  avalanche: "Avalanche",
  gnosis: "Gnosis",
  bsc: "BSC",
  fantom: "Fantom",
  zksync: "zkSync Era",
  linea: "Linea",
  scroll: "Scroll",
  blast: "Blast",
  mantle: "Mantle",
}

// ─── Protocol mapping: token pattern → DefiLlama project slug ───

export const DEFI_PROTOCOLS: {
  pattern: RegExp
  protocol: string
  project: string
  type: "deposit" | "staked"
}[] = [
  // ─── Aave ───
  { pattern: /^a(Eth|Arb|Pol|Opt|Base|Ava)/, protocol: "Aave V3", project: "aave-v3", type: "deposit" },
  { pattern: /^a(USDC|USDT|DAI|WETH|WBTC|LINK|UNI|MATIC)$/i, protocol: "Aave V2", project: "aave-v2", type: "deposit" },
  // ─── Compound ───
  { pattern: /^c(USDC|USDT|DAI|ETH|WBTC|UNI|COMP|LINK|BAT)$/i, protocol: "Compound V2", project: "compound-v2", type: "deposit" },
  { pattern: /^c\w+v3$/i, protocol: "Compound V3", project: "compound-v3", type: "deposit" },
  // ─── Yearn ───
  { pattern: /^yv/i, protocol: "Yearn", project: "yearn-finance", type: "deposit" },
  // ─── Morpho ───
  { pattern: /^m(WBTC|USDC|DAI|WETH)/i, protocol: "Morpho", project: "morpho", type: "deposit" },
  // ─── Liquid Staking ───
  { pattern: /^(stETH|wstETH)$/i, protocol: "Lido", project: "lido", type: "staked" },
  { pattern: /^rETH$/i, protocol: "Rocket Pool", project: "rocket-pool", type: "staked" },
  { pattern: /^cbETH$/i, protocol: "Coinbase", project: "coinbase-wrapped-staked-eth", type: "staked" },
  { pattern: /^(eETH|weETH)$/i, protocol: "EtherFi", project: "ether.fi-stake", type: "staked" },
  { pattern: /^(liquidETH|katanaETH)$/i, protocol: "EtherFi", project: "ether.fi-liquid", type: "staked" },
  { pattern: /^ezETH$/i, protocol: "Renzo", project: "renzo", type: "staked" },
  { pattern: /^rsETH$/i, protocol: "Kelp DAO", project: "kelp-dao", type: "staked" },
  { pattern: /^pufETH$/i, protocol: "Puffer", project: "puffer-finance", type: "staked" },
  { pattern: /^uniETH$/i, protocol: "Bedrock", project: "bedrock", type: "staked" },
  { pattern: /^(OETH|woETH|superOETH)/i, protocol: "Origin", project: "origin-ether", type: "staked" },
  { pattern: /^sUSDe$/i, protocol: "Ethena", project: "ethena", type: "staked" },
  { pattern: /^(frxETH|sfrxETH)$/i, protocol: "Frax Ether", project: "frax-ether", type: "staked" },
  { pattern: /^rswETH$/i, protocol: "Swell", project: "swell-liquid-staking", type: "staked" },
  { pattern: /^swETH$/i, protocol: "Swell", project: "swell-liquid-staking", type: "staked" },
  { pattern: /^osETH$/i, protocol: "StakeWise", project: "stakewise-v3", type: "staked" },
  { pattern: /^mETH$/i, protocol: "Mantle LSP", project: "mantle-staked-eth", type: "staked" },
  { pattern: /^ankrETH$/i, protocol: "Ankr", project: "ankr", type: "staked" },
  { pattern: /^ETHx$/i, protocol: "Stader", project: "stader", type: "staked" },
  // ─── Deposit / Yield ───
  { pattern: /^sDAI$/i, protocol: "Spark", project: "spark", type: "deposit" },
  { pattern: /^sUSDai$/i, protocol: "Sky (MakerDAO)", project: "maker-dsr", type: "deposit" },
  { pattern: /^sUSDS$/i, protocol: "Sky (MakerDAO)", project: "maker-dsr", type: "deposit" },
  // ─── Pendle (must be last — broad prefix match) ───
  { pattern: /^PT-/i, protocol: "Pendle", project: "pendle", type: "deposit" },
  { pattern: /^YT-/i, protocol: "Pendle", project: "pendle", type: "deposit" },
]

// ─── Known LST coin IDs for DeFiLlama price fallback ───
// When Zerion returns price=0 for these tokens, we look up
// the price via coins.llama.fi/prices/current/{coinId}.

export const KNOWN_LST_COIN_IDS: Record<string, string> = {
  STETH:  "ethereum:0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
  WSTETH: "ethereum:0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
  RETH:   "ethereum:0xae78736cd615f374d3085123a210448e74fc6393",
  CBETH:  "ethereum:0xbe9895146f7af43049ca1c1ae358b0541ea49704",
  EETH:   "ethereum:0x35fa164735182de50811e8e2e824cfb9b6118ac2",
  WEETH:  "ethereum:0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee",
  LIQUIDETH: "ethereum:0xf0bb20865277abd641a307ece5ee04e79073416c",
  EZETH:  "ethereum:0xbf5495efe5db9ce00f80364c8b423567e58d2110",
  RSETH:  "ethereum:0xa1290d69c65a6fe4df752f95823fae25cb99e5a7",
  PUFETH: "ethereum:0xd9a442856c234a39a81a089c06451ebaa4306a72",
  SUSDE:  "ethereum:0x9d39a5de30e57443bff2a8307a4256c8797a3497",
  SDAI:   "ethereum:0x83f20f44975d03b1b09e64809b757c47f942beea",
  METH:   "ethereum:0xd5f7838f5c461feff7fe49ea5ebaf7728bb0adfa",
  SWETH:  "ethereum:0xf951e335afb289353dc249e82926178eac7ded78",
  OETH:   "ethereum:0x856c4efb76c1d1ae02e20ceb03a2a6a08b0b8dc3",
  FRXETH: "ethereum:0x5e8422345238f34275888049021821e8e08caa1f",
  SFRXETH:"ethereum:0xac3e018457b222d93114458476f3e3416abbe38f",
  KATANAETH: "ethereum:0x69d210d3b60e939bfa6e87cccc4fab7e8f44c16b",
}

// ─── Underlying asset extraction ───

const ATOKEN_PREFIX = /^a(Eth|Arb|Pol|Opt|Base|Ava)/

const PENDLE_EXPIRY = /-(\d{2}[A-Z]{3}\d{4})$/

export function getUnderlyingSymbol(symbol: string): string | null {
  // Aave V3: "aEthPYUSD" → "PYUSD"
  const aaveV3Match = symbol.match(ATOKEN_PREFIX)
  if (aaveV3Match) return symbol.slice(aaveV3Match[0].length)

  // Aave V2: "aUSDC" → "USDC"
  const aaveV2Match = symbol.match(/^a(USDC|USDT|DAI|WETH|WBTC|LINK|UNI|MATIC)$/i)
  if (aaveV2Match) return aaveV2Match[1]

  // Compound V2: "cUSDC" → "USDC", "cETH" → "ETH"
  const compV2Match = symbol.match(/^c(USDC|USDT|DAI|ETH|WBTC|UNI|COMP|LINK|BAT)$/i)
  if (compV2Match) return compV2Match[1]

  // Compound V3: "cUSDCv3" → "USDC"
  const compV3Match = symbol.match(/^c(\w+)v3$/i)
  if (compV3Match) return compV3Match[1]

  // Yearn: "yvUSDC" → "USDC"
  if (/^yv/i.test(symbol)) return symbol.slice(2)

  // Morpho: "mWETH" → "WETH"
  const morphoMatch = symbol.match(/^m(WBTC|USDC|DAI|WETH)/i)
  if (morphoMatch) return morphoMatch[1]

  // ETH liquid staking derivatives
  if (/^(st|wst)ETH$/i.test(symbol)) return "ETH"
  if (/^(r|cb|os|sw|ankr|rsw|puf|uni)ETH$/i.test(symbol)) return "ETH"
  if (/^(eETH|weETH|liquidETH|katanaETH|ezETH|rsETH|pufETH|uniETH)$/i.test(symbol)) return "ETH"
  if (/^ETHx$/i.test(symbol)) return "ETH"
  if (/^(frxETH|sfrxETH)$/i.test(symbol)) return "ETH"
  if (/^(OETH|woETH|superOETH)/i.test(symbol)) return "ETH"
  if (/^mETH$/i.test(symbol)) return "ETH"

  // Ethena: "sUSDe" → "USDe"
  if (/^sUSDe$/i.test(symbol)) return "USDe"

  // Spark: "sDAI" → "DAI"
  if (/^sDAI$/i.test(symbol)) return "DAI"

  // Sky (MakerDAO): "sUSDai" → "DAI", "sUSDS" → "USDS"
  if (/^sUSDai$/i.test(symbol)) return "DAI"
  if (/^sUSDS$/i.test(symbol)) return "USDS"

  // Pendle: "PT-sUSDe-07MAY2026" → "sUSDe", "YT-aUSDC-26DEC2024" → "aUSDC"
  if (/^(PT|YT)-/i.test(symbol)) {
    const stripped = symbol.replace(/^(PT|YT)-/i, "").replace(PENDLE_EXPIRY, "")
    return stripped || null
  }

  return null
}

// ─── Cache ───

let poolCache: { pools: LlamaPool[]; timestamp: number } | null = null
let inflightFetch: Promise<LlamaPool[]> | null = null

async function fetchPools(): Promise<LlamaPool[]> {
  if (poolCache && Date.now() - poolCache.timestamp < CACHE_TTL_MS) {
    return poolCache.pools
  }

  // Coalesce concurrent requests into a single in-flight fetch
  if (inflightFetch) return inflightFetch

  inflightFetch = fetchPoolsFromNetwork().finally(() => {
    inflightFetch = null
  })

  return inflightFetch
}

async function fetchPoolsFromNetwork(): Promise<LlamaPool[]> {
  try {
    const res = await fetch(YIELDS_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    })

    if (!res.ok) {
      const ageMs = poolCache ? Date.now() - poolCache.timestamp : null
      console.error(
        `[defi-yields] DefiLlama returned ${res.status}. Serving ${ageMs != null ? `${Math.round(ageMs / 60_000)}m old` : "empty"} cached data.`,
      )
      return poolCache?.pools ?? []
    }

    const json = await res.json()
    const pools: LlamaPool[] = (json.data ?? []).filter(
      (p: LlamaPool) => p.apy !== null && p.apy > 0 && p.tvlUsd > 100_000
    )

    poolCache = { pools, timestamp: Date.now() }
    console.log(`[defi-yields] Cached ${pools.length} pools from DefiLlama`)
    return pools
  } catch (err) {
    console.error("[defi-yields] Failed to fetch pools:", err)
    return poolCache?.pools ?? []
  }
}

/**
 * Look up yield for a DeFi position.
 * Matches by DefiLlama project slug + chain + symbol substring.
 */
export async function getYieldForPosition(
  project: string,
  zerionChain: string,
  symbol: string
): Promise<YieldInfo | null> {
  const pools = await fetchPools()
  if (pools.length === 0) return null

  const llamaChain = CHAIN_MAP[zerionChain.toLowerCase()]
  if (!llamaChain) return null

  const underlying = getUnderlyingSymbol(symbol) ?? symbol
  const symbolUpper = symbol.toUpperCase()
  const underlyingUpper = underlying.toUpperCase()
  const projectsToMatch = new Set(
    project === "ether.fi-stake"
      ? ["ether.fi-stake", "ether.fi-liquid"]
      : project === "ether.fi-liquid"
        ? ["ether.fi-liquid", "ether.fi-stake"]
        : [project],
  )
  const symbolCandidates = new Set([symbolUpper, underlyingUpper])
  if (symbolUpper === "EETH" || symbolUpper === "WEETH") {
    symbolCandidates.add("EETH")
    symbolCandidates.add("WEETH")
  }

  // Find best matching pool: same project, same chain, symbol matches
  let candidates = pools.filter((p) => {
    if (!projectsToMatch.has(p.project)) return false
    if (p.chain !== llamaChain) return false
    // Pool symbols are usually "USDC", "WETH-USDC", etc.
    const poolSymbols = p.symbol.toUpperCase().split(/[-/\s]+/)
    for (const candidate of symbolCandidates) {
      if (poolSymbols.includes(candidate)) return true
    }
    return false
  })

  // EtherFi sometimes publishes only protocol-level pools without token-specific symbols.
  // Fall back to chain+project match so katanaETH/liquidETH still get a usable APY.
  if (
    candidates.length === 0
    && (project === "ether.fi-stake" || project === "ether.fi-liquid")
  ) {
    candidates = pools.filter((p) => projectsToMatch.has(p.project) && p.chain === llamaChain)
  }

  if (candidates.length === 0) return null

  // Pick the pool with highest TVL (most representative)
  const best = candidates.reduce((a, b) => (a.tvlUsd > b.tvlUsd ? a : b))

  return {
    apy: best.apy ?? 0,
    apyBase: best.apyBase,
    apyReward: best.apyReward,
    pool: best.pool,
    tvlUsd: best.tvlUsd,
  }
}

/**
 * Batch-fetch yields for multiple positions.
 * Fetches pools once, then matches each position.
 */
export async function getYieldsForPositions(
  positions: { project: string; chain: string; symbol: string }[]
): Promise<Map<string, YieldInfo>> {
  const results = new Map<string, YieldInfo>()
  if (positions.length === 0) return results

  // Pre-warm cache
  await fetchPools()

  // Fetch in parallel
  const entries = await Promise.all(
    positions.map(async (pos) => {
      const key = `${pos.project}:${pos.chain}:${pos.symbol}`
      const info = await getYieldForPosition(pos.project, pos.chain, pos.symbol)
      return [key, info] as const
    })
  )

  for (const [key, info] of entries) {
    if (info) results.set(key, info)
  }

  return results
}
