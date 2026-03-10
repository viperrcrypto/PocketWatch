import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getAllExchangeCredentials } from "@/lib/portfolio/service-keys"
import { fetchAllExchangeBalances, type AllExchangeBalancesResult } from "@/lib/portfolio/exchange-client"
import { getRefreshMeta, queuePortfolioRefresh, runPortfolioRefreshJob } from "@/lib/portfolio/refresh-orchestrator"

export const maxDuration = 60

// In-memory cache per user (survives between requests in same worker)
const cache = new Map<string, { data: AllExchangeBalancesResult; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60_000 // 5 minutes

async function buildExchangeBalancesResponse(userId: string): Promise<AllExchangeBalancesResult> {
  const exchangeCreds = await getAllExchangeCredentials(userId)

  if (exchangeCreds.length === 0) {
    return { balances: [], exchanges: [], totalValue: 0 }
  }

  console.log(`[exchange-balances] Fetching ${exchangeCreds.length} exchange(s) for user ${userId}`)

  const result = await fetchAllExchangeBalances(exchangeCreds, userId)

  console.log(
    `[exchange-balances] Got ${result.balances.length} assets across ${result.exchanges.length} exchange(s), total: $${result.totalValue.toFixed(2)}`
  )

  return result
}

/** GET /api/portfolio/balances/exchange — fetch exchange balances (cached) */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9060", "Authentication required", 401)

  // Serve from cache if fresh
  const cached = cache.get(user.id)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...cached.data, meta: { fromCache: true, ...refreshMeta } })
  }

  try {
    const data = await buildExchangeBalancesResponse(user.id)
    cache.set(user.id, { data, timestamp: Date.now() })
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...data, meta: { fromCache: false, ...refreshMeta } })
  } catch (error) {
    return apiError("E9061", "Failed to fetch exchange balances", 500, error)
  }
}

/** POST /api/portfolio/balances/exchange — queue shared refresh and return cached exchange view */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9062", "Authentication required", 401)

  try {
    const refresh = await queuePortfolioRefresh(user.id, { reason: "manual_refresh:exchange" })
    if (refresh.queued && refresh.jobId) {
      runPortfolioRefreshJob(refresh.jobId).catch((error) => {
        console.warn("[balances/exchange] Async refresh job failed:", error)
      })
    }

    const cached = cache.get(user.id)
    let data: AllExchangeBalancesResult
    let fromCache = false

    if (cached) {
      data = cached.data
      fromCache = true
    } else {
      data = await buildExchangeBalancesResponse(user.id)
      cache.set(user.id, { data, timestamp: Date.now() })
    }

    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({
      ...data,
      refresh,
      meta: {
        fromCache,
        refreshed: false,
        ...refreshMeta,
      },
    })
  } catch (error) {
    return apiError("E9063", "Failed to refresh exchange balances", 500, error)
  }
}
