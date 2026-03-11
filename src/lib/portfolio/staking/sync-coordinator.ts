/**
 * Main staking lifecycle sync coordinator.
 * Orchestrates position upserts, snapshots, flow reconstruction, and backfill.
 * Per-position logic lives in position-sync.ts.
 */

import { db } from "@/lib/db"
import {
  buildPositionKey,
  hourStart,
  getTxChain,
  walletChainKey,
  DUST_USD_THRESHOLD,
} from "./constants"
import {
  toRecordFromDb,
  diagnoseTransactionGaps,
} from "./db-record-conversion"
import { buildTxContext } from "./db-tx-context"
import { computeYearlySummary, getDefaultSummary, maybeBackfill, discoverHistoricalClosedCandidates } from "./db-summary-backfill"
import { resolveUnpricedTransactions } from "../price-resolver"
import { backfillFromExplorer } from "./etherscan-fallback"
import { applyPositionSync } from "./position-sync"
import type { YieldSource } from "../yields"
import type {
  LifecyclePositionInput,
  LifecycleMetrics,
  LifecycleSyncResult,
  RewardLike,
} from "./types"

// ─── Prisma delegate type ───
type PrismaClient = typeof db & Record<string, any>

// ─── Price resolution cooldown (skip if last attempt resolved 0) ───
const priceResolutionCooldown = new Map<string, { at: number; count: number }>()
const PRICE_COOLDOWN_MS = 10 * 60_000 // 10 minutes

// ─── Coordinator ───

