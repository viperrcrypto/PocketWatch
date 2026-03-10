import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import { getNFTPortfolioAllChains, setAlchemyKey, type NFTCollection } from "@/lib/alchemy-nft"
import { fetchNativeTokenPrices } from "@/lib/tracker/chains"
import type { Prisma } from "@/generated/prisma/client"

export const maxDuration = 30

const SPAM_THRESHOLD = 50

// In-memory cache per user
const cache = new Map<string, { data: object; timestamp: number }>()
const CACHE_TTL_MS = 15 * 60_000 // 15 minutes

/** Read nftOverrides from portfolioSetting JSON */
async function getNFTOverrides(userId: string): Promise<Record<string, "show" | "hide">> {
  const setting = await db.portfolioSetting.findUnique({
    where: { userId },
    select: { settings: true },
  })
  if (!setting?.settings || typeof setting.settings !== "object") return {}
  const overrides = (setting.settings as Record<string, unknown>).nftOverrides
  if (!overrides || typeof overrides !== "object") return {}
  return overrides as Record<string, "show" | "hide">
}

/** GET /api/portfolio/balances/nfts — fetch NFT holdings with spam separation */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9060", "Authentication required", 401)

  // Serve from cache if fresh
  const cached = cache.get(user.id)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data)
  }

  try {
    const [alchemyKey, wallets, overrides] = await Promise.all([
      getServiceKey(user.id, "alchemy"),
      db.trackedWallet.findMany({
        where: { userId: user.id },
        select: { address: true, label: true },
      }),
      getNFTOverrides(user.id),
    ])

    if (!alchemyKey) {
      return NextResponse.json({
        totalValueUsd: 0,
        collections: [],
        spamCollections: [],
        wallets: [],
        nftCount: 0,
        collectionCount: 0,
        spamCount: 0,
        message: "No Alchemy API key configured. Add it in Portfolio Settings to see NFT valuations.",
      })
    }

    // Set runtime key for Alchemy NFT calls
    setAlchemyKey(alchemyKey)

    // Get native token prices for floor price conversion per chain
    const nativePrices = await fetchNativeTokenPrices().catch(() => new Map<string, number>())

    // Filter to EVM wallets only (NFT APIs don't support Solana addresses)
    const evmWallets = wallets.filter((w) => w.address.startsWith("0x"))

    // Fetch NFTs per wallet across all chains in parallel
    const walletResults = await Promise.all(
      evmWallets.map(async (wallet) => {
        const portfolio = await getNFTPortfolioAllChains(wallet.address, nativePrices)
        return {
          address: wallet.address,
          label: wallet.label,
          ...portfolio,
        }
      })
    )

    // Merge collections across wallets
    const mergedCollections = new Map<string, NFTCollection & { wallets: string[] }>()

    for (const wallet of walletResults) {
      for (const col of wallet.collections) {
        const key = `${col.contractAddress}:${col.chain}`
        const existing = mergedCollections.get(key)
        if (existing) {
          existing.totalBalance += col.totalBalance
          existing.tokenIds.push(...col.tokenIds)
          existing.nfts.push(...col.nfts)
          existing.wallets.push(wallet.address)
        } else {
          mergedCollections.set(key, { ...col, wallets: [wallet.address] })
        }
      }
    }

    // Split into verified vs spam, respecting user overrides
    const verified: Array<NFTCollection & { wallets: string[] }> = []
    const spam: Array<NFTCollection & { wallets: string[] }> = []

    for (const col of mergedCollections.values()) {
      const override = overrides[col.contractAddress]
      if (override === "show") {
        verified.push(col)
      } else if (override === "hide") {
        spam.push(col)
      } else if (col.spamScore >= SPAM_THRESHOLD) {
        spam.push(col)
      } else {
        verified.push(col)
      }
    }

    verified.sort((a, b) => (b.floorPriceUsd ?? 0) * b.totalBalance - (a.floorPriceUsd ?? 0) * a.totalBalance)
    spam.sort((a, b) => (b.floorPriceUsd ?? 0) * b.totalBalance - (a.floorPriceUsd ?? 0) * a.totalBalance)

    const verifiedValueUsd = verified.reduce(
      (sum, c) => sum + (c.floorPriceUsd ?? 0) * c.totalBalance,
      0
    )

    const data = {
      totalValueUsd: verifiedValueUsd,
      collections: verified,
      spamCollections: spam,
      nftCount: verified.reduce((sum, c) => sum + c.totalBalance, 0),
      collectionCount: verified.length,
      spamCount: spam.reduce((sum, c) => sum + c.totalBalance, 0),
      wallets: walletResults.map((w) => ({
        address: w.address,
        label: w.label,
        totalValueUsd: w.totalValueUsd,
        collectionCount: w.collections.length,
      })),
    }

    cache.set(user.id, { data, timestamp: Date.now() })
    return NextResponse.json(data)
  } catch (error) {
    return apiError("E9061", "Failed to fetch NFT portfolio", 500, error)
  }
}

/** PATCH /api/portfolio/balances/nfts — update a collection spam override */
export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9060", "Authentication required", 401)

  try {
    const body = await request.json()
    const { contractAddress, action } = body as {
      contractAddress?: string
      action?: "show" | "hide" | "reset"
    }

    if (!contractAddress || typeof contractAddress !== "string") {
      return apiError("E9062", "contractAddress is required", 400)
    }
    if (!action || !["show", "hide", "reset"].includes(action)) {
      return apiError("E9063", "action must be 'show', 'hide', or 'reset'", 400)
    }

    const existing = await db.portfolioSetting.findUnique({
      where: { userId: user.id },
      select: { settings: true },
    })

    const settings = (existing?.settings && typeof existing.settings === "object"
      ? { ...(existing.settings as Record<string, unknown>) }
      : {}) as Record<string, unknown>

    const overrides = (settings.nftOverrides && typeof settings.nftOverrides === "object"
      ? { ...(settings.nftOverrides as Record<string, string>) }
      : {}) as Record<string, string>

    const addr = contractAddress.toLowerCase()
    if (action === "reset") {
      delete overrides[addr]
    } else {
      overrides[addr] = action
    }

    const updatedSettings = { ...settings, nftOverrides: overrides }

    await db.portfolioSetting.upsert({
      where: { userId: user.id },
      create: { userId: user.id, settings: updatedSettings as Prisma.InputJsonValue },
      update: { settings: updatedSettings as Prisma.InputJsonValue },
    })

    // Bust in-memory cache so next GET reflects the change
    cache.delete(user.id)

    return NextResponse.json({ success: true, contractAddress: addr, action })
  } catch (error) {
    return apiError("E9064", "Failed to update NFT override", 500, error)
  }
}
