/**
 * Unified event history — query building and response assembly.
 * Row mappers live in event-history-mappers.ts.
 */

import { db } from "@/lib/db"
import {
  type UnifiedHistoryEntry,
  mapOnchainRows,
  mapExchangeRows,
} from "./event-history-mappers"

// ─── Re-exports for route consumers ─────────────────────────────

export type { UnifiedHistoryEntry } from "./event-history-mappers"
export { buildExplorerUrl } from "./event-history-mappers"

export type HistorySource = "onchain" | "exchange" | "all"

export interface UnifiedHistoryParams {
  offset: number
  limit: number
  source: HistorySource
  exchangeId?: string
  event_type?: string
  classification?: string
  asset?: string
  search?: string
  from_timestamp?: number
  to_timestamp?: number
  wallet_address?: string
}

export function normalizeSource(value: string | null): HistorySource {
  const lower = (value ?? "all").toLowerCase()
  if (lower === "onchain" || lower === "exchange") return lower
  return "all"
}

// ─── Where-clause builders ───────────────────────────────────────

function buildOnchainEventWhere(params: {
  userId: string
  walletAddresses: string[]
  fromTimestamp?: number
  toTimestamp?: number
  asset?: string
  eventType?: string
  search?: string
  classification?: string
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: params.userId }

  if (params.walletAddresses.length > 0) {
    where.walletAddress = { in: params.walletAddresses }
  }

  if (params.fromTimestamp !== undefined || params.toTimestamp !== undefined) {
    where.blockTimestamp = {}
    if (params.fromTimestamp !== undefined) where.blockTimestamp.gte = params.fromTimestamp
    if (params.toTimestamp !== undefined) where.blockTimestamp.lte = params.toTimestamp
  }

  if (params.eventType === "send") where.direction = "out"
  if (params.eventType === "receive") where.direction = "in"

  const VALID_CLASSIFICATIONS = new Set([
    "internal_transfer", "swap", "inflow", "outflow", "yield", "gas", "spam",
  ])
  if (params.classification && VALID_CLASSIFICATIONS.has(params.classification)) {
    where.txClassification = params.classification
  }

  const andClauses: Array<Record<string, unknown>> = []

  if (params.asset?.trim()) {
    const q = params.asset.trim()
    andClauses.push({ OR: [
      { symbol: { contains: q, mode: "insensitive" } },
      { asset: { contains: q, mode: "insensitive" } },
    ]})
  }

  if (params.search?.trim()) {
    const q = params.search.trim()
    andClauses.push({ OR: [
      { txHash: { startsWith: q, mode: "insensitive" } },
      { from: { startsWith: q, mode: "insensitive" } },
      { to: { startsWith: q, mode: "insensitive" } },
    ]})
  }

  if (andClauses.length > 0) where.AND = andClauses

  return where
}

function buildExchangeEventWhere(params: {
  userId: string
  exchangeId?: string
  fromTimestamp?: number
  toTimestamp?: number
  asset?: string
  eventType?: string
}) {
  const where: {
    userId: string
    exchangeId?: string
    timestamp?: { gte?: number; lte?: number }
    currency?: { contains: string; mode: "insensitive" }
    type?: "deposit" | "withdrawal" | "trade"
  } = {
    userId: params.userId,
  }

  if (params.exchangeId) where.exchangeId = params.exchangeId

  if (params.fromTimestamp !== undefined || params.toTimestamp !== undefined) {
    where.timestamp = {}
    if (params.fromTimestamp !== undefined) where.timestamp.gte = params.fromTimestamp
    if (params.toTimestamp !== undefined) where.timestamp.lte = params.toTimestamp
  }

  if (params.asset?.trim()) {
    where.currency = { contains: params.asset.trim(), mode: "insensitive" }
  }

  if (params.eventType === "deposit" || params.eventType === "withdrawal" || params.eventType === "trade") {
    where.type = params.eventType
  }

  return where
}

// ─── Data fetchers ───────────────────────────────────────────────

