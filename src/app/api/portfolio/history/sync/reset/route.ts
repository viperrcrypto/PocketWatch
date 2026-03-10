import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { ensureSyncStatesForUser } from "@/lib/portfolio/transaction-fetcher"

/**
 * DELETE /api/portfolio/history/sync/reset
 *
 * Clears stuck throttle state so the sync can resume immediately:
 * - Resets retryAfter on all incomplete TransactionSyncState rows
 * - Resets consecutive429 on all ProviderCallGate rows
 * - Re-runs ensureSyncStatesForUser to migrate to Zerion if keys are now present
 *
 * Does NOT clear isComplete — actual sync progress is preserved.
 */
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9090", "Authentication required", 401)

  const [syncReset, gateReset] = await Promise.all([
    db.transactionSyncState.updateMany({
      where: { userId: user.id, isComplete: false, retryAfter: { not: null } },
      data: { retryAfter: null },
    }),
    db.providerCallGate.updateMany({
      where: { userId: user.id, consecutive429: { gt: 0 } },
      data: { consecutive429: 0, nextAllowedAt: null },
    }),
  ])

  // Re-evaluate sync state routing (migrates old Alchemy entries to Zerion if keys exist)
  await ensureSyncStatesForUser(user.id)

  return NextResponse.json({
    success: true,
    syncRowsReset: syncReset.count,
    gatesReset: gateReset.count,
  })
}

/**
 * POST /api/portfolio/history/sync/reset
 *
 * Force re-sync for a specific wallet by deleting all its sync states
 * and recreating them fresh. Useful when Zerion returned 0 transactions
 * and the sync is stuck as completed.
 *
 * Body: { walletAddress: string }
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9090", "Authentication required", 401)

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const rawAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : ""

  if (!rawAddress || rawAddress.length > 200) {
    return apiError("E9410", "walletAddress is required", 400)
  }

  // Verify the wallet belongs to this user (TrackedWallet stores original casing).
  // Try exact match first, then case-insensitive for EVM addresses.
  let wallet = await db.trackedWallet.findFirst({
    where: { userId: user.id, address: rawAddress },
    select: { address: true },
  })
  if (!wallet) {
    wallet = await db.trackedWallet.findFirst({
      where: { userId: user.id, address: rawAddress.toLowerCase() },
      select: { address: true },
    })
  }

  if (!wallet) {
    return apiError("E9411", "Wallet not found", 404)
  }

  // Sync states store EVM addresses lowercased, Solana addresses as-is.
  // Delete both casings to cover all sync state rows for this wallet.
  const variants = new Set([wallet.address, wallet.address.toLowerCase()])
  const deleted = await db.transactionSyncState.deleteMany({
    where: { userId: user.id, walletAddress: { in: Array.from(variants) } },
  })

  // Recreate fresh sync states
  await ensureSyncStatesForUser(user.id)

  return NextResponse.json({
    success: true,
    walletAddress: wallet.address,
    statesDeleted: deleted.count,
  })
}
