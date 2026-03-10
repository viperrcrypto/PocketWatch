import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import {
  isIncrementalSyncStale,
  scheduleIncrementalSync,
} from "@/lib/portfolio/transaction-fetcher"

/**
 * POST /api/portfolio/history/sync/incremental
 * Manually trigger an incremental sync to fetch new blocks since last historical sync.
 * Returns immediately if sync is already current.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9096", "Authentication required", 401)

  try {
    const stale = await isIncrementalSyncStale(user.id, 0)
    if (!stale) {
      return NextResponse.json({ alreadyCurrent: true, scheduled: false })
    }

    const result = await scheduleIncrementalSync(user.id)
    if (!result) {
      return NextResponse.json({ alreadyCurrent: true, scheduled: false, reason: "no_completed_states" })
    }

    return NextResponse.json({ alreadyCurrent: false, scheduled: true, jobId: result.jobId, status: result.status })
  } catch (error) {
    return apiError("E9097", "Failed to schedule incremental sync", 500, error)
  }
}
