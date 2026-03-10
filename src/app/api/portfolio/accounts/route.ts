import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import { ensureSyncStatesForUser, startOrResumeHistorySyncJob } from "@/lib/portfolio/transaction-fetcher"

// Map stored chain shorthand to Zerion chain IDs for the frontend response
// (frontend expects chain keys like "ethereum", "polygon", etc.)
const CHAIN_ID_MAP: Record<string, string> = {
  ETH: "ethereum",
  ETHEREUM: "ethereum",
  POLYGON: "polygon",
  POLYGON_POS: "polygon",
  ARBITRUM: "arbitrum",
  ARBITRUM_ONE: "arbitrum",
  OPTIMISM: "optimism",
  BASE: "base",
  AVAX: "avalanche",
  AVALANCHE: "avalanche",
  BSC: "binance-smart-chain",
  GNOSIS: "gnosis",
  SOL: "solana",
  SOLANA: "solana",
  BTC: "bitcoin",
  BITCOIN: "bitcoin",
  LINEA: "linea",
  SCROLL: "scroll",
  ZKSYNC: "zksync-era",
  BLAST: "blast",
  MANTLE: "mantle",
  BERACHAIN: "berachain",
}

const DEFAULT_EVM_CHAINS = ["ethereum", "polygon", "arbitrum", "optimism", "base", "avalanche"]

/** Convert stored chain names to Zerion chain IDs */
function toChainIds(chains: string[]): string[] {
  if (!chains || chains.length === 0) return DEFAULT_EVM_CHAINS
  const mapped = chains.map((c) => CHAIN_ID_MAP[c.toUpperCase()] || c.toLowerCase())
  return [...new Set(mapped)]
}

/** GET /api/portfolio/accounts — list tracked wallets */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9030", "Authentication required", 401)

  try {
    const wallets = await db.trackedWallet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    })

    // Build per-chain map: { "ethereum": [{ address, label }], ... }
    const perChain: Record<string, { address: string; label: string }[]> = {}

    for (const wallet of wallets) {
      const chainIds = toChainIds(wallet.chains)
      for (const chainId of chainIds) {
        if (!perChain[chainId]) perChain[chainId] = []
        // Avoid duplicate entries per chain
        if (!perChain[chainId].some((w) => w.address === wallet.address)) {
          perChain[chainId].push({
            address: wallet.address,
            label: wallet.label ?? wallet.address.slice(0, 8),
          })
        }
      }
    }

    return NextResponse.json(perChain)
  } catch (error) {
    return apiError("E9031", "Failed to load accounts", 500, error)
  }
}

/** POST /api/portfolio/accounts — add a tracked wallet */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9032", "Authentication required", 401)

  try {
    const body = await request.json()
    const { address, label, chains } = body

    if (!address || typeof address !== "string") {
      return apiError("E9033", "address is required", 400)
    }

    const normalizedAddress = address.trim()
    const chainList: string[] = Array.isArray(chains) ? chains : []

    await db.trackedWallet.upsert({
      where: { userId_address: { userId: user.id, address: normalizedAddress } },
      create: {
        userId: user.id,
        address: normalizedAddress,
        label: label || null,
        chains: chainList,
      },
      update: {
        label: label || undefined,
        chains: chainList,
      },
    })

    // Queue a proper history sync job for the new wallet
    getServiceKey(user.id, "alchemy")
      .then(async (alchemyKey) => {
        if (!alchemyKey) return
        await ensureSyncStatesForUser(user.id)
        await startOrResumeHistorySyncJob(user.id)
        console.log(`[accounts] Queued history sync job for new wallet ${normalizedAddress}`)
      })
      .catch((e) => console.warn(`[accounts] Failed to queue sync job:`, e))

    return NextResponse.json({ success: true, address: normalizedAddress })
  } catch (error) {
    return apiError("E9034", "Failed to add account", 500, error)
  }
}

/** PATCH /api/portfolio/accounts — update a tracked wallet (label and/or chains) */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9038", "Authentication required", 401)

  try {
    const body = await request.json()
    const { address, label, chains } = body

    if (!address || typeof address !== "string") {
      return apiError("E9039", "address is required", 400)
    }

    const data: Record<string, unknown> = {}

    if (label !== undefined) {
      data.label = typeof label === "string" && label.trim() !== "" ? label.trim() : null
    }

    if (Array.isArray(chains) && chains.every((c: unknown) => typeof c === "string")) {
      data.chains = chains
    }

    if (Object.keys(data).length === 0) {
      return apiError("E9041", "No fields to update", 400)
    }

    await db.trackedWallet.updateMany({
      where: { userId: user.id, address: address.trim() },
      data,
    })

    return NextResponse.json({ success: true, address: address.trim(), ...data })
  } catch (error) {
    return apiError("E9040", "Failed to update account", 500, error)
  }
}

/** DELETE /api/portfolio/accounts — remove a tracked wallet */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9035", "Authentication required", 401)

  try {
    const body = await request.json()
    const { address } = body

    if (!address || typeof address !== "string") {
      return apiError("E9036", "address is required", 400)
    }

    await db.trackedWallet.deleteMany({
      where: { userId: user.id, address: address.trim() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E9037", "Failed to remove account", 500, error)
  }
}
