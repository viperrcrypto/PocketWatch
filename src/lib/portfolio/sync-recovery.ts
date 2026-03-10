/**
 * Sync recovery & integrity checks.
 *
 * 1. recoverOrphanedJobs() — on server startup, resets any "running" jobs
 *    that were interrupted by a crash/restart so they resume cleanly.
 *
 * 2. checkSyncGaps() — after a wallet/chain sync completes, spot-checks
 *    the TransactionCache for block-number gaps that would indicate
 *    missing data (e.g. from a crash mid-pagination).
 */

import { db } from "@/lib/db"

const STALE_THRESHOLD_MS = 15 * 60_000 // 15 min — must exceed the 10-min stale threshold in transaction-fetcher

/**
 * Recover orphaned "running" / "queued" jobs left behind by a server crash.
 *
 * For HistorySyncJob:
 *   - "running" jobs with no recent activity → mark failed, clear retry windows
 *     so the next poll picks them up fresh.
 *   - The per-wallet TransactionSyncState cursors are untouched — they already
 *     point to the last successfully persisted position.
 *
 * For PortfolioRefreshJob:
 *   - "running" jobs → mark failed so a new refresh can be queued.
 *
 * Safe to call multiple times (idempotent).
 */
export async function recoverOrphanedJobs(): Promise<{
  historySyncRecovered: number
  refreshRecovered: number
}> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS)

  // --- History sync jobs ---
  const staleHistoryJobs = await db.historySyncJob.findMany({
    where: {
      status: { in: ["queued", "running"] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, userId: true, status: true },
  })

  for (const job of staleHistoryJobs) {
    await db.$transaction([
      db.historySyncJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          error: "Recovered after server restart",
          completedAt: new Date(),
        },
      }),
      // Clear retry windows so the user's sync states can resume immediately
      db.transactionSyncState.updateMany({
        where: { userId: job.userId, isComplete: false },
        data: { retryAfter: null },
      }),
    ])
  }

  // --- Portfolio refresh jobs ---
  const staleRefreshJobs = await db.portfolioRefreshJob.findMany({
    where: {
      status: { in: ["queued", "running"] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
  })

  for (const job of staleRefreshJobs) {
    await db.portfolioRefreshJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: "Recovered after server restart",
        completedAt: new Date(),
      },
    })
  }

  const historySyncRecovered = staleHistoryJobs.length
  const refreshRecovered = staleRefreshJobs.length

  if (historySyncRecovered > 0 || refreshRecovered > 0) {
    console.log(
      `[sync-recovery] Recovered ${historySyncRecovered} history sync job(s), ${refreshRecovered} refresh job(s)`,
    )
  }

  return { historySyncRecovered, refreshRecovered }
}

/**
 * Spot-check a completed wallet/chain sync for block-number gaps.
 *
 * Strategy: sample N evenly-spaced block numbers from the TransactionCache
 * and check for suspiciously large jumps that exceed `maxGapBlocks`.
 * Returns any detected gaps so the caller can decide to re-sync that range.
 *
 * For Solana (slot-based, non-contiguous), gap detection is skipped —
 * Solana uses signature-based pagination, not block ranges.
 */
export interface BlockGap {
  fromBlock: number
  toBlock: number
  gapSize: number
}

export async function checkSyncGaps(
  userId: string,
  walletAddress: string,
  chain: string,
  opts?: { maxGapBlocks?: number; sampleSize?: number },
): Promise<BlockGap[]> {
  // Solana doesn't use contiguous block numbers — skip
  if (chain === "SOLANA") return []

  const maxGapBlocks = opts?.maxGapBlocks ?? 100_000
  const sampleSize = Math.min(opts?.sampleSize ?? 200, 1000)

  // Get the sync state to know the claimed range
  const state = await db.transactionSyncState.findUnique({
    where: { userId_walletAddress_chain: { userId, walletAddress, chain } },
    select: { highWaterMark: true, isComplete: true, cursorFromBlock: true },
  })

  if (!state || !state.isComplete || !state.highWaterMark) return []

  // Fetch distinct block numbers, sampled evenly across the range
  // We get all distinct blocks and check for gaps — for wallets with
  // thousands of txs this is still fast (indexed column, distinct).
  const blocks = await db.transactionCache.findMany({
    where: { userId, walletAddress, chain },
    select: { blockNumber: true },
    distinct: ["blockNumber"],
    orderBy: { blockNumber: "asc" },
    take: sampleSize * 10, // over-fetch then sample
  })

  if (blocks.length < 2) return []

  // Sample evenly if we have too many blocks
  const blockNumbers = blocks.map((b) => b.blockNumber)
  const sampled =
    blockNumbers.length <= sampleSize
      ? blockNumbers
      : evenSample(blockNumbers, sampleSize)

  const gaps: BlockGap[] = []
  for (let i = 1; i < sampled.length; i++) {
    const gapSize = sampled[i] - sampled[i - 1]
    if (gapSize > maxGapBlocks) {
      gaps.push({
        fromBlock: sampled[i - 1],
        toBlock: sampled[i],
        gapSize,
      })
    }
  }

  return gaps
}

function evenSample(arr: number[], count: number): number[] {
  if (arr.length <= count) return arr
  const step = (arr.length - 1) / (count - 1)
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    result.push(arr[Math.round(i * step)])
  }
  return result
}

/**
 * If gaps are found after sync completion, reset the sync state to re-fetch
 * the missing block ranges. Only resets if gaps exceed the threshold.
 */
export async function healSyncGaps(
  userId: string,
  walletAddress: string,
  chain: string,
  gaps: BlockGap[],
): Promise<boolean> {
  if (gaps.length === 0) return false

  // Find the earliest gap — reset cursor to re-fetch from there
  const earliestGap = gaps.reduce((min, g) => (g.fromBlock < min.fromBlock ? g : min), gaps[0])

  await db.transactionSyncState.update({
    where: { userId_walletAddress_chain: { userId, walletAddress, chain } },
    data: {
      isComplete: false,
      phase: "bootstrap",
      cursorFromBlock: earliestGap.fromBlock,
      cursorToBlock: null,
      pageKey: null,
      retryAfter: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })

  console.warn(
    `[sync-recovery] Healing ${gaps.length} gap(s) for ${walletAddress}/${chain} — ` +
      `earliest gap at block ${earliestGap.fromBlock}, resetting sync`,
  )

  return true
}
