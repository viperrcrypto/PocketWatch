/**
 * Snapshot compaction worker — downsamples old high-frequency portfolio snapshots
 * to daily resolution so the chart-history read path stays bounded.
 *
 * POST /api/internal/snapshot-compaction
 * Bearer-secret (reuses SNAPSHOT_WORKER_SECRET). Runs daily via the scheduler.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkAuthFailureLimit, isAuthorizedBearer } from "@/lib/internal-auth"
import { compactPortfolioSnapshots } from "@/lib/portfolio/snapshot-compaction"

export const maxDuration = 120
export const dynamic = "force-dynamic"

const WORKER_SECRET = process.env.SNAPSHOT_WORKER_SECRET ?? ""

export async function POST(request: NextRequest) {
  if (!isAuthorizedBearer(request, WORKER_SECRET)) {
    // Failure-only throttle: successful auth never touches the limiter.
    const rl = checkAuthFailureLimit(request)
    if (!rl.ok) return NextResponse.json(rl.response, { status: 429, headers: rl.headers })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const users = await db.user.findMany({ select: { id: true } })
    let deleted = 0
    const errors: string[] = []

    for (const user of users) {
      try {
        const result = await compactPortfolioSnapshots(user.id)
        deleted += result.deleted
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[snapshot-compaction] failed for ${user.id}:`, message)
        errors.push(`${user.id}: ${message}`)
      }
    }

    console.log(`[snapshot-compaction] deleted=${deleted} errors=${errors.length}`)
    // Return only the count — per-user detail stays in the server log, not the body.
    return NextResponse.json({ deleted, errors: errors.length })
  } catch (error) {
    console.error("[snapshot-compaction] worker failed:", error)
    return NextResponse.json({ error: "Compaction worker failed" }, { status: 500 })
  }
}
