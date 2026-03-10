// Token metadata and price enrichment for the Wallet Tracker.
// Uses Codex as primary source (when available), DeFiLlama + DexScreener as fallback.

import type { Codex } from "@codex-data/sdk"
import type { TrackerChain } from "./types"
import { DEFILLAMA_CHAIN_MAP, CODEX_NETWORK_IDS } from "./chains"
import { getCodexToken } from "@/lib/codex"

interface TokenInfo {
  symbol?: string
  name?: string
  decimals?: number
  priceUsd?: number
  marketCap?: number
  totalSupply?: number
  logoUrl?: string
  pairAddress?: string
  headerUrl?: string
  websiteUrl?: string
  twitterUrl?: string
  telegramUrl?: string
  description?: string
  liquidityUsd?: number
  volume24h?: number
  pairCreatedAt?: string
}

// ─── DeFiLlama Price API (free, no key needed) ───

export async function getTokenPrice(
  chain: TrackerChain,
  tokenAddress: string
): Promise<{ priceUsd: number | null; marketCap: number | null }> {
  try {
    const llamaChain = DEFILLAMA_CHAIN_MAP[chain]
    const key = `${llamaChain}:${tokenAddress}`
    const res = await fetch(
      `https://coins.llama.fi/prices/current/${key}`,
      { signal: AbortSignal.timeout(10_000) }
    )

    if (!res.ok) return { priceUsd: null, marketCap: null }

    const data = await res.json()
    const coin = data.coins?.[key]

    return {
      priceUsd: coin?.price ?? null,
      marketCap: coin?.mcap ?? null,
    }
  } catch {
    return { priceUsd: null, marketCap: null }
  }
}

// Batch price fetch for multiple tokens
export async function getTokenPricesBatch(
  tokens: { chain: TrackerChain; address: string }[]
): Promise<Map<string, { priceUsd: number | null; marketCap: number | null }>> {
  const result = new Map<string, { priceUsd: number | null; marketCap: number | null }>()

  if (tokens.length === 0) return result

  try {
    const keys = tokens.map(
      (t) => `${DEFILLAMA_CHAIN_MAP[t.chain]}:${t.address}`
    )
    const res = await fetch(
      `https://coins.llama.fi/prices/current/${keys.join(",")}`,
      { signal: AbortSignal.timeout(15_000) }
    )

    if (!res.ok) return result

    const data = await res.json()

    for (const token of tokens) {
      const key = `${DEFILLAMA_CHAIN_MAP[token.chain]}:${token.address}`
      const coin = data.coins?.[key]
      result.set(`${token.chain}:${token.address}`, {
        priceUsd: coin?.price ?? null,
        marketCap: coin?.mcap ?? null,
      })
    }
  } catch {
    // Return empty map on failure
  }

  return result
}

// ─── DexScreener API (free, rate limited) ───

interface DexScreenerPair {
  chainId: string
  dexId: string
  pairAddress: string
  baseToken: {
    address: string
    name: string
    symbol: string
  }
  quoteToken: {
    address: string
    name: string
    symbol: string
  }
  priceUsd: string
  fdv: number
  liquidity: { usd: number }
  volume: { h24: number }
  pairCreatedAt?: string
  info?: {
    imageUrl?: string
    header?: string
    openGraph?: string
    websites?: { label: string; url: string }[]
    socials?: { type: string; url: string }[]
    description?: string
  }
}

export async function getDexScreenerData(
  chain: TrackerChain,
  tokenAddress: string
): Promise<TokenInfo | null> {
  try {
    const chainSlug = chain === "SOLANA" ? "solana" : chain === "ETHEREUM" ? "ethereum" : chain === "BASE" ? "base" : chain === "ARBITRUM" ? "arbitrum" : chain === "BSC" ? "bsc" : "polygon"

    const res = await fetch(
      `https://api.dexscreener.com/tokens/v1/${chainSlug}/${tokenAddress}`,
      { signal: AbortSignal.timeout(10_000) }
    )

    if (!res.ok) return null

    const pairs: DexScreenerPair[] = await res.json()

    if (!pairs || pairs.length === 0) return null

    // Pick the pair with highest liquidity
    const bestPair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0]

    const info = bestPair.info
    const websiteUrl = info?.websites?.[0]?.url
    const twitterUrl = info?.socials?.find((s) => s.type === "twitter")?.url
    const telegramUrl = info?.socials?.find((s) => s.type === "telegram")?.url

    return {
      symbol: bestPair.baseToken.symbol,
      name: bestPair.baseToken.name,
      priceUsd: parseFloat(bestPair.priceUsd) || undefined,
      marketCap: bestPair.fdv || undefined,
      pairAddress: bestPair.pairAddress,
      logoUrl: info?.imageUrl,
      headerUrl: info?.header,
      websiteUrl,
      twitterUrl,
      telegramUrl,
      description: info?.description,
      liquidityUsd: bestPair.liquidity?.usd || undefined,
      volume24h: bestPair.volume?.h24 || undefined,
      pairCreatedAt: bestPair.pairCreatedAt || undefined,
    }
  } catch {
    return null
  }
}

