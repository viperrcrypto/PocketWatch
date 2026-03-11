/**
 * Transaction Classification Job.
 *
 * POST /api/internal/classify-transactions
 *
 * Batch-classifies unclassified transactions for all users.
 * Idempotent — skips already-classified rows.
 *
 * Query params:
 *   - userId: optional, classify only for specific user
 *   - reclassify: "true" to reclassify all (clears existing classifications first)
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { classifyUserTransactions, reclassifyAllTransactions } from "@/lib/portfolio/transaction-classifier"

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

  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get("userId")
  const reclassify = searchParams.get("reclassify") === "true"

  // Reclassify is destructive — require explicit userId to prevent accidental bulk wipes
  if (reclassify && !targetUserId) {
    return NextResponse.json(
      { error: "reclassify requires a userId parameter" },
      { status: 400 }
    )
  }

  try {
    let users: Array<{ id: string }>

    if (targetUserId) {
      const user = await db.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      })
      users = user ? [user] : []
    } else {
      // Find all users with unclassified transactions
      const userIds = await db.transactionCache.groupBy({
        by: ["userId"],
        where: { txClassification: null },
      })
      users = await db.user.findMany({
        where: { id: { in: userIds.map((u) => u.userId) } },
        select: { id: true },
      })
    }

    const results: Array<{
      userId: string
      classified: number
      error?: string
    }> = []

    for (const user of users) {
      try {
        if (reclassify) {
          const result = await reclassifyAllTransactions(user.id)
          results.push({
            userId: user.id,
            // username omitted for privacy
            classified: result.classified,
          })
        } else {
          // Classify in batches until all done
          let totalClassified = 0
          let batch: { classified: number }
          do {
            batch = await classifyUserTransactions(user.id, 2000)
            totalClassified += batch.classified
          } while (batch.classified > 0)

          results.push({
            userId: user.id,
            classified: totalClassified,
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[classify-transactions] Failed for user ${user.id}:`, message)
        results.push({
          userId: user.id,
          classified: 0,
          error: message,
        })
      }
    }

    const totalClassified = results.reduce((sum, r) => sum + r.classified, 0)

    return NextResponse.json({
      success: true,
      totalClassified,
      users: results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[classify-transactions] Worker failed:", message)
    return NextResponse.json(
      { error: "Classification failed", details: message },
      { status: 500 }
    )
  }
}

/** GET — show classification stats */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Intentionally global aggregate stats — this is an internal endpoint
  // protected by SNAPSHOT_WORKER_SECRET, used for system-wide monitoring.
  // Per-user scoping is not needed here since the endpoint is not user-facing.
  const stats = await db.transactionCache.groupBy({
    by: ["txClassification"],
    _count: { id: true },
  })

  const totalUnclassified = stats
    .filter((s) => s.txClassification === null)
    .reduce((sum, s) => sum + s._count.id, 0)

  const totalClassified = stats
    .filter((s) => s.txClassification !== null)
    .reduce((sum, s) => sum + s._count.id, 0)

  return NextResponse.json({
    totalClassified,
    totalUnclassified,
    breakdown: Object.fromEntries(
      stats
        .filter((s) => s.txClassification !== null)
        .map((s) => [s.txClassification, s._count.id])
    ),
  })
}
