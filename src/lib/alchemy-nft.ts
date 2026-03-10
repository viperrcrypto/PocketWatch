import { getCached, setCache } from "@/lib/cache"
import { scoreNFTCollection } from "@/lib/portfolio/nft-spam-filter"

// ─── Constants ───
const NFT_CONTRACT = "0xd1ad8ebfb0fb6306962e48260cf1e8062eb28cfa"
const OWNERS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const NFTS_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

// OpenSea chain path slugs for fallback URLs (when no OpenSea slug is available)
const OPENSEA_CHAIN_SLUG: Record<string, string> = {
  ETHEREUM: "ethereum",
  BASE: "base",
  POLYGON: "matic",
  ARBITRUM: "arbitrum",
  OPTIMISM: "optimism",
  ZORA: "zora",
  BLAST: "blast",
  ZKSYNC: "zksync",
  AVAX: "avalanche",
  LINEA: "linea",
  BSC: "bnb",
}

// Chains supported by Alchemy NFT API with their slugs and display names
export const NFT_CHAINS: Array<{ chain: string; slug: string; name: string; symbol: string }> = [
  { chain: "ETHEREUM",  slug: "eth-mainnet",     name: "Ethereum",  symbol: "ETH"   },
  { chain: "BASE",      slug: "base-mainnet",    name: "Base",      symbol: "ETH"   },
  { chain: "POLYGON",   slug: "polygon-mainnet", name: "Polygon",   symbol: "MATIC" },
  { chain: "ARBITRUM",  slug: "arb-mainnet",     name: "Arbitrum",  symbol: "ETH"   },
  { chain: "OPTIMISM",  slug: "opt-mainnet",     name: "Optimism",  symbol: "ETH"   },
  { chain: "ZORA",      slug: "zora-mainnet",    name: "Zora",      symbol: "ETH"   },
  { chain: "BLAST",     slug: "blast-mainnet",   name: "Blast",     symbol: "ETH"   },
  { chain: "ZKSYNC",    slug: "zksync-mainnet",  name: "zkSync",    symbol: "ETH"   },
  { chain: "AVAX",      slug: "avax-mainnet",    name: "Avalanche", symbol: "AVAX"  },
  { chain: "LINEA",     slug: "linea-mainnet",   name: "Linea",     symbol: "ETH"   },
  { chain: "BSC",       slug: "bnb-mainnet",     name: "BSC",       symbol: "BNB"   },
  // Gnosis omitted — Alchemy NFT API does not support it
]

function getBaseUrl(slug: string, overrideKey?: string): string | null {
  const key = overrideKey || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  if (!key) return null
  return `https://${slug}.g.alchemy.com/nft/v3/${key}`
}

/** Set a runtime Alchemy key (called from API routes with the user's DB key). */
let _runtimeAlchemyKey: string | null = null
export function setAlchemyKey(key: string | null) {
  _runtimeAlchemyKey = key
}

// ─── Types ───

export interface NFTAttribute {
  trait_type: string
  value: string
}

export interface NFTImage {
  cachedUrl: string | null
  thumbnailUrl: string | null
  pngUrl: string | null
  originalUrl: string | null
}

export interface MemberNFT {
  tokenId: string
  name: string | null
  image: NFTImage
  attributes: NFTAttribute[]
}

// ─── API Functions ───

/**
 * Fetch NFT counts for all owners of the contract.
 * Returns a Map of lowercase wallet address → NFT count.
 */
export async function getOwnerNFTCounts(): Promise<Map<string, number>> {
  const cached = getCached<Map<string, number>>("nft:owners")
  if (cached) return cached

  const baseUrl = getBaseUrl("eth-mainnet", _runtimeAlchemyKey ?? undefined)
  if (!baseUrl) return new Map()

  try {
    const url = `${baseUrl}/getOwnersForContract?contractAddress=${NFT_CONTRACT}&withTokenBalances=true`
    const res = await fetch(url)

    if (!res.ok) {
      console.error("[Alchemy] getOwnersForContract failed:", res.status)
      return new Map()
    }

    const data = await res.json()
    const owners: Array<{
      ownerAddress: string
      tokenBalances: Array<{ tokenId: string; balance: string }>
    }> = data.owners || []

    const map = new Map<string, number>()
    for (const owner of owners) {
      map.set(
        owner.ownerAddress.toLowerCase(),
        owner.tokenBalances?.length || 0
      )
    }

    setCache("nft:owners", map, OWNERS_CACHE_TTL)
    return map
  } catch (error) {
    console.error("[Alchemy] getOwnerNFTCounts error:", error)
    return new Map()
  }
}

/**
 * Fetch full NFT details for a specific owner address.
 * Returns array of NFTs with metadata, images, and traits.
 */
