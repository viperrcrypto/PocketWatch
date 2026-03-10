import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

function sumOnchainFromMetadata(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null
  const chainDistribution = (metadata as Record<string, unknown>).chainDistribution
  if (!chainDistribution || typeof chainDistribution !== "object") return null

  let sum = 0
  for (const [chain, value] of Object.entries(chainDistribution as Record<string, unknown>)) {
    if (chain.toLowerCase() === "exchange") continue
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) sum += parsed
  }
  return sum > 0 ? sum : null
}

/** GET /api/portfolio/history/repair-summary
 * Returns a deterministic sanity report after purge/rebuild.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9096", "Authentication required", 401)

  try {
    const wallets = await db.trackedWallet.findMany({
      where: { userId: user.id },
      select: { address: true },
      orderBy: { createdAt: "asc" },
    })

    const walletAddresses = wallets.map((wallet) => wallet.address.toLowerCase()).sort((a, b) => a.localeCompare(b))
    const walletFingerprint = walletAddresses.join("|")

    const [syncStates, coverageRows, latestLiveSnapshot, bySource] = await Promise.all([
      db.transactionSyncState.findMany({
        where: { userId: user.id },
        select: { walletAddress: true, isComplete: true, updatedAt: true, lastErrorCode: true, phase: true },
      }),
      walletAddresses.length > 0
        ? db.transactionCache.groupBy({
            by: ["walletAddress"],
            where: { userId: user.id, walletAddress: { in: walletAddresses } },
            _min: { blockTimestamp: true },
            _max: { blockTimestamp: true },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      db.portfolioSnapshot.findFirst({
        where: { userId: user.id, source: "live_refresh" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, totalValue: true, source: true, metadata: true },
      }),
      db.portfolioSnapshot.groupBy({
        by: ["source"],
        where: { userId: user.id },
        _count: { _all: true },
        _min: { createdAt: true, totalValue: true },
        _max: { createdAt: true, totalValue: true },
      }),
    ])

    const earliestByWallet = new Map<string, number>()
    for (const row of coverageRows) {
      if (row._min.blockTimestamp) earliestByWallet.set(row.walletAddress, row._min.blockTimestamp)
    }

    const hasCoverageForAllWallets = walletAddresses.length > 0 &&
      walletAddresses.every((address) => earliestByWallet.has(address))
    const strictCoverageStartSec = hasCoverageForAllWallets
      ? Math.max(...walletAddresses.map((address) => earliestByWallet.get(address) ?? 0))
      : null

    const incompleteSyncCount = syncStates.filter((state) => !state.isComplete).length
    const syncErrorCount = syncStates.filter((state) => !!state.lastErrorCode && state.phase !== "skipped" && state.phase !== "needs_key").length

    const latestTotalPoint = latestLiveSnapshot
      ? {
          timestamp: Math.floor(latestLiveSnapshot.createdAt.getTime() / 1000),
          iso: latestLiveSnapshot.createdAt.toISOString(),
          value: latestLiveSnapshot.totalValue,
          source: latestLiveSnapshot.source,
        }
      : null

    const latestOnchainValue = latestLiveSnapshot
      ? (sumOnchainFromMetadata(latestLiveSnapshot.metadata) ?? latestLiveSnapshot.totalValue)
      : null

    return NextResponse.json({
      userId: user.id,
      walletFingerprint,
      walletCount: walletAddresses.length,
      coverageStart: strictCoverageStartSec
        ? {
            timestamp: strictCoverageStartSec,
            iso: new Date(strictCoverageStartSec * 1000).toISOString(),
          }
        : null,
      sync: {
        states: syncStates.length,
        incompleteSyncCount,
        syncErrorCount,
        latestStateUpdate: syncStates.length > 0
          ? new Date(Math.max(...syncStates.map((state) => state.updatedAt.getTime()))).toISOString()
          : null,
      },
      latestPoints: {
        total: latestTotalPoint,
        onchain: latestOnchainValue !== null && latestTotalPoint
          ? { ...latestTotalPoint, value: latestOnchainValue }
          : null,
      },
      seriesSanity: bySource,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return apiError("E9097", "Failed to build repair summary", 500, error)
  }
}
