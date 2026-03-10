import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  buildStakingResponse,
  invalidateStakingResponseCache,
} from "@/app/api/portfolio/staking/route"
import { resetStakingLifecycleData } from "@/lib/portfolio/staking-lifecycle"

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
 * POST /api/internal/staking/rebuild
 * Secret-protected lifecycle rebuild for one user or all tracked-wallet users.
 *
 * Body:
 *  - userId?: string (optional target user)
 *  - dryRun?: boolean
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { userId?: string; dryRun?: boolean }
  const dryRun = body?.dryRun === true

  let targetUserIds: string[] = []
  if (body?.userId) {
    targetUserIds = [body.userId]
  } else {
    const userRows = await db.trackedWallet.findMany({
      select: { userId: true },
      distinct: ["userId"],
      orderBy: { userId: "asc" },
    })
    targetUserIds = userRows.map((row) => row.userId)
  }

  const results: Array<{
    userId: string
    ok: boolean
    deletedPositions?: number
    deletedSnapshots?: number
    lifecycleStatus?: string | null
    error?: string
  }> = []

  for (const userId of targetUserIds) {
    try {
      if (dryRun) {
        results.push({ userId, ok: true })
        continue
      }

      const reset = await resetStakingLifecycleData(userId)
      invalidateStakingResponseCache(userId)

      await buildStakingResponse(userId)

      const syncState = await db.stakingSyncState.findUnique({
        where: { userId },
        select: { status: true },
      })

      results.push({
        userId,
        ok: true,
        deletedPositions: reset.deletedPositions,
        deletedSnapshots: reset.deletedSnapshots,
        lifecycleStatus: syncState?.status ?? null,
      })
    } catch (error) {
      results.push({
        userId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    dryRun,
    results,
    ranAt: new Date().toISOString(),
  })
}