export async function syncStakingLifecycle(
  userId: string,
  currentPositions: LifecyclePositionInput[],
  rewards: RewardLike[] = [],
): Promise<LifecycleSyncResult> {
  const emptyResult: LifecycleSyncResult = {
    metricsByKey: new Map(),
    closedRows: [],
    summary: getDefaultSummary(),
  }

  const prisma = db as PrismaClient

  let existingRows: Record<string, unknown>[] = []
  try {
    existingRows = await prisma.stakingPosition.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    })
  } catch {
    return emptyResult
  }

  const existingMap = new Map<string, Record<string, unknown>>(
    existingRows.map((row) => [String(row.positionKey), row]),
  )

  const normalizedCurrent = currentPositions.map((p) => ({
    ...p,
    positionKey: p.positionKey ?? buildPositionKey(p),
  }))
  const currentKeySet = new Set(normalizedCurrent.map((p) => p.positionKey!))
  const existingKeySet = new Set(existingRows.map((row) => String(row.positionKey)))
  const discoveredHistorical = await discoverHistoricalClosedCandidates(
    userId, currentKeySet, existingKeySet,
  )
  if (discoveredHistorical.length > 0) {
    console.log(`[staking-lifecycle] discovered ${discoveredHistorical.length} historical staking candidate(s)`)
  }

  const syntheticExisting = existingRows.map((row) => ({
    positionKey: row.positionKey as string,
    wallet: row.wallet as string,
    chain: row.chain as string,
    symbol: row.symbol as string,
    name: row.name as string,
    protocol: (row.protocol as string | null) ?? null,
    defiProject: (row.providerSlug as string | null) ?? null,
    underlying: (row.underlying as string | null) ?? null,
    contractAddress: (row.contractAddress as string | null) ?? null,
    quantity: Number(row.quantity ?? 0),
    price: Number(row.priceUsd ?? 0),
    value: Number(row.valueUsd ?? 0),
    apy: (row.apy as number | null) ?? null,
    apyBase: (row.apyBase as number | null) ?? null,
    apyReward: (row.apyReward as number | null) ?? null,
    annualYield: (row.annualYield as number | null) ?? null,
    dailyYield: (row.dailyYield as number | null) ?? null,
    maturityDate: row.maturityDate ? new Date(row.maturityDate as string | number).toISOString() : null,
    yieldSource: null as YieldSource | null,
  }))

  const aggregateInputs = new Map<string, LifecyclePositionInput>()
  for (const p of [...normalizedCurrent, ...syntheticExisting, ...discoveredHistorical]) {
    aggregateInputs.set(p.positionKey!, p)
  }

  // Self-healing: resolve unpriced transactions before flow reconstruction
  // Skip if last attempt resolved 0 and cooldown hasn't elapsed
  try {
    const cooldown = priceResolutionCooldown.get(userId)
    const skipResolution = cooldown
      && cooldown.count === 0
      && Date.now() - cooldown.at < PRICE_COOLDOWN_MS

    if (!skipResolution) {
      const unpricedCount = await prisma.transactionCache.count({
        where: { userId, usdValue: null, value: { not: null } },
      })
      // Skip bulk resolution in the read path — too many unpriced txs will hang the request
      if (unpricedCount > 0 && unpricedCount <= 200) {
        console.log(`[staking-lifecycle] resolving ${unpricedCount} unpriced transactions before flow reconstruction`)
        const result = await resolveUnpricedTransactions(userId)
        console.log(`[staking-lifecycle] price resolution: ${result.resolved} resolved, ${result.failed} failed of ${result.total}`)
        priceResolutionCooldown.set(userId, { at: Date.now(), count: result.resolved })
      } else if (unpricedCount > 200) {
        console.log(`[staking-lifecycle] skipping price resolution (${unpricedCount} unpriced txs — too many for read path)`)
        priceResolutionCooldown.set(userId, { at: Date.now(), count: 0 })
      }
    }
  } catch (err) {
    console.warn("[staking-lifecycle] price resolution skipped:", err)
  }

  // Diagnostic: log per-position transaction gaps for debugging
  try {
    const diagnostics = await diagnoseTransactionGaps(userId, Array.from(aggregateInputs.values()))
    if (diagnostics.unpricedTotal > 0 || diagnostics.positionGaps.some((g) => g.unpricedTxs > 0)) {
      console.log(`[staking-lifecycle] diagnostics: ${diagnostics.unpricedTotal} total unpriced txs`)
      for (const gap of diagnostics.positionGaps) {
        if (gap.totalTxs > 0 || gap.unpricedTxs > 0) {
          console.log(`[staking-lifecycle]   ${gap.symbol} (${gap.chain}): ${gap.totalTxs} txs, ${gap.pricedTxs} priced, ${gap.unpricedTxs} unpriced`)
        }
      }
      const incompleteSyncs = diagnostics.syncStates.filter((s) => !s.isComplete)
      if (incompleteSyncs.length > 0) {
        console.log(`[staking-lifecycle]   ${incompleteSyncs.length} wallet/chain sync(s) incomplete`)
      }
    }
  } catch (err) {
    console.warn("[staking-lifecycle] diagnostics skipped:", err)
  }

  let txContext = await buildTxContext(userId, Array.from(aggregateInputs.values()))

  // Etherscan fallback: for positions with zero transactions and a contract address,
  // try fetching token transfers from block explorer API
  let explorerBackfilled = false
  try {
    const positionsWithNoTxs = Array.from(aggregateInputs.values()).filter((p) => {
      if (!p.contractAddress) return false
      const txChain = getTxChain(p.chain)
      if (!txChain) return false
      const wcKey = walletChainKey(p.wallet, txChain)
      const entries = txContext.byWalletChain.get(wcKey) ?? []
      return entries.length === 0
    })

    // Cap explorer backfill to avoid hanging the read path
    const backfillCandidates = positionsWithNoTxs.slice(0, 5)
    if (backfillCandidates.length > 0) {
      console.log(`[staking-lifecycle] ${backfillCandidates.length} position(s) have zero txs — trying explorer fallback`)
      for (const p of backfillCandidates) {
        const result = await backfillFromExplorer(userId, p.wallet, p.chain, p.contractAddress!)
        if (result.inserted > 0) explorerBackfilled = true
        if (result.error) console.warn(`[staking-lifecycle] explorer fallback for ${p.symbol}: ${result.error}`)
      }

      if (explorerBackfilled) {
        await resolveUnpricedTransactions(userId)
        txContext = await buildTxContext(userId, Array.from(aggregateInputs.values()))
        console.log(`[staking-lifecycle] rebuilt txContext after explorer backfill`)
      }
    }
  } catch (err) {
    console.warn("[staking-lifecycle] explorer fallback skipped:", err)
  }

  const now = new Date()
  const snapAt = hourStart(now)
  const nowIso = now.toISOString()
  const metricsByKey = new Map<string, LifecycleMetrics>()

  const applyForPosition = async (position: LifecyclePositionInput) => {
    await applyPositionSync(
      prisma, userId, position, existingMap, txContext, rewards,
      now, snapAt, nowIso, metricsByKey,
    )
  }

  for (const position of normalizedCurrent) {
    await applyForPosition(position)
  }

  for (const position of discoveredHistorical) {
    await applyForPosition(position)
  }

  for (const row of existingRows) {
    if (currentKeySet.has(String(row.positionKey))) continue

    const missingPosition: LifecyclePositionInput = {
      positionKey: row.positionKey as string,
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
      annualYield: 0,
      dailyYield: 0,
      maturityDate: row.maturityDate ? new Date(row.maturityDate as string | number).toISOString() : null,
      yieldSource: null,
    }

    await applyForPosition(missingPosition)
  }

  try {
    await maybeBackfill(userId, Array.from(aggregateInputs.values()))
  } catch (err) {
    console.warn("[staking-lifecycle] Backfill skipped:", err)
  }

  const closedRows = await prisma.stakingPosition.findMany({
    where: { userId, status: "closed" },
    orderBy: { updatedAt: "desc" },
  })

  await prisma.stakingSyncState.upsert({
    where: { userId },
    create: { userId, lastHourlySnapshotAt: now, status: "hourly_ok" },
    update: { lastHourlySnapshotAt: now, status: "hourly_ok" },
  })

  const summary = await computeYearlySummary(userId)

  return {
    metricsByKey,
    closedRows: (closedRows as Record<string, unknown>[]).map(toRecordFromDb),
    summary,
  }
}