// ─── Codex Token Enrichment (primary when available) ───

export async function enrichTokenCodex(
  chain: TrackerChain,
  tokenAddress: string,
  codexOverride?: Codex | null
): Promise<TokenInfo | null> {
  try {
    const networkId = CODEX_NETWORK_IDS[chain]
    const token = await getCodexToken(tokenAddress, networkId, codexOverride)
    if (!token) return null

    return {
      symbol: token.symbol ?? undefined,
      name: token.name ?? undefined,
      decimals: token.decimals,
      logoUrl: token.info?.imageThumbUrl ?? token.info?.imageSmallUrl ?? undefined,
      totalSupply: token.info?.totalSupply ? parseFloat(token.info.totalSupply) : undefined,
    }
  } catch {
    return null
  }
}

// ─── Jupiter Token API (Solana-specific, free, comprehensive coverage) ───

interface JupiterTokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  logoURI?: string
  tags?: string[]
}

export async function getJupiterTokenData(
  tokenAddress: string
): Promise<TokenInfo | null> {
  try {
    const res = await fetch(
      `https://api.jup.ag/tokens/v1/${tokenAddress}`,
      { signal: AbortSignal.timeout(5_000) }
    )

    if (!res.ok) return null

    const data: JupiterTokenInfo = await res.json()
    if (!data || !data.symbol) return null

    return {
      symbol: data.symbol,
      name: data.name,
      decimals: data.decimals,
      logoUrl: data.logoURI,
    }
  } catch {
    return null
  }
}

// ─── Combined Token Enrichment ───

export async function enrichToken(
  chain: TrackerChain,
  tokenAddress: string,
  codexOverride?: Codex | null
): Promise<TokenInfo> {
  // Try Codex first if available, then DeFiLlama + DexScreener as fallback
  // For Solana, also try Jupiter Token API (best coverage for SPL tokens)
  const [codexData, llamaData, dexData, jupiterData] = await Promise.allSettled([
    codexOverride ? enrichTokenCodex(chain, tokenAddress, codexOverride) : Promise.resolve(null),
    getTokenPrice(chain, tokenAddress),
    getDexScreenerData(chain, tokenAddress),
    chain === "SOLANA" ? getJupiterTokenData(tokenAddress) : Promise.resolve(null),
  ])

  const codex = codexData.status === "fulfilled" ? codexData.value : null
  const llama = llamaData.status === "fulfilled" ? llamaData.value : { priceUsd: null, marketCap: null }
  const dex = dexData.status === "fulfilled" ? dexData.value : null
  const jupiter = jupiterData.status === "fulfilled" ? jupiterData.value : null

  return {
    symbol: codex?.symbol ?? dex?.symbol ?? jupiter?.symbol,
    name: codex?.name ?? dex?.name ?? jupiter?.name,
    decimals: codex?.decimals ?? jupiter?.decimals,
    priceUsd: llama.priceUsd ?? dex?.priceUsd,
    marketCap: llama.marketCap ?? dex?.marketCap,
    totalSupply: codex?.totalSupply,
    pairAddress: dex?.pairAddress,
    logoUrl: codex?.logoUrl ?? dex?.logoUrl ?? jupiter?.logoUrl,
    headerUrl: dex?.headerUrl,
    websiteUrl: dex?.websiteUrl,
    twitterUrl: dex?.twitterUrl,
    telegramUrl: dex?.telegramUrl,
    description: dex?.description,
    liquidityUsd: dex?.liquidityUsd,
    volume24h: dex?.volume24h,
    pairCreatedAt: dex?.pairCreatedAt,
  }
}

// ─── Native Token Prices ───

const SOL_COINGECKO_ID = "solana"
const ETH_COINGECKO_ID = "ethereum"
const BNB_COINGECKO_ID = "binancecoin"
const POL_COINGECKO_ID = "matic-network"

const NATIVE_PRICE_CACHE: Map<string, { price: number; fetchedAt: number }> = new Map()
const NATIVE_CACHE_TTL = 60_000 // 1 minute

export async function getNativeTokenPrice(chain: TrackerChain): Promise<number | null> {
  const id = chain === "SOLANA" ? SOL_COINGECKO_ID
    : chain === "BSC" ? BNB_COINGECKO_ID
    : chain === "POLYGON" ? POL_COINGECKO_ID
    : ETH_COINGECKO_ID

  // Check cache
  const cached = NATIVE_PRICE_CACHE.get(id)
  if (cached && Date.now() - cached.fetchedAt < NATIVE_CACHE_TTL) {
    return cached.price
  }

  try {
    // Use DeFiLlama for native prices (free, no key)
    const res = await fetch(
      `https://coins.llama.fi/prices/current/coingecko:${id}`,
      { signal: AbortSignal.timeout(5_000) }
    )

    if (!res.ok) return cached?.price ?? null

    const data = await res.json()
    const price = data.coins?.[`coingecko:${id}`]?.price

    if (price) {
      NATIVE_PRICE_CACHE.set(id, { price, fetchedAt: Date.now() })
      return price
    }

    return cached?.price ?? null
  } catch {
    return cached?.price ?? null
  }
}
