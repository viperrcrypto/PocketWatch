import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { runHistorySyncWorker, isIncrementalSyncStale, scheduleIncrementalSync, getSyncProgress } from "@/lib/portfolio/transaction-fetcher"
import { reconstructPortfolioHistory } from "@/lib/portfolio/value-reconstructor"
import { invalidateStakingResponseCache } from "@/app/api/portfolio/staking/route"
import { recoverOrphanedJobs, checkSyncGaps, healSyncGaps } from "@/lib/portfolio/sync-recovery"

export const maxDuration = 300

const RECONSTRUCTION_TIMEOUT_MS = 30_000

function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ])
}

function isAuthorized(request: NextRequest | Request): boolean {
  const secret = process.env.HISTORY_CRON_SECRET
  // Vercel auto-generates CRON_SECRET and attaches it as Bearer on cron invocations
  const vercelCronSecret = process.env.CRON_SECRET

  const headerSecret = request.headers.get("x-history-cron-secret")
  if (secret && headerSecret === secret) return true

  const auth = request.headers.get("authorization")
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim()
    if (secret && token === secret) return true
    if (vercelCronSecret && token === vercelCronSecret) return true
  }

  return false
}

/**
 * POST /api/internal/history/sync-worker
 * Secret-protected background worker for latest-first history sync jobs.
 *
 * Query params:
 *  - cursor: user offset cursor (default 0)
 *  - limit: max users to process per invocation (default 25, max 100)
 *  - reconstruct: "1" to run portfolio reconstruction after completed/partial jobs (default on)
 */
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest | Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const cursor = Math.max(0, parseInt(url.searchParams.get("cursor") ?? "0", 10) || 0)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "25", 10) || 25))
  const doReconstruct = url.searchParams.get("reconstruct") !== "0"

  console.log(`[sync-worker] invoked at ${new Date().toISOString()} cursor=${cursor} limit=${limit}`)

  // Recover any jobs orphaned by a server restart before processing
  const recovered = await recoverOrphanedJobs()
  const totalRecovered = (recovered.historySyncRecovered ?? 0) + (recovered.refreshRecovered ?? 0)
  if (totalRecovered > 0) console.log(`[sync-worker] recovered ${totalRecovered} orphaned jobs (history=${recovered.historySyncRecovered} refresh=${recovered.refreshRecovered})`)

  const activeJobRows = await db.historySyncJob.findMany({
    where: { status: { in: ["queued", "running"] } },
    select: { userId: true },
    distinct: ["userId"],
    orderBy: { userId: "asc" },
  })

  const userIds = activeJobRows.map((r) => r.userId)
  const batch = userIds.slice(cursor, cursor + limit)

  const results: Array<{
    userId: string
    ok: boolean
    status?: string
    insertedTxCount?: number
    processedSyncs?: number
    failedSyncs?: number
    reconstruction?: { snapshotsCreated: number; priceResolution: { resolved: number; failed: number; total: number } }
    gapsHealed?: number
    error?: string
  }> = []

  for (const userId of batch) {
    try {
      const run = await runHistorySyncWorker(userId, {
        maxSyncsPerRun: 8,
        maxRequestsPerSync: 10,
        maxMsPerSync: 10_000,
      })

      let reconstruction: { snapshotsCreated: number; priceResolution: { resolved: number; failed: number; total: number } } | undefined
      if (doReconstruct && run && (run.status === "completed" || run.status === "partial")) {
        try {
          reconstruction = await withTimeout(
            () => reconstructPortfolioHistory(userId),
            RECONSTRUCTION_TIMEOUT_MS
          )
          invalidateStakingResponseCache(userId)
        } catch (err) {
          console.error(`[sync-worker] Reconstruction failed/timed out for ${userId}:`, err)
        }
      }

      // Gap check: spot-check completed syncs for missing block ranges
      let gapsHealed = 0
      if (run && (run.status === "completed" || run.status === "partial")) {
        try {
          const progress = await getSyncProgress(userId)
          const completedStates = progress.filter((s) => s.isComplete && s.chain !== "SOLANA")
          for (const s of completedStates) {
            const gaps = await checkSyncGaps(userId, s.walletAddress, s.chain)
            if (gaps.length > 0) {
              const healed = await healSyncGaps(userId, s.walletAddress, s.chain, gaps)
              if (healed) gapsHealed++
            }
          }
        } catch (err) {
          console.error(`[sync-worker] Gap check failed for ${userId}:`, err)
        }
      }

      // Auto-schedule incremental sync if historical is done and data is stale
      const noActiveJob = !run || run.status === "completed" || run.status === "partial"
      let scheduledIncremental: { jobId: string; status: string } | null = null
      if (noActiveJob && gapsHealed === 0) {
        const stale = await isIncrementalSyncStale(userId)
        if (stale) {
          scheduledIncremental = await scheduleIncrementalSync(userId)
        }
      }

      results.push({
        userId,
        ok: true,
        status: run?.status ?? "idle",
        insertedTxCount: run?.insertedTxCount ?? 0,
        processedSyncs: run?.processedSyncs ?? 0,
        failedSyncs: run?.failedSyncs ?? 0,
        reconstruction,
        ...(gapsHealed > 0 ? { gapsHealed } : {}),
        ...(scheduledIncremental ? { scheduledIncremental } : {}),
      })
    } catch (error) {
      results.push({
        userId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const nextCursor = cursor + limit < userIds.length ? cursor + limit : null

  return NextResponse.json({
    processed: batch.length,
    totalUsers: userIds.length,
    cursor,
    nextCursor,
    limit,
    finished: nextCursor === null,
    recovered,
    results,
    ranAt: new Date().toISOString(),
  })
}