export async function getNFTsForOwner(
  ownerAddress: string
): Promise<MemberNFT[]> {
  const cacheKey = `nft:owner:${ownerAddress.toLowerCase()}`
  const cached = getCached<MemberNFT[]>(cacheKey)
  if (cached) return cached

  const baseUrl = getBaseUrl("eth-mainnet", _runtimeAlchemyKey ?? undefined)
  if (!baseUrl) return []

  try {
    const params = new URLSearchParams({
      owner: ownerAddress,
      "contractAddresses[]": NFT_CONTRACT,
      withMetadata: "true",
    })
    const url = `${baseUrl}/getNFTsForOwner?${params}`
    const res = await fetch(url)

    if (!res.ok) {
      console.error("[Alchemy] getNFTsForOwner failed:", res.status)
      return []
    }

    const data = await res.json()
    const ownedNfts: any[] = data.ownedNfts || []

    const nfts: MemberNFT[] = ownedNfts.map((nft) => ({
      tokenId: nft.tokenId,
      name: nft.name || nft.raw?.metadata?.name || null,
      image: {
        cachedUrl: nft.image?.cachedUrl || null,
        thumbnailUrl: nft.image?.thumbnailUrl || null,
        pngUrl: nft.image?.pngUrl || null,
        originalUrl: nft.image?.originalUrl || null,
      },
      attributes: nft.raw?.metadata?.attributes || [],
    }))

    setCache(cacheKey, nfts, NFTS_CACHE_TTL)
    return nfts
  } catch (error) {
    console.error("[Alchemy] getNFTsForOwner error:", error)
    return []
  }
}

// ─── Floor Price & Valuation ───

export interface NFTItem {
  tokenId: string
  name: string | null
  imageUrl: string | null
  contractAddress: string
  collectionName: string
}

export interface NFTCollection {
  contractAddress: string
  name: string
  symbol: string | null
  chain: string             // e.g. "ETHEREUM", "BASE"
  chainName: string         // e.g. "Ethereum", "Base"
  totalBalance: number
  floorPrice: number | null  // native token (ETH/MATIC)
  floorPriceUsd: number | null
  imageUrl: string | null
  tokenIds: string[]
  nfts: NFTItem[]           // individual NFTs with images
  openSeaUrl: string | null
  isSpamAlchemy: boolean
  spamScore: number
  spamReasons: string[]
}

interface AlchemyNftItem {
  contract: {
    address: string
    name?: string
    symbol?: string
    isSpam?: boolean
    spamClassifications?: string[]
    openSeaMetadata?: { floorPrice?: number; imageUrl?: string; openSeaSlug?: string }
  }
  tokenId: string
  name?: string
  image?: { thumbnailUrl?: string; cachedUrl?: string; pngUrl?: string }
  balance?: string
}

const FLOOR_PRICE_CACHE_TTL = 15 * 60 * 1000 // 15 minutes

const MAX_NFTS_PER_CHAIN = 500

/**
 * Fetch all NFTs owned by an address on a specific chain, with floor prices.
 * Paginates through all results (capped at MAX_NFTS_PER_CHAIN).
 */
