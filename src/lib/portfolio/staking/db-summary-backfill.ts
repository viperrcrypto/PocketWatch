/**
 * Yearly summary computation and historical closed position discovery.
 * Backfill logic lives in db-backfill.ts.
 */

import { db } from "@/lib/db"
import {
  round2,
  buildPositionKey,
  ZERION_TO_TX_CHAIN,
  TX_TO_ZERION_CHAIN,
} from "./constants"
import { DEFI_PROTOCOLS, getUnderlyingSymbol } from "../defi-yields"
import type {
  LifecyclePositionInput,
  LifecycleSyncSummary,
  StakingDataConfidence,
} from "./types"

// Re-export backfill from its own file
export { maybeBackfill } from "./db-backfill"

// ─── Prisma delegate type ───
type PrismaClient = typeof db & Record<string, any>

// ─── Yearly summary ───

export function getDefaultSummary(): LifecycleSyncSummary {
  return {
    yieldEarnedAllTimeUsd: 0,
    yieldEarnedYtdUsd: 0,
    yearlyYield: [],
    coverage: { exactPct: 0, modeledPct: 0, estimatedPct: 0 },
    counts: { exact: 0, modeled: 0, estimated: 0, total: 0 },
  }
}

export async function computeYearlySummary(userId: string): Promise<LifecycleSyncSummary> {
  const prisma = db as PrismaClient
  const summary = getDefaultSummary()

  // Fetch excluded position keys to filter from yield totals
  const excludedRows = await prisma.stakingPosition.findMany({
    where: { userId, excludeFromYield: true },
    select: { positionKey: true },
  })
  const excludedKeys = new Set(excludedRows.map((r: { positionKey: string }) => r.positionKey))

  const rows = await prisma.stakingPositionSnapshot.findMany({
    where: { userId },
    select: {
      positionKey: true,
      snapshotAt: true,
      yieldEarnedUsd: true,
      dataConfidence: true,
      sourceMeta: true,
    },
    orderBy: [{ positionKey: "asc" }, { snapshotAt: "asc" }],
  })

  if (rows.length === 0) return summary

  const byYearPos = new Map<string, { first: number; last: number; year: number }>()
  const lastByPosition = new Map<string, number>()
  const ytdByPosition = new Map<string, { first: number; last: number }>()
  const currentYear = new Date().getUTCFullYear()

  let exact = 0
  let modeled = 0
  let estimated = 0

  for (const row of rows) {
    const sourceMeta = ((row as Record<string, unknown>).sourceMeta ?? {}) as Record<string, unknown>
    const yieldMetricsState = typeof sourceMeta.yieldMetricsState === "string"
      ? sourceMeta.yieldMetricsState
      : "valid"
    if (yieldMetricsState !== "valid") continue

    const key = String((row as Record<string, unknown>).positionKey)
    if (excludedKeys.has(key)) continue
    const year = new Date((row as Record<string, unknown>).snapshotAt as string | number).getUTCFullYear()
    const value = Number((row as Record<string, unknown>).yieldEarnedUsd ?? 0)

    const ypKey = `${year}:${key}`
    const prev = byYearPos.get(ypKey)
    if (!prev) {
      byYearPos.set(ypKey, { first: value, last: value, year })
    } else {
      byYearPos.set(ypKey, { ...prev, last: value })
    }

    lastByPosition.set(key, value)

    if (year === currentYear) {
      const ytd = ytdByPosition.get(key)
      if (!ytd) ytdByPosition.set(key, { first: value, last: value })
      else ytdByPosition.set(key, { first: ytd.first, last: value })
    }

    const conf = String((row as Record<string, unknown>).dataConfidence ?? "estimated") as StakingDataConfidence
    if (conf === "exact") exact++
    else if (conf === "modeled") modeled++
    else estimated++
  }

  const yearlyMap = new Map<number, number>()
  for (const item of byYearPos.values()) {
    const earned = item.last - item.first
    yearlyMap.set(item.year, (yearlyMap.get(item.year) ?? 0) + earned)
  }

  summary.yearlyYield = Array.from(yearlyMap.entries())
    .map(([year, earnedUsd]) => ({ year, earnedUsd: round2(earnedUsd) }))
    .sort((a, b) => b.year - a.year)

  summary.yieldEarnedAllTimeUsd = round2(
    Array.from(lastByPosition.values()).reduce((acc, v) => acc + v, 0),
  )

  summary.yieldEarnedYtdUsd = round2(
    Array.from(ytdByPosition.values()).reduce((acc, v) => acc + (v.last - v.first), 0),
  )

  // Position-based YTD fallback when snapshot delta is 0 (sparse snapshots)
  if (summary.yieldEarnedYtdUsd === 0) {
    const positions = await prisma.stakingPosition.findMany({
      where: { userId, excludeFromYield: false },
      select: {
        openedAt: true, closedAt: true,
        yieldEarnedUsd: true, metadata: true,
      },
    })

    const yearStart = new Date(Date.UTC(currentYear, 0, 1))
    const now = new Date()
    let ytdSum = 0

    for (const pos of positions) {
      const meta = ((pos as Record<string, unknown>).metadata ?? {}) as Record<string, unknown>
      const ms = meta.yieldMetricsState
      if (ms && ms !== "valid" && ms !== "clamped") continue

      const earned = Number((pos as Record<string, unknown>).yieldEarnedUsd ?? 0)
      if (earned === 0) continue

      const opened = pos.openedAt ? new Date(pos.openedAt as unknown as string) : yearStart
      const closed = pos.closedAt ? new Date(pos.closedAt as unknown as string) : now

      if (closed < yearStart) continue

      const totalMs = Math.max(closed.getTime() - opened.getTime(), 86_400_000)
      const overlapStart = opened > yearStart ? opened : yearStart
      const overlapEnd = closed < now ? closed : now
      const overlapMs = Math.max(overlapEnd.getTime() - overlapStart.getTime(), 0)

      if (overlapMs > 0) {
        ytdSum += earned * (overlapMs / totalMs)
      }
    }

    summary.yieldEarnedYtdUsd = round2(ytdSum)
  }

  const total = exact + modeled + estimated
  summary.counts = { exact, modeled, estimated, total }
  summary.coverage = {
    exactPct: total > 0 ? round2((exact / total) * 100) : 0,
    modeledPct: total > 0 ? round2((modeled / total) * 100) : 0,
    estimatedPct: total > 0 ? round2((estimated / total) * 100) : 0,
  }

  return summary
}

