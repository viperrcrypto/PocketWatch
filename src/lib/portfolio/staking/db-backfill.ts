/**
 * Hourly snapshot backfill logic — fills historical gaps using APY interpolation + tx data.
 */

import { db } from "@/lib/db"
import {
  round2,
  getTxChain,
  buildPositionKey,
  MAX_BACKFILL_ROWS,
} from "./constants"
import type { LifecyclePositionInput } from "./types"

// ─── Prisma delegate type ───
type PrismaClient = typeof db & Record<string, any>

export async function maybeBackfill(userId: string, positions: LifecyclePositionInput[]): Promise<void> {
  const prisma = db as PrismaClient

  const syncState = await prisma.stakingSyncState.upsert({
    where: { userId },
    create: { userId, status: "backfill_pending" },
    update: {},
  })

  if (syncState.backfillCompletedAt) return

  const firstTx = await prisma.transactionCache.findFirst({
    where: { userId, usdValue: { not: null } },
    orderBy: { blockTimestamp: "asc" },
    select: { blockTimestamp: true },
  })

  if (!firstTx) {
    await prisma.stakingSyncState.update({
      where: { userId },
      data: {
        backfillStartedAt: syncState.backfillStartedAt ?? new Date(),
        backfillCompletedAt: new Date(),
        status: "backfill_done",
      },
    })
    return
  }

  const startTs = Math.floor(Number(firstTx.blockTimestamp) / 3600) * 3600
  const endTs = Math.floor(Date.now() / 1000 / 3600) * 3600
  if (!Number.isFinite(startTs) || startTs >= endTs) {
    await prisma.stakingSyncState.update({
      where: { userId },
      data: {
        backfillStartedAt: syncState.backfillStartedAt ?? new Date(),
        backfillCompletedAt: new Date(),
        status: "backfill_done",
      },
    })
    return
  }

  await prisma.stakingSyncState.update({
    where: { userId },
    data: {
      backfillStartedAt: syncState.backfillStartedAt ?? new Date(),
      status: "backfill_running",
    },
  })

  let inserted = 0
  let hitCap = false
  let hasPendingWork = false
  const batchRows: any[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma createMany data

  for (const position of positions) {
    const positionKey = position.positionKey ?? buildPositionKey(position)
    const latestSnapshot = await prisma.stakingPositionSnapshot.findFirst({
      where: { userId, positionKey },
      select: {
        snapshotAt: true,
        depositedUsdCumulative: true,
        withdrawnUsdCumulative: true,
        claimedUsdCumulative: true,
        valueUsd: true,
      },
      orderBy: { snapshotAt: "desc" },
    })
    const latestSnapshotTs = latestSnapshot?.snapshotAt
      ? Math.floor(new Date(latestSnapshot.snapshotAt as unknown as string | number).getTime() / 1000 / 3600) * 3600
      : null
    const positionStartTs = latestSnapshotTs !== null ? latestSnapshotTs + 3600 : startTs
    if (positionStartTs > endTs) continue
    hasPendingWork = true

    const apy = position.apy ?? 0
    const annualRate = apy / 100

    let depositedUsd = Number(latestSnapshot?.depositedUsdCumulative ?? 0)
    let withdrawnUsd = Number(latestSnapshot?.withdrawnUsdCumulative ?? 0)
    const claimedUsd = Number(latestSnapshot?.claimedUsdCumulative ?? 0)
    let runningValueUsd = Number(latestSnapshot?.valueUsd ?? 0)

    const txChain = getTxChain(position.chain)
    const symbolCandidates = [position.symbol.toUpperCase(), (position.underlying ?? "").toUpperCase()].filter(Boolean)

    const txRows = txChain
      ? await prisma.transactionCache.findMany({
          where: {
            userId,
            walletAddress: position.wallet.toLowerCase(),
            chain: txChain,
            usdValue: { not: null },
            OR: [
              ...(position.contractAddress ? [{ asset: position.contractAddress.toLowerCase() }] : []),
              ...(symbolCandidates.length > 0 ? [{ symbol: { in: symbolCandidates } }] : []),
            ],
          },
          select: {
            blockTimestamp: true,
            direction: true,
            usdValue: true,
          },
          orderBy: { blockTimestamp: "asc" },
        })
      : []

    let txIdx = 0
    const sorted = txRows
    if (latestSnapshotTs !== null) {
      while (txIdx < sorted.length && Number((sorted[txIdx] as Record<string, unknown>).blockTimestamp) <= latestSnapshotTs + 3599) {
        txIdx++
      }
    }

    for (let ts = positionStartTs; ts <= endTs; ts += 3600) {
      while (txIdx < sorted.length && Number((sorted[txIdx] as Record<string, unknown>).blockTimestamp) <= ts + 3599) {
        const usd = Number((sorted[txIdx] as Record<string, unknown>).usdValue ?? 0)
        if (Number.isFinite(usd) && usd > 0) {
          if ((sorted[txIdx] as Record<string, unknown>).direction === "out") {
            depositedUsd += usd
            runningValueUsd += usd
          } else {
            withdrawnUsd += usd
            runningValueUsd = Math.max(0, runningValueUsd - usd)
          }
        }
        txIdx++
      }

      const principalUsd = Math.max(0, depositedUsd - withdrawnUsd)
      const hourlyYieldUsd = principalUsd > 0 && annualRate > 0
        ? (principalUsd * annualRate) / 8760
        : 0
      runningValueUsd = Math.max(0, runningValueUsd + hourlyYieldUsd)
      const valueUsd = runningValueUsd
      const yieldEarnedUsd = withdrawnUsd + valueUsd + claimedUsd - depositedUsd
      const dailyYieldUsd = principalUsd > 0 && annualRate > 0 ? (principalUsd * annualRate) / 365 : 0

      batchRows.push({
        userId,
        positionKey,
        snapshotAt: new Date(ts * 1000),
        quantity: position.quantity,
        priceUsd: position.price,
        valueUsd: round2(valueUsd),
        apyTotal: position.apy,
        apyBase: position.apyBase,
        apyReward: position.apyReward,
        depositedUsdCumulative: round2(depositedUsd),
        withdrawnUsdCumulative: round2(withdrawnUsd),
        claimedUsdCumulative: round2(claimedUsd),
        principalUsd: round2(principalUsd),
        yieldEarnedUsd: round2(yieldEarnedUsd),
        dailyYieldUsd: round2(dailyYieldUsd),
        dataConfidence: txRows.length > 0 ? "modeled" : "estimated",
        confidenceReason: txRows.length > 0
          ? "Historical transaction reconstruction"
          : "Backfilled APY interpolation",
        sourceMeta: {
          backfill: true,
          txRows: txRows.length,
          startedAt: positionStartTs,
        },
      })

      if (inserted + batchRows.length >= MAX_BACKFILL_ROWS) {
        hitCap = true
        break
      }

      if (batchRows.length >= 1000) {
        const batch = batchRows.splice(0, batchRows.length)
        await prisma.stakingPositionSnapshot.createMany({ data: batch, skipDuplicates: true })
        inserted += batch.length
      }
    }

    if (hitCap) break
  }

  if (batchRows.length > 0) {
    const batch = batchRows.splice(0, batchRows.length)
    await prisma.stakingPositionSnapshot.createMany({ data: batch, skipDuplicates: true })
    inserted += batch.length
  }

  if (hitCap) {
    await prisma.stakingSyncState.update({
      where: { userId },
      data: {
        status: "backfill_running",
        hourlyCursor: `batch_limit:${MAX_BACKFILL_ROWS}:inserted:${inserted}`,
      },
    })
    return
  }

  await prisma.stakingSyncState.update({
    where: { userId },
    data: {
      backfillCompletedAt: hasPendingWork ? new Date() : syncState.backfillCompletedAt ?? new Date(),
      status: "backfill_done",
      hourlyCursor: null,
    },
  })
}
