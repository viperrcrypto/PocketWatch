/**
 * Snapshot Worker — creates periodic position-inclusive portfolio snapshots.
 *
 * POST /api/internal/snapshot-worker
 *
 * Triggers a full portfolio refresh that captures wallet + DeFi + staking +
 * exchange positions atomically into a PortfolioSnapshot record.
 *
 * Protected by SNAPSHOT_WORKER_SECRET env var.
 * Trigger via system cron, curl, or a "Take Snapshot" button in settings.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { queuePortfolioRefresh, runPortfolioRefreshJob } from "@/lib/portfolio/refresh-orchestrator"

export const maxDuration = 300

const WORKER_SECRET = process.env.SNAPSHOT_WORKER_SECRET ?? ""

function isAuthorized(request: NextRequest): boolean {
  if (!WORKER_SECRET) return false
  const auth = request.headers.get("authorization") ?? ""
  return auth === `Bearer ${WORKER_SECRET}`
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Find all users with tracked wallets
    const usersWithWallets = await db.user.findMany({
      where: {
        trackedWallets: { some: {} },
      },
      select: { id: true },
    })

    if (usersWithWallets.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users with tracked wallets",
        snapshots: 0,
      })
    }

    const results: Array<{
      userId: string
      status: string
      totalValue?: number
      error?: string
    }> = []

    for (const user of usersWithWallets) {
      try {
        const queueResult = await queuePortfolioRefresh(user.id, {
          reason: "scheduled_snapshot",
        })

        if (!queueResult.jobId) {
          results.push({
            userId: user.id,
            // username omitted for privacy
            status: "skipped",
            error: queueResult.reason,
          })
          continue
        }

        if (queueResult.queued) {
          const runResult = await runPortfolioRefreshJob(queueResult.jobId)
          results.push({
            userId: user.id,
            status: runResult.status,
            totalValue: runResult.totalValue,
          })
        } else {
          results.push({
            userId: user.id,
            status: "already_running",
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[snapshot-worker] Failed for user ${user.id}:`, message)
        results.push({
          userId: user.id,
          status: "failed",
          error: message,
        })
      }
    }

    const completed = results.filter((r) => r.status === "completed").length

    console.log(
      `[snapshot-worker] Completed: ${completed}/${results.length} users`
    )

    return NextResponse.json({
      success: true,
      processed: results.length,
      completed,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[snapshot-worker] Worker failed:", message)
    return NextResponse.json(
      { error: "Snapshot worker failed", details: message },
      { status: 500 }
    )
  }
}

/** GET — health check / status */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Report last snapshot times per user
  const latestSnapshots = await db.portfolioSnapshot.groupBy({
    by: ["userId"],
    where: { source: "live_refresh" },
    _max: { createdAt: true },
    _count: { id: true },
  })

  return NextResponse.json({
    status: "ok",
    users: latestSnapshots.map((row) => ({
      userId: row.userId,
      lastSnapshot: row._max.createdAt?.toISOString() ?? null,
      totalSnapshots: row._count.id,
    })),
  })
}