// ─── Historical closed position discovery ───

function inferDefiFromSymbol(symbol: string): {
  protocol: string | null
  project: string | null
  underlying: string | null
} {
  for (const def of DEFI_PROTOCOLS) {
    if (def.pattern.test(symbol)) {
      return {
        protocol: def.protocol,
        project: def.project,
        underlying: getUnderlyingSymbol(symbol),
      }
    }
  }
  return { protocol: null, project: null, underlying: null }
}

function getZerionChainFromTx(txChain: string): string | null {
  return TX_TO_ZERION_CHAIN[txChain] ?? null
}

export async function discoverHistoricalClosedCandidates(
  userId: string,
  currentKeys: Set<string>,
  existingKeys: Set<string>,
): Promise<LifecyclePositionInput[]> {
  const prisma = db as PrismaClient

  const txRows = await prisma.transactionCache.findMany({
    where: {
      userId,
      symbol: { not: null },
      chain: { in: Object.values(ZERION_TO_TX_CHAIN) },
    },
    select: {
      walletAddress: true,
      chain: true,
      symbol: true,
      asset: true,
    },
    orderBy: { blockTimestamp: "desc" },
    take: 20_000,
  })

  const discovered: LifecyclePositionInput[] = []
  const seen = new Set<string>()

  for (const row of txRows) {
    const rawSymbol = String((row as Record<string, unknown>).symbol ?? "").trim()
    if (!rawSymbol) continue

    const { protocol, project, underlying } = inferDefiFromSymbol(rawSymbol)
    if (!protocol || !project) continue

    const zerionChain = getZerionChainFromTx(String((row as Record<string, unknown>).chain ?? ""))
    if (!zerionChain) continue

    const wallet = String((row as Record<string, unknown>).walletAddress ?? "").toLowerCase()
    if (!wallet) continue

    const asset = (row as Record<string, unknown>).asset
    const contractAddress = asset && asset !== "native"
      ? String(asset).toLowerCase()
      : null

    const positionKey = buildPositionKey({
      wallet,
      chain: zerionChain,
      protocol,
      symbol: rawSymbol,
      contractAddress,
    })

    if (currentKeys.has(positionKey) || existingKeys.has(positionKey) || seen.has(positionKey)) {
      continue
    }
    seen.add(positionKey)

    discovered.push({
      positionKey,
      wallet,
      chain: zerionChain,
      symbol: rawSymbol,
      name: rawSymbol,
      protocol,
      defiProject: project,
      underlying,
      contractAddress,
      quantity: 0,
      price: 0,
      value: 0,
      apy: null,
      apyBase: null,
      apyReward: null,
      annualYield: 0,
      dailyYield: 0,
      maturityDate: null,
      yieldSource: null,
    })
  }

  return discovered
}
