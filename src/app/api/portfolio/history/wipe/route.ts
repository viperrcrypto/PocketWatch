import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { startOrResumeHistorySyncJob } from "@/lib/portfolio/transaction-fetcher"
import type { Prisma } from "@/generated/prisma/client"

/**
 * POST /api/portfolio/history/wipe
 * Nuclear reset: wipe ALL transaction data, sync states, throttle gates,
 * chart caches, and snapshots — then immediately start a fresh sync.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9090", "Authentication required", 401)

  try {
    const purged = await db.$transaction(async (tx) => {
      const [txCache, syncStates, chartCache, snapshots, gates, jobs] = await Promise.all([
        tx.transactionCache.deleteMany({ where: { userId: user.id } }),
        tx.transactionSyncState.deleteMany({ where: { userId: user.id } }),
        tx.chartCache.deleteMany({ where: { userId: user.id } }),
        tx.portfolioSnapshot.deleteMany({ where: { userId: user.id } }),
        tx.providerCallGate.deleteMany({ where: { userId: user.id } }),
        tx.historySyncJob.updateMany({
          where: { userId: user.id, status: { in: ["queued", "running"] } },
          data: { status: "failed", completedAt: new Date(), error: "reset_by_wipe" },
        }),
      ])

      // Clear chart-related settings
      const existing = await tx.portfolioSetting.findUnique({
        where: { userId: user.id },
        select: { settings: true },
      })
      if (existing?.settings && typeof existing.settings === "object") {
        const next = { ...(existing.settings as Record<string, unknown>) }
        delete next.chartWalletFingerprint
        delete next.chartCacheUpdatedAt
        delete next.chartZerionSuppressedUntil
        delete next.chartZerionSuppressedAt
        delete next.chartZerionSuppressedReason
        delete next.chartReconstructionRequestedAt
        next.chartWipedAt = new Date().toISOString()
        await tx.portfolioSetting.update({
          where: { userId: user.id },
          data: { settings: next as Prisma.InputJsonValue },
        })
      }

      return {
        transactionCache: txCache.count,
        syncStates: syncStates.count,
        chartCache: chartCache.count,
        snapshots: snapshots.count,
        providerGates: gates.count,
        jobsReset: jobs.count,
      }
    })

    console.log(`[wipe] Purged all data for user ${user.id}:`, purged)

    // Start a fresh sync immediately
    const job = await startOrResumeHistorySyncJob(user.id)

    return NextResponse.json({
      success: true,
      purged,
      newJob: job,
      message: "All transaction data wiped. Fresh sync started.",
    })
  } catch (error) {
    return apiError("E9098", "Failed to wipe transaction data", 500, error)
  }
}
