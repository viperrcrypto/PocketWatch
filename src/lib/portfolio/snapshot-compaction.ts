/**
 * Portfolio snapshot compaction — bounds the unbounded growth of high-frequency
 * snapshots so the chart-history hot path stays fast.
 *
 * The portfolio refresh (every 2 min) + snapshot worker (every 5 min) write a
 * `live_refresh` PortfolioSnapshot each time, so the table grows forever and the
 * /history/snapshots route (which reads ALL of them) gets linearly slower.
 *
 * This downsamples OLD live_refresh + exchange_balance snapshots to one-per-UTC-day
 * (keeping the day's last value), while leaving everything from the last
 * RETENTION_FULL_DAYS at full resolution and never touching `reconstructed`
 * snapshots (already sparse) or ChartCache. The chart is unchanged: a multi-month
 * range never needed 2-minute resolution for old days.
 *
 * Safe by construction — it only DELETES redundant intraday duplicates; it does
 * not alter the read/merge pipeline, so there is no chart-shape regression.
 */

import { db } from "@/lib/db"

const RETENTION_FULL_DAYS = 7
const COMPACTABLE_SOURCES = ["live_refresh", "exchange_balance"] as const
const DELETE_BATCH = 500

interface CompactionResult {
  scanned: number
  kept: number
  deleted: number
}

/**
 * Compact one user's old high-frequency snapshots to daily resolution.
 * Keeps the latest snapshot per (source, UTC day) older than the retention window.
 */
export async function compactPortfolioSnapshots(userId: string): Promise<CompactionResult> {
  const cutoff = new Date(Date.now() - RETENTION_FULL_DAYS * 24 * 60 * 60 * 1000)

  // Only id/createdAt/source — no metadata decryption, so this is cheap even when
  // the table is large (and after the first run there are few old rows left).
  const old = await db.portfolioSnapshot.findMany({
    where: { userId, createdAt: { lt: cutoff }, source: { in: [...COMPACTABLE_SOURCES] } },
    select: { id: true, createdAt: true, source: true },
    orderBy: { createdAt: "asc" },
  })

  // Keep the LAST id seen per (source, day). Ascending order => last write = latest.
  const keepByDay = new Map<string, string>()
  for (const s of old) {
    const day = s.createdAt.toISOString().slice(0, 10)
    keepByDay.set(`${s.source}:${day}`, s.id)
  }
  const keepIds = new Set(keepByDay.values())
  const deleteIds = old.filter((s) => !keepIds.has(s.id)).map((s) => s.id)

  let deleted = 0
  for (let i = 0; i < deleteIds.length; i += DELETE_BATCH) {
    const batch = deleteIds.slice(i, i + DELETE_BATCH)
    const res = await db.portfolioSnapshot.deleteMany({ where: { id: { in: batch } } })
    deleted += res.count
  }

  return { scanned: old.length, kept: keepIds.size, deleted }
}
