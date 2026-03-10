import { db } from "@/lib/db"
import { round2, yearStartUtc, yearEndUtc } from "./constants"
import { combineConfidence } from "./economic-math"
import { buildTxContext } from "./db-queries"
import { pickFlow } from "./flow-reconstruction"
import type {
  LifecyclePositionInput,
  StakingDataConfidence,
  StakingHistoryOptions,
} from "./types"

// ─── Prisma delegate type ───
type PrismaClient = typeof db & Record<string, any>

// ─── History V2 ───

export async function getStakingHistoryV2(
  userId: string,
  opts: StakingHistoryOptions,
): Promise<{
  entries: Array<{
    timestamp: number
    date: string
    totalStaked: number
    totalDailyYield: number
    totalAnnualYield: number
    avgApy: number
    totalRewards: number
    cumulativeYieldUsd: number
    depositedUsdCumulative: number
    withdrawnUsdCumulative: number
    claimedUsdCumulative: number
    confidence: StakingDataConfidence
  }>
  yieldEarned: number
  avgApyOverPeriod: number
  depositedUsd: number
  withdrawnUsd: number
  claimedUsd: number
  daysTracked: number
  availableYears: number[]
  summary: {
    earnedUsd: number
    avgApy: number
    depositedUsd: number
    withdrawnUsd: number
    claimedUsd: number
    daysTracked: number
  }
}> {
  const prisma = db as PrismaClient

  const range = opts.range ?? (opts.year ? "year" : "all")
  const now = new Date()

  let gte: Date | undefined
  let lte: Date | undefined

  if (range === "ytd") {
    gte = yearStartUtc(now.getUTCFullYear())
    lte = now
  } else if (range === "year") {
    const year = opts.year ?? now.getUTCFullYear()
    gte = yearStartUtc(year)
    lte = yearEndUtc(year)
  }

  let positionKeys: string[] | undefined
  if (opts.positionKey) {
    positionKeys = [opts.positionKey]
  } else if (opts.protocol) {
    const rows = await prisma.stakingPosition.findMany({
      where: {
        userId,
        protocol: {
          equals: opts.protocol,
          mode: "insensitive",
        },
      },
      select: { positionKey: true },
    })
    positionKeys = rows.map((r: { positionKey: string }) => r.positionKey)
    if ((positionKeys?.length ?? 0) === 0) positionKeys = ["__none__"]
  }

  const where: Record<string, unknown> = { userId }
  if (positionKeys) where.positionKey = { in: positionKeys }
  if (gte || lte) {
    where.snapshotAt = {
      ...(gte ? { gte } : {}),
      ...(lte ? { lte } : {}),
    }
  }

  const rows = await prisma.stakingPositionSnapshot.findMany({
    where,
    select: {
      positionKey: true,
      snapshotAt: true,
      valueUsd: true,
      dailyYieldUsd: true,
      apyTotal: true,
      yieldEarnedUsd: true,
      depositedUsdCumulative: true,
      withdrawnUsdCumulative: true,
      claimedUsdCumulative: true,
      dataConfidence: true,
    },
    orderBy: { snapshotAt: "asc" },
  })

  // Derive available years from position date ranges (not just snapshots)
  const positionDateRows = await prisma.stakingPosition.findMany({
    where: { userId },
    select: { openedAt: true, closedAt: true },
  })
  const yearSet = new Set<number>()
  yearSet.add(now.getUTCFullYear())
  for (const row of positionDateRows) {
    const r = row as Record<string, unknown>
    if (r.openedAt) {
      const openYear = new Date(r.openedAt as string | number).getUTCFullYear()
      const closeYear = r.closedAt
        ? new Date(r.closedAt as string | number).getUTCFullYear()
        : now.getUTCFullYear()
      for (let y = openYear; y <= closeYear; y++) yearSet.add(y)
    }
  }
  const availableYears: number[] = Array.from(yearSet).sort((a, b) => b - a)

  if (rows.length === 0) {
    // Position-based fallback — pro-rate earned by overlap with requested range
    const fallbackPositions = await prisma.stakingPosition.findMany({
      where: { userId, excludeFromYield: false },
      select: {
        openedAt: true, closedAt: true,
        yieldEarnedUsd: true, depositedUsd: true,
        withdrawnUsd: true, claimedUsd: true,
        apy: true, metadata: true,
      },
    })

    const rangeStart = gte ?? new Date(0)
    const rangeEnd = lte ?? now
    let earnedUsd = 0, totalDeposited = 0, totalWithdrawn = 0, totalClaimed = 0
    let apySum = 0, apyCount = 0
    let minTs = Infinity, maxTs = 0

    for (const pos of fallbackPositions) {
      const r = pos as Record<string, unknown>
      const meta = (r.metadata ?? {}) as Record<string, unknown>
      const ms = meta.yieldMetricsState
      if (ms && ms !== "valid" && ms !== "clamped") continue

      const earned = Number(r.yieldEarnedUsd ?? 0)
      const opened = r.openedAt ? new Date(r.openedAt as string | number) : rangeStart
      const closed = r.closedAt ? new Date(r.closedAt as string | number) : now

      if (closed < rangeStart || opened > rangeEnd) continue

      const totalMs = Math.max(closed.getTime() - opened.getTime(), 86_400_000)
      const overlapStart = opened > rangeStart ? opened : rangeStart
      const overlapEnd = closed < rangeEnd ? closed : rangeEnd
      const overlapMs = Math.max(overlapEnd.getTime() - overlapStart.getTime(), 0)
      if (overlapMs === 0) continue

      const fraction = overlapMs / totalMs
      earnedUsd += earned * fraction
      totalDeposited += Number(r.depositedUsd ?? 0)
      totalWithdrawn += Number(r.withdrawnUsd ?? 0)
      totalClaimed += Number(r.claimedUsd ?? 0)

      const apy = Number(r.apy ?? 0)
      if (apy > 0) { apySum += apy; apyCount++ }
      minTs = Math.min(minTs, overlapStart.getTime())
      maxTs = Math.max(maxTs, overlapEnd.getTime())
    }

    const fbDaysTracked = minTs < Infinity ? Math.max(1, Math.ceil((maxTs - minTs) / 86_400_000)) : 0
    const fbAvgApy = apyCount > 0 ? round2(apySum / apyCount) : 0
    const hasPositionData = earnedUsd !== 0 || totalDeposited > 0

    return {
      entries: [],
      yieldEarned: round2(earnedUsd),
      avgApyOverPeriod: fbAvgApy,
      depositedUsd: round2(totalDeposited),
      withdrawnUsd: round2(totalWithdrawn),
      claimedUsd: round2(totalClaimed),
      daysTracked: fbDaysTracked,
      availableYears,
      ...(hasPositionData ? { positionBased: true } : {}),
      summary: {
        earnedUsd: round2(earnedUsd),
        avgApy: fbAvgApy,
        depositedUsd: round2(totalDeposited),
        withdrawnUsd: round2(totalWithdrawn),
        claimedUsd: round2(totalClaimed),
        daysTracked: fbDaysTracked,
      },
    }
  }

  // Fetch excluded position keys to filter from yield history
  const excludedRows = await prisma.stakingPosition.findMany({
    where: { userId, excludeFromYield: true },
    select: { positionKey: true },
  })
  const excludedKeys = new Set(excludedRows.map((r: { positionKey: string }) => r.positionKey))

  type EntryAccumulator = {
    timestamp: number
    totalStaked: number
    totalDailyYield: number
    totalAnnualYield: number
    apyWeightedNum: number
    apyWeightedDen: number
    cumulativeYieldUsd: number
    depositedUsdCumulative: number
    withdrawnUsdCumulative: number
    claimedUsdCumulative: number
    confidenceParts: StakingDataConfidence[]
  }

  const byTs = new Map<number, EntryAccumulator>()

  for (const row of rows) {
    if (excludedKeys.has(String(row.positionKey))) continue
    const ts = Math.floor(new Date(row.snapshotAt).getTime() / 1000)
    const value = Number(row.valueUsd ?? 0)
    const dailyYield = Number(row.dailyYieldUsd ?? 0)
    const apy = Number(row.apyTotal ?? 0)
    const annual = value * (apy / 100)
    const confidence = String(row.dataConfidence ?? "estimated") as StakingDataConfidence

    const curr = byTs.get(ts) ?? {
      timestamp: ts,
      totalStaked: 0,
      totalDailyYield: 0,
      totalAnnualYield: 0,
      apyWeightedNum: 0,
      apyWeightedDen: 0,
      cumulativeYieldUsd: 0,
      depositedUsdCumulative: 0,
      withdrawnUsdCumulative: 0,
      claimedUsdCumulative: 0,
      confidenceParts: [],
    }

    const updated: EntryAccumulator = {
      ...curr,
      totalStaked: curr.totalStaked + value,
      totalDailyYield: curr.totalDailyYield + dailyYield,
      totalAnnualYield: curr.totalAnnualYield + annual,
      apyWeightedNum: curr.apyWeightedNum + apy * value,
      apyWeightedDen: curr.apyWeightedDen + value,
      cumulativeYieldUsd: curr.cumulativeYieldUsd + Number(row.yieldEarnedUsd ?? 0),
      depositedUsdCumulative: curr.depositedUsdCumulative + Number(row.depositedUsdCumulative ?? 0),
      withdrawnUsdCumulative: curr.withdrawnUsdCumulative + Number(row.withdrawnUsdCumulative ?? 0),
      claimedUsdCumulative: curr.claimedUsdCumulative + Number(row.claimedUsdCumulative ?? 0),
      confidenceParts: [...curr.confidenceParts, confidence],
    }

    byTs.set(ts, updated)
  }

  const entries = Array.from(byTs.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((e) => ({
      timestamp: e.timestamp,
      date: new Date(e.timestamp * 1000).toISOString().slice(0, 10),
      totalStaked: round2(e.totalStaked),
      totalDailyYield: round2(e.totalDailyYield),
      totalAnnualYield: round2(e.totalAnnualYield),
      avgApy: e.apyWeightedDen > 0 ? round2(e.apyWeightedNum / e.apyWeightedDen) : 0,
      totalRewards: round2(e.claimedUsdCumulative),
      cumulativeYieldUsd: round2(e.cumulativeYieldUsd),
      depositedUsdCumulative: round2(e.depositedUsdCumulative),
      withdrawnUsdCumulative: round2(e.withdrawnUsdCumulative),
      claimedUsdCumulative: round2(e.claimedUsdCumulative),
      confidence: combineConfidence(e.confidenceParts),
    }))

  const first = entries[0]
  const last = entries[entries.length - 1]
  const earnedUsd = entries.length === 1
    ? round2(entries[0].cumulativeYieldUsd)
    : round2(last.cumulativeYieldUsd - first.cumulativeYieldUsd)
  const depositedUsd = round2(last.depositedUsdCumulative - first.depositedUsdCumulative)
  const withdrawnUsd = round2(last.withdrawnUsdCumulative - first.withdrawnUsdCumulative)
  const claimedUsd = round2(last.claimedUsdCumulative - first.claimedUsdCumulative)

  const daysTracked = new Set(entries.map((e) => e.date)).size

  const avgApyOverPeriod = entries.length > 0
    ? round2(entries.reduce((sum, e) => sum + e.avgApy, 0) / entries.length)
    : 0

  return {
    entries,
    yieldEarned: earnedUsd,
    avgApyOverPeriod,
    depositedUsd,
    withdrawnUsd,
    claimedUsd,
    daysTracked,
    availableYears,
    summary: {
      earnedUsd,
      avgApy: avgApyOverPeriod,
      depositedUsd,
      withdrawnUsd,
      claimedUsd,
      daysTracked,
    },
  }
}

// ─── Reset ───

export async function resetStakingLifecycleData(
  userId: string,
): Promise<{ deletedPositions: number; deletedSnapshots: number }> {
  const prisma = db as PrismaClient

  await prisma.stakingSyncState.upsert({
    where: { userId },
    create: {
      userId,
      status: "rebuild_running",
      backfillStartedAt: null,
      backfillCompletedAt: null,
      lastHourlySnapshotAt: null,
      hourlyCursor: null,
    },
    update: {
      status: "rebuild_running",
      backfillStartedAt: null,
      backfillCompletedAt: null,
      lastHourlySnapshotAt: null,
      hourlyCursor: null,
    },
  })

  const deletedSnapshots = await prisma.stakingPositionSnapshot.deleteMany({
    where: { userId },
  })
  const deletedPositions = await prisma.stakingPosition.deleteMany({
    where: { userId },
  })

  return {
    deletedPositions: Number(deletedPositions.count ?? 0),
    deletedSnapshots: Number(deletedSnapshots.count ?? 0),
  }
}

// ─── Frozen integrity sweep ───

export async function runFrozenIntegritySweep(userId: string): Promise<{ reopened: number }> {
  const prisma = db as PrismaClient

  const frozenRows = await prisma.stakingPosition.findMany({
    where: {
      userId,
      isFrozen: true,
      cacheState: "frozen",
    },
  })

  if (frozenRows.length === 0) {
    await prisma.stakingSyncState.upsert({
      where: { userId },
      create: { userId, lastWeeklyAuditAt: new Date(), status: "weekly_ok" },
      update: { lastWeeklyAuditAt: new Date(), status: "weekly_ok" },
    })
    return { reopened: 0 }
  }

  const inputs: LifecyclePositionInput[] = frozenRows.map((row: Record<string, unknown>) => ({
    wallet: row.wallet as string,
    chain: row.chain as string,
    symbol: row.symbol as string,
    name: row.name as string,
    protocol: (row.protocol as string | null) ?? null,
    defiProject: (row.providerSlug as string | null) ?? null,
    underlying: (row.underlying as string | null) ?? null,
    contractAddress: (row.contractAddress as string | null) ?? null,
    quantity: 0,
    price: 0,
    value: 0,
    apy: (row.apy as number | null) ?? null,
    apyBase: (row.apyBase as number | null) ?? null,
    apyReward: (row.apyReward as number | null) ?? null,
    annualYield: (row.annualYield as number | null) ?? null,
    dailyYield: (row.dailyYield as number | null) ?? null,
    maturityDate: row.maturityDate ? new Date(row.maturityDate as string | number).toISOString() : null,
    yieldSource: null,
    positionKey: row.positionKey as string,
  }))

  const txContext = await buildTxContext(userId, inputs)

  let reopened = 0
  for (const row of frozenRows) {
    const typedRow = row as Record<string, unknown>
    const input: LifecyclePositionInput = {
      wallet: typedRow.wallet as string,
      chain: typedRow.chain as string,
      symbol: typedRow.symbol as string,
      name: typedRow.name as string,
      protocol: (typedRow.protocol as string | null) ?? null,
      defiProject: (typedRow.providerSlug as string | null) ?? null,
      underlying: (typedRow.underlying as string | null) ?? null,
      contractAddress: (typedRow.contractAddress as string | null) ?? null,
      quantity: 0,
      price: 0,
      value: 0,
      apy: (typedRow.apy as number | null) ?? null,
      apyBase: (typedRow.apyBase as number | null) ?? null,
      apyReward: (typedRow.apyReward as number | null) ?? null,
      annualYield: (typedRow.annualYield as number | null) ?? null,
      dailyYield: (typedRow.dailyYield as number | null) ?? null,
      maturityDate: typedRow.maturityDate ? new Date(typedRow.maturityDate as string | number).toISOString() : null,
      yieldSource: null,
      positionKey: typedRow.positionKey as string,
    }

    const flow = pickFlow(input, txContext)

    const cursor = Number(typedRow.reopenCheckCursor ?? 0)
    if (flow.latestInTs > cursor) {
      reopened++
      await prisma.stakingPosition.update({
        where: {
          userId_positionKey: {
            userId,
            positionKey: typedRow.positionKey as string,
          },
        },
        data: {
          isFrozen: false,
          status: "active",
          cacheState: "live",
          closedAt: null,
          frozenAt: null,
          freezeConfidence: null,
          dustStreak: 0,
          closeCandidateAt: null,
          reopenCheckCursor: flow.latestInTs,
          lastValidatedAt: new Date(),
          confidenceReason: "Reopened after new inflow detected by audit",
        },
      })
    }
  }

  await prisma.stakingSyncState.upsert({
    where: { userId },
    create: { userId, lastWeeklyAuditAt: new Date(), status: "weekly_ok" },
    update: { lastWeeklyAuditAt: new Date(), status: "weekly_ok" },
  })

  return { reopened }
}
