import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"

const RETENTION_DAYS = 730 // 2 years
const SNAPSHOT_RETENTION_DAYS = 365 // 1 year

/**
 * POST /api/portfolio/maintenance/cleanup
 * Purge old data beyond retention window to keep tables bounded.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9100", "Authentication required", 401)

  const txCutoff = Math.floor(Date.now() / 1000) - RETENTION_DAYS * 86400
  const snapshotCutoff = new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 86400 * 1000)
  const providerMinuteCutoff = new Date(Date.now() - 30 * 86400 * 1000) // 30 days

  try {
    const [txDeleted, exchDeleted, snapshotDeleted, balanceDeleted, providerDeleted] = await Promise.all([
      db.transactionCache.deleteMany({
        where: { userId: user.id, blockTimestamp: { lt: txCutoff } },
      }),
      db.exchangeTransactionCache.deleteMany({
        where: { userId: user.id, timestamp: { lt: txCutoff } },
      }),
      db.portfolioSnapshot.deleteMany({
        where: { userId: user.id, createdAt: { lt: snapshotCutoff } },
      }),
      db.balanceSnapshot.deleteMany({
        where: {
          wallet: { userId: user.id },
          fetchedAt: { lt: snapshotCutoff },
        },
      }),
      // ProviderUsageMinute is a global table (no userId) — time-based cleanup is correct
      db.providerUsageMinute.deleteMany({
        where: { minuteBucket: { lt: providerMinuteCutoff } },
      }),
    ])

    return NextResponse.json({
      success: true,
      purged: {
        transactionCache: txDeleted.count,
        exchangeTransactionCache: exchDeleted.count,
        portfolioSnapshots: snapshotDeleted.count,
        balanceSnapshots: balanceDeleted.count,
        providerUsageMinutes: providerDeleted.count,
      },
    })
  } catch (error) {
    return apiError("E9101", "Cleanup failed", 500, error)
  }
}
