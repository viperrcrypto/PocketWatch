/**
 * Finance Sync Worker — periodically syncs all active Plaid/SimpleFIN institutions.
 *
 * GET|POST /api/internal/finance-sync-worker
 *
 * Protected by CRON_SECRET (Vercel) or FINANCE_SYNC_SECRET env var.
 * Runs every 15 minutes via Vercel cron.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { syncAllInstitutions, fetchFullPlaidHistory, backfillHistoricalSnapshots } from "@/lib/finance/sync"
import { syncAllPlaidData } from "@/lib/finance/plaid-data-sync"
import {
  claimRetryableJobs,
  markJobRunning,
  markJobCompleted,
  markJobFailed,
} from "@/lib/finance/sync/plaid-sync-jobs"
import { detectAndNotify, notifyPriceChanges } from "@/lib/finance/alert-orchestrator"
import { detectAndSaveSubscriptions } from "@/lib/finance/sync/detect-subscriptions"

export const maxDuration = 300

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.FINANCE_SYNC_SECRET
  const vercelCronSecret = process.env.CRON_SECRET

  const headerSecret = request.headers.get("x-finance-sync-secret")
  if (secret && headerSecret === secret) return true

  const auth = request.headers.get("authorization")
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim()
    if (secret && token === secret) return true
    if (vercelCronSecret && token === vercelCronSecret) return true
  }

  return false
}

export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = await db.financeInstitution.findMany({
    where: { status: { not: "disconnected" } },
    select: { userId: true },
    distinct: ["userId"],
  })

  const results: Array<{ userId: string; ok: boolean; synced?: number; error?: string }> = []

  for (const { userId } of users) {
    try {
      const syncResults = await syncAllInstitutions(userId)
      const totalAdded = syncResults.reduce((sum, r) => sum + r.transactionsAdded, 0)

      if (totalAdded > 0) {
        await backfillHistoricalSnapshots(userId).catch(() => {})
      }

      results.push({ userId, ok: true, synced: totalAdded })
    } catch (err) {
      results.push({
        userId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Retry failed PlaidSyncJobs (full_history and product_sync)
  const retryableJobs = await claimRetryableJobs()
  const retryResults: Array<{ jobId: string; status: string; error?: string }> = []

  for (const job of retryableJobs) {
    // markJobRunning is called inside fetchFullPlaidHistory when jobId is provided
    try {
      if (job.jobType === "full_history") {
        await fetchFullPlaidHistory(job.userId, { jobId: job.id })
        retryResults.push({ jobId: job.id, status: "completed" })
      } else if (job.jobType === "product_sync") {
        await markJobRunning(job.id)
        await syncAllPlaidData(job.userId)
        await markJobCompleted(job.id, { fetched: 0, inserted: 0 })
        retryResults.push({ jobId: job.id, status: "completed" })
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await markJobFailed(job.id, errMsg)
      retryResults.push({ jobId: job.id, status: "failed", error: errMsg })
    }
  }

  // Run subscription detection + alerts after sync
  const alertResults: Array<{ userId: string; alertsSent: number }> = []
  for (const { userId } of users) {
    try {
      const subResult = await detectAndSaveSubscriptions(userId)
      if (subResult.priceChanges.length > 0) {
        await notifyPriceChanges(userId, subResult.priceChanges)
      }
      const alertResult = await detectAndNotify(userId)
      alertResults.push({ userId, alertsSent: alertResult.alertsSent })
    } catch (err) {
      console.error("[finance-sync-worker] Alert check failed:", err instanceof Error ? err.message : err)
    }
  }

  const totalAlerts = alertResults.reduce((sum, r) => sum + r.alertsSent, 0)

  console.info("[finance-sync-worker]", {
    processed: users.length,
    totalSynced: results.reduce((sum, r) => sum + (r.synced ?? 0), 0),
    retriedJobs: retryResults.length,
    totalAlerts,
  })

  return NextResponse.json({
    processed: users.length,
    results,
    retryResults,
    totalAlerts,
    ranAt: new Date().toISOString(),
  })
}
