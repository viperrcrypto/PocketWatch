import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { getCachedWalletPositions } from "@/lib/portfolio/zerion-cache"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import { getRefreshMeta, queuePortfolioRefresh, runPortfolioRefreshJob } from "@/lib/portfolio/refresh-orchestrator"

export const maxDuration = 60

const cache = new Map<string, { data: object; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60_000

/** Shared builder: fetches Zerion positions and builds the per-account response */
async function buildBlockchainBalancesResponse(userId: string, chainFilter: string | null) {
  const [apiKey, wallets] = await Promise.all([
    getServiceKey(userId, "zerion"),
    db.trackedWallet.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ])

  if (!apiKey) {
    return { error: "no_api_key", per_account: {}, icons: {}, totals: { assets: {} } }
  }

  if (wallets.length === 0) {
    return { per_account: {}, icons: {}, totals: { assets: {} } }
  }

  const { wallets: walletData } = await getCachedWalletPositions(userId, apiKey, wallets.map((w) => w.address))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perAccount: Record<string, Record<string, { assets: Record<string, any> }>> = {}
  const icons: Record<string, string> = {}
  const totalsAssets: Record<string, { amount: string; usd_value: string }> = {}

  for (const wallet of walletData) {
    for (const pos of wallet.positions) {
      const chain = pos.chain
      if (chainFilter && chain !== chainFilter) continue

      if (!perAccount[chain]) perAccount[chain] = {}
      if (!perAccount[chain][wallet.address]) perAccount[chain][wallet.address] = { assets: {} }

      const symbol = pos.symbol || pos.id
      perAccount[chain][wallet.address].assets[symbol] = {
        amount: String(pos.quantity),
        usd_value: String(pos.value),
        value: String(pos.value),
      }

      if (!totalsAssets[symbol]) {
        totalsAssets[symbol] = { amount: "0", usd_value: "0" }
      }
      totalsAssets[symbol].amount = String(
        parseFloat(totalsAssets[symbol].amount) + pos.quantity
      )
      totalsAssets[symbol].usd_value = String(
        parseFloat(totalsAssets[symbol].usd_value) + pos.value
      )

      if (pos.iconUrl && !icons[symbol]) icons[symbol] = pos.iconUrl
    }
  }

  return { per_account: perAccount, icons, totals: { assets: totalsAssets } }
}

/**
 * GET /api/portfolio/balances/blockchain
 * Returns per-account, per-chain breakdown in the format:
 * { per_account: { chainId: { "0xaddr": { assets: { symbol: { amount, usd_value } } } } }, icons: {...} }
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9050", "Authentication required", 401)

  const chainFilter = request.nextUrl.searchParams.get("chain")
  const cacheKey = `${user.id}:${chainFilter ?? "all"}`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...cached.data, meta: { fromCache: true, ...refreshMeta } })
  }

  try {
    const result = await buildBlockchainBalancesResponse(user.id, chainFilter)
    cache.set(cacheKey, { data: result, timestamp: Date.now() })
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...result, meta: { fromCache: false, ...refreshMeta } })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("Invalid Zerion API key")) {
      return apiError("E9051", "Invalid Zerion API key — update it in Portfolio Settings.", 401, error)
    }
    return apiError("E9052", "Failed to fetch blockchain balances", 500, error)
  }
}

/**
 * POST /api/portfolio/balances/blockchain
 * Queues a shared refresh job and returns the current blockchain read-model.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9053", "Authentication required", 401)

  try {
    const refresh = await queuePortfolioRefresh(user.id, { reason: "manual_refresh:blockchain" })
    if (refresh.queued && refresh.jobId) {
      runPortfolioRefreshJob(refresh.jobId).catch((error) => {
        console.warn("[balances/blockchain] Async refresh job failed:", error)
      })
    }

    const chainFilter = request.nextUrl.searchParams.get("chain")
    const cacheKey = `${user.id}:${chainFilter ?? "all"}`
    const cached = cache.get(cacheKey)
    let result: object
    let fromCache = false

    if (cached) {
      result = cached.data
      fromCache = true
    } else {
      result = await buildBlockchainBalancesResponse(user.id, chainFilter)
      cache.set(cacheKey, { data: result, timestamp: Date.now() })
    }

    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({
      ...result,
      refresh,
      meta: {
        fromCache,
        refreshed: false,
        ...refreshMeta,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("Invalid Zerion API key")) {
      return apiError("E9054", "Invalid Zerion API key", 401, error)
    }
    return apiError("E9055", "Failed to refresh blockchain balances", 500, error)
  }
}
