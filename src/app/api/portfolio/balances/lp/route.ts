import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import { fetchUniV3Positions } from "@/lib/portfolio/lp-positions/uniswap-v3"
import {
  calculateConcentratedIL,
  tickToPrice,
  estimateEntryPrice,
} from "@/lib/portfolio/lp-positions/il-calculator"
import { getCurrentPrices, type TokenPriceInput } from "@/lib/defillama"
import { DEFILLAMA_CHAIN_MAP } from "@/lib/tracker/chains"

export const maxDuration = 45

// In-memory cache per user
const cache = new Map<string, { data: object; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60_000 // 5 minutes

/** GET /api/portfolio/balances/lp — fetch Uniswap V3 LP positions with IL */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9070", "Authentication required", 401)

  const cached = cache.get(user.id)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data)
  }

  try {
    const [alchemyKey, wallets] = await Promise.all([
      getServiceKey(user.id, "alchemy"),
      db.trackedWallet.findMany({
        where: { userId: user.id },
        select: { address: true, label: true },
      }),
    ])

    if (!alchemyKey) {
      return NextResponse.json({
        totalValueUsd: 0,
        positions: [],
        message: "No Alchemy API key configured.",
      })
    }

    // Only EVM wallets (0x prefix)
    const evmWallets = wallets.filter((w) => w.address.startsWith("0x"))

    // Supported chains for Uniswap V3
    const LP_CHAINS = ["ETHEREUM", "ARBITRUM", "BASE", "POLYGON", "OPTIMISM"] as const

    // Fetch all positions across wallets and chains
    const allPositions: Array<{
      wallet: string
      walletLabel: string | null
      chain: string
      position: Awaited<ReturnType<typeof fetchUniV3Positions>>[number]
    }> = []

    for (const wallet of evmWallets) {
      for (const chain of LP_CHAINS) {
        try {
          const positions = await fetchUniV3Positions(wallet.address, chain, alchemyKey)
          for (const pos of positions) {
            allPositions.push({
              wallet: wallet.address,
              walletLabel: wallet.label,
              chain,
              position: pos,
            })
          }
        } catch (err) {
          console.warn(`[lp] Failed ${chain}/${wallet.address.slice(0, 8)}:`, (err as Error).message)
        }
      }
    }

    if (allPositions.length === 0) {
      const data = { totalValueUsd: 0, positionCount: 0, positions: [] }
      cache.set(user.id, { data, timestamp: Date.now() })
      return NextResponse.json(data)
    }

    // Collect unique token addresses for price lookup
    const tokenAddresses = new Set<string>()
    const tokenChains = new Map<string, string>() // address → chain
    for (const { chain, position } of allPositions) {
      tokenAddresses.add(position.token0.toLowerCase())
      tokenAddresses.add(position.token1.toLowerCase())
      tokenChains.set(position.token0.toLowerCase(), chain)
      tokenChains.set(position.token1.toLowerCase(), chain)
    }

    // Fetch prices from DeFiLlama
    const priceInputs: TokenPriceInput[] = []
    for (const addr of tokenAddresses) {
      const chain = tokenChains.get(addr)
      const llamaChain = chain ? DEFILLAMA_CHAIN_MAP[chain as keyof typeof DEFILLAMA_CHAIN_MAP] : null
      if (llamaChain) {
        priceInputs.push({ chain: llamaChain, address: addr })
      }
    }

    const priceData = priceInputs.length > 0
      ? await getCurrentPrices(priceInputs, { userId: user.id })
      : { coins: {} }

    function getTokenPrice(chain: string, address: string): number | null {
      const llamaChain = DEFILLAMA_CHAIN_MAP[chain as keyof typeof DEFILLAMA_CHAIN_MAP]
      if (!llamaChain) return null
      const key = `${llamaChain}:${address.toLowerCase()}`
      return priceData.coins[key]?.price ?? null
    }

    function getTokenInfo(chain: string, address: string): { symbol: string | null; decimals: number } {
      const llamaChain = DEFILLAMA_CHAIN_MAP[chain as keyof typeof DEFILLAMA_CHAIN_MAP]
      if (!llamaChain) return { symbol: null, decimals: 18 }
      const key = `${llamaChain}:${address.toLowerCase()}`
      const coin = priceData.coins[key]
      return {
        symbol: coin?.symbol ?? null,
        decimals: coin?.decimals ?? 18,
      }
    }

    // Build enriched positions
    let totalValueUsd = 0
    const enrichedPositions = allPositions.map(({ wallet, walletLabel, chain, position }) => {
      const token0Info = getTokenInfo(chain, position.token0)
      const token1Info = getTokenInfo(chain, position.token1)
      const price0 = getTokenPrice(chain, position.token0)
      const price1 = getTokenPrice(chain, position.token1)

      const decimals0 = token0Info.decimals
      const decimals1 = token1Info.decimals

      // Convert raw amounts (BigInt strings) to human-readable
      const amount0 = parseFloat(position.amount0) / (10 ** decimals0)
      const amount1 = parseFloat(position.amount1) / (10 ** decimals1)

      const value0Usd = price0 != null ? amount0 * price0 : null
      const value1Usd = price1 != null ? amount1 * price1 : null
      const positionValueUsd = (value0Usd ?? 0) + (value1Usd ?? 0)

      // Calculate IL (estimate entry from tick range midpoint)
      let ilPercent: number | null = null
      if (price0 != null && price1 != null && price1 > 0) {
        const currentPrice = price0 / price1
        const priceLower = tickToPrice(position.tickLower, decimals0, decimals1)
        const priceUpper = tickToPrice(position.tickUpper, decimals0, decimals1)
        const entryPrice = estimateEntryPrice(position.tickLower, position.tickUpper, decimals0, decimals1)

        const il = calculateConcentratedIL(
          entryPrice, currentPrice, priceLower, priceUpper, positionValueUsd,
        )
        ilPercent = il.ilPercent
      }

      // Fee tier label
      const feeLabel = position.fee === 100 ? "0.01%" :
        position.fee === 500 ? "0.05%" :
        position.fee === 3000 ? "0.3%" :
        position.fee === 10000 ? "1%" :
        `${position.fee / 10000}%`

      totalValueUsd += positionValueUsd

      return {
        tokenId: position.tokenId,
        chain,
        wallet,
        walletLabel,
        token0: {
          address: position.token0,
          symbol: token0Info.symbol,
          amount: amount0,
          valueUsd: value0Usd,
          priceUsd: price0,
        },
        token1: {
          address: position.token1,
          symbol: token1Info.symbol,
          amount: amount1,
          valueUsd: value1Usd,
          priceUsd: price1,
        },
        feeTier: feeLabel,
        feeRaw: position.fee,
        totalValueUsd: positionValueUsd,
        inRange: position.inRange,
        ilPercent,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        currentTick: position.currentTick,
      }
    })

    // Sort by value descending
    enrichedPositions.sort((a, b) => b.totalValueUsd - a.totalValueUsd)

    const data = {
      totalValueUsd,
      positionCount: enrichedPositions.length,
      inRangeCount: enrichedPositions.filter((p) => p.inRange).length,
      outOfRangeCount: enrichedPositions.filter((p) => !p.inRange).length,
      positions: enrichedPositions,
    }

    cache.set(user.id, { data, timestamp: Date.now() })
    return NextResponse.json(data)
  } catch (error) {
    return apiError("E9071", "Failed to fetch LP positions", 500, error)
  }
}
