import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { buildStakingResponse } from "@/lib/portfolio/staking/route-helpers"
export { buildStakingResponse } from "@/lib/portfolio/staking/route-helpers"
import { getRefreshMeta, queuePortfolioRefresh, runPortfolioRefreshJob } from "@/lib/portfolio/refresh-orchestrator"
import { isProviderThrottleError } from "@/lib/portfolio/provider-governor"
import { resetStakingLifecycleData } from "@/lib/portfolio/staking-lifecycle"
import { db } from "@/lib/db"

export const maxDuration = 60

// LRU-bounded response cache with stale-while-revalidate
const cache = new Map<string, { data: object; timestamp: number }>()
const CACHE_FRESH_MS = 2 * 60_000   // serve without revalidation
const CACHE_STALE_MS = 30 * 60_000  // serve stale + revalidate in background
const MAX_CACHE_SIZE = 100
const revalidating = new Set<string>()

export function invalidateStakingResponseCache(userId?: string): void {
  if (userId) { cache.delete(userId); return }
  cache.clear()
}

function cacheGet(key: string): { data: object; timestamp: number } | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  cache.delete(key)
  cache.set(key, entry)
  return entry
}

function cacheSet(key: string, data: object): void {
  cache.delete(key)
  cache.set(key, { data, timestamp: Date.now() })
  if (cache.size > MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

/** GET /api/portfolio/staking — fetch staking positions (stale-while-revalidate) */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9060", "Authentication required", 401)

  const cached = cacheGet(user.id)
  const age = cached ? Date.now() - cached.timestamp : Infinity

  // Fresh cache — return immediately
  if (cached && age < CACHE_FRESH_MS) {
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...cached.data, meta: { fromCache: true, ...refreshMeta } })
  }

  // Stale cache — return stale data instantly, revalidate in background
  if (cached && age < CACHE_STALE_MS) {
    if (!revalidating.has(user.id)) {
      revalidating.add(user.id)
      buildStakingResponse(user.id)
        .then((data) => cacheSet(user.id, data))
        .catch((err) => console.warn("[staking] Background revalidation failed:", err))
        .finally(() => revalidating.delete(user.id))
    }
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...cached.data, meta: { fromCache: true, revalidating: true, ...refreshMeta } })
  }

  // No cache — blocking fetch with timeout (first request only)
  try {
    const STAKING_TIMEOUT_MS = 45_000
    const data = await Promise.race([
      buildStakingResponse(user.id),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Staking build timed out")), STAKING_TIMEOUT_MS),
      ),
    ])
    cacheSet(user.id, data)
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...data, meta: { fromCache: false, ...refreshMeta } })
  } catch (error) {
    if (isProviderThrottleError(error)) {
      if (cached) {
        const refreshMeta = await getRefreshMeta(user.id)
        return NextResponse.json({ ...cached.data, meta: { fromCache: true, throttled: true, ...refreshMeta } })
      }
      const retryAfter = error.nextAllowedAt
        ? Math.max(1, Math.ceil((error.nextAllowedAt.getTime() - Date.now()) / 1000))
        : 30
      return apiError("E9062", `Provider busy — retry in ${retryAfter}s`, 429, error)
    }
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("Invalid Zerion API key")) {
      return apiError("E9061", "Invalid Zerion API key — update it in Portfolio Settings.", 401, error)
    }
    if (msg.includes("rate limit")) {
      return apiError("E9062", msg, 429, error)
    }
    return apiError("E9063", "Failed to fetch staking positions", 500, error)
  }
}

/** POST /api/portfolio/staking — queue shared refresh and return staking read-model */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9064", "Authentication required", 401)

  // Rebuild action: reset all staking lifecycle data and recompute from scratch
  const url = new URL(request.url)
  if (url.searchParams.get("action") === "rebuild") {
    try {
      const reset = await resetStakingLifecycleData(user.id)
      // Clear rebuild_running BEFORE build so positions get real yieldMetricsState
      await db.stakingSyncState.update({
        where: { userId: user.id },
        data: { status: "backfill_done" },
      })
      invalidateStakingResponseCache(user.id)
      const data = await buildStakingResponse(user.id)
      cacheSet(user.id, data)
      return NextResponse.json({
        ...data,
        rebuild: { ok: true, deletedPositions: reset.deletedPositions, deletedSnapshots: reset.deletedSnapshots },
      })
    } catch (error) {
      return apiError("E9065", "Staking rebuild failed", 500, error)
    }
  }

  try {
    const refresh = await queuePortfolioRefresh(user.id, { reason: "manual_refresh:staking" })
    if (refresh.queued && refresh.jobId) {
      runPortfolioRefreshJob(refresh.jobId).catch((error) => {
        console.warn("[staking] Async refresh job failed:", error)
      })
    }

    const cached = cacheGet(user.id)
    let data: object
    let fromCache = false

    if (cached) {
      data = cached.data
      fromCache = true
    } else {
      data = await buildStakingResponse(user.id)
      cacheSet(user.id, data)
    }

    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({
      ...data,
      refresh,
      meta: { fromCache, refreshed: false, ...refreshMeta },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return apiError("E9063", `Refresh failed: ${msg}`, 500, error)
  }
}
