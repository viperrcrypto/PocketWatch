import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { buildStakingResponse } from "@/app/api/portfolio/staking/route"
import { runFrozenIntegritySweep } from "@/lib/portfolio/staking-lifecycle"

export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.STAKING_CRON_SECRET
  if (!secret) return false

  const headerSecret = request.headers.get("x-staking-cron-secret")
  if (headerSecret && headerSecret === secret) return true

  const auth = request.headers.get("authorization")
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() === secret
  }

  return false
}

/**
 * POST /api/internal/staking/snapshot-hourly
 * Protected internal endpoint for hourly staking snapshot ingestion.
 *
 * Query params:
 *  - cursor: user offset cursor (integer)
 *  - limit: number of users to process in this invocation (default 25)
 *  - audit: "1" to force frozen-position weekly integrity sweep
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const cursor = Math.max(0, parseInt(url.searchParams.get("cursor") ?? "0", 10) || 0)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "25", 10) || 25))
  const forceAudit = url.searchParams.get("audit") === "1"

  const userRows = await db.trackedWallet.findMany({
    select: { userId: true },
    distinct: ["userId"],
    orderBy: { userId: "asc" },
  })

  const userIds = userRows.map((r) => r.userId)
  const batch = userIds.slice(cursor, cursor + limit)

  const results: Array<{ userId: string; ok: boolean; error?: string; auditReopened?: number }> = []

  const now = new Date()
  const isWeeklyWindow = now.getUTCDay() === 0 && now.getUTCHours() < 2

  for (const userId of batch) {
    try {
      await buildStakingResponse(userId)

      let auditReopened = 0
      if (forceAudit || isWeeklyWindow) {
        try {
          const audit = await runFrozenIntegritySweep(userId)
          auditReopened = audit.reopened
        } catch (err) {
          console.warn(`[staking-cron] Weekly audit failed for user ${userId}:`, err)
        }
      }

      results.push({ userId, ok: true, auditReopened })
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
    weeklyAuditRan: forceAudit || isWeeklyWindow,
    results,
    finished: nextCursor === null,
    ranAt: new Date().toISOString(),
  })
}