export async function getNFTPortfolio(
  ownerAddress: string,
  nativePriceUsd: number,
  chainSlug = "eth-mainnet",
  chainId = "ETHEREUM",
  chainName = "Ethereum",
): Promise<{ collections: NFTCollection[]; totalValueUsd: number }> {
  const cacheKey = `nft:portfolio:${chainSlug}:${ownerAddress.toLowerCase()}`
  const cached = getCached<{ collections: NFTCollection[]; totalValueUsd: number }>(cacheKey)
  if (cached) return cached

  const baseUrl = getBaseUrl(chainSlug, _runtimeAlchemyKey ?? undefined)
  if (!baseUrl) return { collections: [], totalValueUsd: 0 }

  try {
    // Paginate through all NFTs on this chain
    const allNfts: AlchemyNftItem[] = []
    let pageKey: string | undefined

    do {
      const params = new URLSearchParams({
        owner: ownerAddress,
        withMetadata: "true",
        excludeFilters: "SPAM",
        pageSize: "100",
      })
      if (pageKey) params.set("pageKey", pageKey)

      const url = `${baseUrl}/getNFTsForOwner?${params}`
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })

      if (!res.ok) {
        if (res.status !== 404) console.error(`[Alchemy] getNFTPortfolio ${chainSlug} failed:`, res.status)
        break
      }

      const data = await res.json()
      const nfts: AlchemyNftItem[] = data.ownedNfts || []
      allNfts.push(...nfts)
      pageKey = data.pageKey ?? undefined
    } while (pageKey && allNfts.length < MAX_NFTS_PER_CHAIN)

    // Group by collection (contract address)
    const collectionMap = new Map<string, {
      name: string
      symbol: string | null
      floorPrice: number | null
      imageUrl: string | null
      openSeaSlug: string | null
      isSpamAlchemy: boolean
      tokenIds: string[]
      nfts: NFTItem[]
    }>()

    for (const nft of allNfts) {
      const addr = nft.contract.address.toLowerCase()
      const nftImage =
        nft.image?.thumbnailUrl ?? nft.image?.cachedUrl ?? nft.image?.pngUrl ?? null
      const nftItem: NFTItem = {
        tokenId: nft.tokenId,
        name: nft.name ?? null,
        imageUrl: nftImage,
        contractAddress: addr,
        collectionName: nft.contract.name ?? "Unknown Collection",
      }
      const existing = collectionMap.get(addr)
      if (existing) {
        existing.tokenIds.push(nft.tokenId)
        existing.nfts.push(nftItem)
        // If any NFT in the collection is flagged as spam by Alchemy, flag the whole collection
        if (nft.contract.isSpam) existing.isSpamAlchemy = true
      } else {
        collectionMap.set(addr, {
          name: nft.contract.name ?? "Unknown Collection",
          symbol: nft.contract.symbol ?? null,
          floorPrice: nft.contract.openSeaMetadata?.floorPrice ?? null,
          imageUrl: nft.contract.openSeaMetadata?.imageUrl ?? nftImage,
          openSeaSlug: nft.contract.openSeaMetadata?.openSeaSlug ?? null,
          isSpamAlchemy: nft.contract.isSpam === true,
          tokenIds: [nft.tokenId],
          nfts: [nftItem],
        })
      }
    }

    const collections: NFTCollection[] = []
    let totalValueUsd = 0

    for (const [contractAddress, col] of collectionMap) {
      const floorPriceUsd = col.floorPrice != null ? col.floorPrice * nativePriceUsd : null
      const collectionValue = floorPriceUsd != null ? floorPriceUsd * col.tokenIds.length : 0

      const spam = scoreNFTCollection({
        name: col.name,
        floorPrice: col.floorPrice,
        openSeaSlug: col.openSeaSlug,
        isSpamAlchemy: col.isSpamAlchemy,
      })

      collections.push({
        contractAddress,
        name: col.name,
        symbol: col.symbol,
        chain: chainId,
        chainName,
        totalBalance: col.tokenIds.length,
        floorPrice: col.floorPrice,
        floorPriceUsd,
        imageUrl: col.imageUrl,
        tokenIds: col.tokenIds,
        nfts: col.nfts,
        openSeaUrl: col.openSeaSlug
          ? `https://opensea.io/collection/${col.openSeaSlug}`
          : `https://opensea.io/assets/${OPENSEA_CHAIN_SLUG[chainId] ?? chainId.toLowerCase()}/${contractAddress}`,
        isSpamAlchemy: col.isSpamAlchemy,
        spamScore: spam.score,
        spamReasons: spam.reasons,
      })
      totalValueUsd += collectionValue
    }

    collections.sort((a, b) => (b.floorPriceUsd ?? 0) * b.totalBalance - (a.floorPriceUsd ?? 0) * a.totalBalance)

    const result = { collections, totalValueUsd }
    setCache(cacheKey, result, FLOOR_PRICE_CACHE_TTL)
    return result
  } catch (error) {
    console.error("[Alchemy] getNFTPortfolio error:", error)
    return { collections: [], totalValueUsd: 0 }
  }
}

/**
 * Fetch NFT portfolio across all supported chains and merge results.
 * @param nativePrices - Map of native token symbol → USD price (e.g. ETH → 3000, MATIC → 0.50)
 */
export async function getNFTPortfolioAllChains(
  ownerAddress: string,
  nativePrices: Map<string, number>,
): Promise<{ collections: NFTCollection[]; totalValueUsd: number }> {
  const results = await Promise.allSettled(
    NFT_CHAINS.map(({ chain, slug, name, symbol }) => {
      const nativePriceUsd = nativePrices.get(symbol) ?? 0
      return getNFTPortfolio(ownerAddress, nativePriceUsd, slug, chain, name)
    })
  )

  const allCollections: NFTCollection[] = []
  let totalValueUsd = 0

  for (const result of results) {
    if (result.status === "fulfilled") {
      allCollections.push(...result.value.collections)
      totalValueUsd += result.value.totalValueUsd
    }
  }

  allCollections.sort((a, b) => (b.floorPriceUsd ?? 0) * b.totalBalance - (a.floorPriceUsd ?? 0) * a.totalBalance)
  return { collections: allCollections, totalValueUsd }
}
