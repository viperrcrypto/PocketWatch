/**
 * Staking snapshot service.
 * Saves daily snapshots of staking data and provides history queries.
 * One snapshot per day per user, upserted on each staking API call.
 */

import { db } from "@/lib/db"

// ─── Types ───

interface SnapshotData {
  totalStaked: number
  totalDailyYield: number
  totalAnnualYield: number
  avgApy: number
  totalRewards: number
  positions: unknown
  rewards: unknown
}

export interface StakingHistoryEntry {
  date: string          // ISO date (YYYY-MM-DD)
  totalStaked: number
  totalDailyYield: number
  totalAnnualYield: number
  avgApy: number
  totalRewards: number
}

export interface StakingHistorySummary {
  entries: StakingHistoryEntry[]
  yieldEarned: number         // estimated total yield over the period
  avgApyOverPeriod: number    // weighted average APY
  availableYears: number[]    // years with data
}

// ─── Save snapshot ───

/**
 * Upsert today's staking snapshot for a user.
 * Called fire-and-forget from the staking route.
 */
export async function saveStakingSnapshot(
  userId: string,
  data: SnapshotData,
): Promise<void> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  await db.stakingSnapshot.upsert({
    where: {
      userId_snapshotDate: {
        userId,
        snapshotDate: today,
      },
    },
    create: {
      userId,
      snapshotDate: today,
      totalStaked: data.totalStaked,
      totalDailyYield: data.totalDailyYield,
      totalAnnualYield: data.totalAnnualYield,
      avgApy: data.avgApy,
      totalRewards: data.totalRewards,
      positions: data.positions as any,
      rewards: data.rewards as any,
    },
    update: {
      totalStaked: data.totalStaked,
      totalDailyYield: data.totalDailyYield,
      totalAnnualYield: data.totalAnnualYield,
      avgApy: data.avgApy,
      totalRewards: data.totalRewards,
      positions: data.positions as any,
      rewards: data.rewards as any,
    },
  })
}

// ─── Query history ───

/**
 * Get staking history for a user, optionally filtered by year.
 */
export async function getStakingHistory(
  userId: string,
  year?: number,
): Promise<StakingHistorySummary> {
  // Determine date range
  let dateFilter: { gte?: Date; lte?: Date } = {}
  if (year) {
    dateFilter = {
      gte: new Date(`${year}-01-01T00:00:00.000Z`),
      lte: new Date(`${year}-12-31T23:59:59.999Z`),
    }
  }

  const snapshots = await db.stakingSnapshot.findMany({
    where: {
      userId,
      ...(Object.keys(dateFilter).length > 0 ? { snapshotDate: dateFilter } : {}),
    },
    orderBy: { snapshotDate: "asc" },
    select: {
      snapshotDate: true,
      totalStaked: true,
      totalDailyYield: true,
      totalAnnualYield: true,
      avgApy: true,
      totalRewards: true,
    },
  })

  const entries: StakingHistoryEntry[] = snapshots.map((s) => ({
    date: s.snapshotDate.toISOString().split("T")[0],
    totalStaked: s.totalStaked,
    totalDailyYield: s.totalDailyYield,
    totalAnnualYield: s.totalAnnualYield,
    avgApy: s.avgApy,
    totalRewards: s.totalRewards,
  }))

  // Compute yield earned via trapezoidal integration of daily yield
  const yieldEarned = computeYieldEarned(entries)

  // Weighted average APY (weighted by totalStaked)
  let weightedSum = 0
  let weightTotal = 0
  for (const e of entries) {
    if (e.totalStaked > 0 && e.avgApy > 0) {
      weightedSum += e.avgApy * e.totalStaked
      weightTotal += e.totalStaked
    }
  }
  const avgApyOverPeriod = weightTotal > 0 ? weightedSum / weightTotal : 0

  // Available years
  const allSnapshots = await db.stakingSnapshot.findMany({
    where: { userId },
    select: { snapshotDate: true },
    distinct: ["snapshotDate"],
  })
  const yearsSet = new Set(allSnapshots.map((s) => s.snapshotDate.getUTCFullYear()))
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a)

  return {
    entries,
    yieldEarned,
    avgApyOverPeriod,
    availableYears,
  }
}

// ─── Past positions ───

/**
 * Find positions that existed in recent snapshots but are no longer present.
 * These are "departed" positions (fully withdrawn tokens).
 */
export async function getPastPositions(
  userId: string,
  currentSymbolKeys: Set<string>,
): Promise<unknown[]> {
  // Look back up to 30 days for the most recent snapshot with positions data
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const snapshot = await db.stakingSnapshot.findFirst({
    where: {
      userId,
      snapshotDate: { gte: cutoff },
    },
    orderBy: { snapshotDate: "desc" },
    select: { positions: true, snapshotDate: true },
  })

  if (!snapshot?.positions) return []

  const snapshotPositions = snapshot.positions as Array<{
    symbol?: string
    wallet?: string
    value?: number
    [key: string]: unknown
  }>

  if (!Array.isArray(snapshotPositions)) return []

  // Filter to positions NOT in current set, with value > $1 (skip dust)
  return snapshotPositions.filter((p) => {
    if (!p.symbol || !p.wallet) return false
    if ((p.value ?? 0) <= 1) return false
    const key = `${p.symbol}:${p.wallet}`
    return !currentSymbolKeys.has(key)
  })
}

/**
 * Trapezoidal integration of daily yield values.
 * Estimates total yield earned over a series of daily snapshots.
 */
function computeYieldEarned(entries: StakingHistoryEntry[]): number {
  if (entries.length === 0) return 0
  if (entries.length === 1) return entries[0].totalDailyYield

  let total = 0
  for (let i = 1; i < entries.length; i++) {
    const prevDate = new Date(entries[i - 1].date)
    const currDate = new Date(entries[i].date)
    const daysBetween = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)

    // Average daily yield between the two snapshots, multiplied by days between
    const avgDailyYield = (entries[i - 1].totalDailyYield + entries[i].totalDailyYield) / 2
    total += avgDailyYield * daysBetween
  }

  return total
}