async function fetchOnchainEntries(userId: string, params: UnifiedHistoryParams, fetchLimit: number) {
  const wallets = await db.trackedWallet.findMany({
    where: { userId },
    select: { address: true },
    orderBy: { createdAt: "asc" },
  })

  const rawAddresses = params.wallet_address
    ? wallets.map((w) => w.address).filter((a) => a.toLowerCase() === params.wallet_address!.toLowerCase())
    : wallets.map((w) => w.address)
  const walletAddresses = [...new Set(rawAddresses.flatMap((a) => [a, a.toLowerCase()]))]

  const onchainWhere = buildOnchainEventWhere({
    userId, walletAddresses,
    fromTimestamp: params.from_timestamp, toTimestamp: params.to_timestamp,
    asset: params.asset, eventType: params.event_type,
    search: params.search, classification: params.classification,
  })

  const [rows, count] = await Promise.all([
    db.transactionCache.findMany({
      where: onchainWhere,
      orderBy: { blockTimestamp: "desc" },
      take: fetchLimit,
    }),
    db.transactionCache.count({ where: onchainWhere }),
  ])

  const entries = mapOnchainRows(rows)
  // Adjust count for collapsed rows (swaps + gas folded into parent)
  const collapseRatio = rows.length > 0 ? entries.length / rows.length : 1
  const adjustedCount = Math.round(count * collapseRatio)
  return { entries, count: adjustedCount }
}

async function fetchExchangeEntries(userId: string, params: UnifiedHistoryParams, fetchLimit: number) {
  const exchangeWhere = buildExchangeEventWhere({
    userId, exchangeId: params.exchangeId,
    fromTimestamp: params.from_timestamp, toTimestamp: params.to_timestamp,
    asset: params.asset, eventType: params.event_type,
  })

  const [rows, count] = await Promise.all([
    db.exchangeTransactionCache.findMany({
      where: exchangeWhere,
      orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
      take: fetchLimit,
    }),
    db.exchangeTransactionCache.count({ where: exchangeWhere }),
  ])

  return { entries: mapExchangeRows(rows), count }
}

// ─── Main response builder ───────────────────────────────────────

export async function buildUnifiedHistoryResponse(userId: string, params: UnifiedHistoryParams) {
  const includeOnchain = params.source === "all" || params.source === "onchain"
  const includeExchange = params.source === "all" || params.source === "exchange"

  const onchainEventTypeUnsupported = !!params.event_type && params.event_type !== "send" && params.event_type !== "receive"
  const exchangeEventTypeUnsupported =
    !!params.event_type
    && params.event_type !== "deposit"
    && params.event_type !== "withdrawal"
    && params.event_type !== "trade"

  const fetchLimit = Math.min(10000, (params.offset + params.limit) * 2 + 500)

  let onchainEntries: UnifiedHistoryEntry[] = []
  let exchangeEntries: UnifiedHistoryEntry[] = []
  let onchainCount = 0
  let exchangeCount = 0

  if (includeOnchain && !onchainEventTypeUnsupported) {
    const result = await fetchOnchainEntries(userId, params, fetchLimit)
    onchainEntries = result.entries
    onchainCount = result.count
  }

  if (includeExchange && !exchangeEventTypeUnsupported) {
    const result = await fetchExchangeEntries(userId, params, fetchLimit)
    exchangeEntries = result.entries
    exchangeCount = result.count
  }

  const merged = [...onchainEntries, ...exchangeEntries].sort((a, b) => b.timestamp - a.timestamp)
  const entries = merged.slice(params.offset, params.offset + params.limit)

  const entriesTotal = onchainCount + exchangeCount
  const latestJob = await db.historySyncJob.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, status: true, processedSyncs: true,
      failedSyncs: true, insertedTxCount: true, updatedAt: true,
    },
  })

  const response: {
    entries: UnifiedHistoryEntry[]
    entries_found: number
    entries_total: number
    entries_limit: number
    source: HistorySource
    bySource: { onchain: number; exchange: number }
    syncJob: {
      id: string; status: string; processedSyncs: number
      failedSyncs: number; insertedTxCount: number; updatedAt: string
    } | null
    error?: string
    message?: string
  } = {
    entries,
    entries_found: entriesTotal,
    entries_total: entriesTotal,
    entries_limit: params.limit,
    source: params.source,
    bySource: { onchain: onchainCount, exchange: exchangeCount },
    syncJob: latestJob
      ? {
          id: latestJob.id, status: latestJob.status,
          processedSyncs: latestJob.processedSyncs, failedSyncs: latestJob.failedSyncs,
          insertedTxCount: latestJob.insertedTxCount, updatedAt: latestJob.updatedAt.toISOString(),
        }
      : null,
  }

  if (entriesTotal === 0 && includeOnchain) {
    response.error = "no_data"
    response.message = "No cached on-chain events yet. Click \"Process Events\" to start latest-first sync and backfill."
  }

  return response
}
