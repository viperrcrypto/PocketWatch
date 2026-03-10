/**
 * Exchange history helpers — query building, cache refresh, and response formatting.
 * Extracted from the exchange history API route to keep routes thin.
 */

import { db } from "@/lib/db"
import { fetchExchangeTransactions } from "@/lib/portfolio/exchange-client"
import { getAllExchangeCredentials } from "@/lib/portfolio/service-keys"
import { getExchangeById } from "@/lib/portfolio/exchanges"

// ─── Types ───────────────────────────────────────────────────────

export interface ExchangeHistoryFilters {
  exchangeId?: string
  type?: "deposit" | "withdrawal" | "trade"
  asset?: string
  fromTimestamp?: number
  toTimestamp?: number
  offset: number
  limit: number
}

interface ConnectedExchange {
  id: string
  label: string
  domain?: string
}

// ─── Timestamp helpers ───────────────────────────────────────────

export function normalizeTimestampToSec(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value >= 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value)
}

export function normalizeTimestampToMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value < 1_000_000_000_000 ? value * 1000 : value
}

export function parseTradeSideFromRaw(raw: unknown): "buy" | "sell" | null {
  if (!raw || typeof raw !== "object") return null
  const maybeSide = (raw as Record<string, unknown>).side
  if (typeof maybeSide !== "string") return null
  const normalized = maybeSide.toLowerCase()
  return normalized === "buy" || normalized === "sell" ? normalized : null
}

// ─── Filter parsing ──────────────────────────────────────────────

export function parseExchangeFilters(searchParams: URLSearchParams): ExchangeHistoryFilters {
  const rawType = searchParams.get("type")?.toLowerCase()
  const type =
    rawType === "deposit" || rawType === "withdrawal" || rawType === "trade"
      ? rawType
      : undefined

  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0)
  const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10) || 200))

  return {
    exchangeId: searchParams.get("exchangeId") || undefined,
    type,
    asset: searchParams.get("asset") || undefined,
    fromTimestamp: searchParams.has("from_timestamp") ? parseInt(searchParams.get("from_timestamp") ?? "0", 10) : undefined,
    toTimestamp: searchParams.has("to_timestamp") ? parseInt(searchParams.get("to_timestamp") ?? "0", 10) : undefined,
    offset,
    limit,
  }
}

// ─── Connected exchanges ─────────────────────────────────────────

async function getConnectedExchanges(userId: string): Promise<ConnectedExchange[]> {
  const rows = await db.externalApiKey.findMany({
    where: {
      userId,
      serviceName: { startsWith: "exchange_" },
    },
    select: { serviceName: true },
    orderBy: { serviceName: "asc" },
  })

  const unique = new Set<string>()
  const exchanges: ConnectedExchange[] = []

  for (const row of rows) {
    const id = row.serviceName.slice(9)
    if (!id || unique.has(id)) continue
    unique.add(id)

    const def = getExchangeById(id)
    exchanges.push({
      id,
      label: def?.label ?? id,
      domain: def?.domain,
    })
  }

  return exchanges
}

// ─── Response builder ────────────────────────────────────────────

export async function buildExchangeHistoryResponse(userId: string, filters: ExchangeHistoryFilters) {
  const [connected, syncStates] = await Promise.all([
    getConnectedExchanges(userId),
    db.exchangeSyncState.findMany({
      where: { userId },
      orderBy: { exchangeId: "asc" },
    }),
  ])

  const syncStateMap = new Map(syncStates.map((s) => [s.exchangeId, s]))

  const capabilities = connected.map((exchange) => {
    const state = syncStateMap.get(exchange.id)
    return {
      id: exchange.id,
      label: exchange.label,
      supportsDeposits: state?.supportsDeposits ?? false,
      supportsWithdrawals: state?.supportsWithdrawals ?? false,
      error: state?.error ?? undefined,
      syncStatus: state?.status ?? "idle",
      lastSyncedAt: state?.lastSyncedAt?.toISOString() ?? null,
      exchangeDomain: exchange.domain ?? null,
      connected: true,
    }
  })

  const where: {
    userId: string
    exchangeId?: string
    type?: "deposit" | "withdrawal" | "trade"
    timestamp?: { gte?: number; lte?: number }
    currency?: { contains: string; mode: "insensitive" }
  } = { userId }

  if (filters.exchangeId) where.exchangeId = filters.exchangeId
  if (filters.type) where.type = filters.type
  if (filters.fromTimestamp !== undefined || filters.toTimestamp !== undefined) {
    where.timestamp = {}
    if (filters.fromTimestamp !== undefined) where.timestamp.gte = normalizeTimestampToSec(filters.fromTimestamp)
    if (filters.toTimestamp !== undefined) where.timestamp.lte = normalizeTimestampToSec(filters.toTimestamp)
  }
  if (filters.asset?.trim()) {
    where.currency = { contains: filters.asset.trim(), mode: "insensitive" }
  }

  const [rows, total] = await Promise.all([
    db.exchangeTransactionCache.findMany({
      where,
      orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
      skip: filters.offset,
      take: filters.limit,
    }),
    db.exchangeTransactionCache.count({ where }),
  ])

  const transactions = rows.map((row) => ({
    id: row.externalId ?? row.id,
    txid: row.txid || null,
    timestamp: normalizeTimestampToMs(row.timestamp),
    type: row.type,
    side: row.type === "trade" ? parseTradeSideFromRaw(row.raw) : null,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    address: row.address || null,
    fee: row.fee,
    network: row.network,
    exchange: row.exchangeId,
    exchangeLabel: row.exchangeLabel,
  }))

  return {
    transactions,
    capabilities,
    entries_found: total,
    entries_total: total,
    offset: filters.offset,
    limit: filters.limit,
    source: "cache",
  }
}

// ─── Cache refresh ───────────────────────────────────────────────

export async function refreshExchangeCache(userId: string, targetExchangeId?: string) {
  const credentials = await getAllExchangeCredentials(userId)
  const filteredCreds = targetExchangeId
    ? credentials.filter((c) => c.exchangeId === targetExchangeId)
    : credentials

  if (filteredCreds.length === 0) {
    if (targetExchangeId) {
      await db.exchangeSyncState.upsert({
        where: { userId_exchangeId: { userId, exchangeId: targetExchangeId } },
        create: {
          userId,
          exchangeId: targetExchangeId,
          status: "error",
          error: "No credentials configured for this exchange",
        },
        update: {
          status: "error",
          error: "No credentials configured for this exchange",
        },
      })
    }
    return { inserted: 0, refreshedExchanges: 0, diagnostics: [] as Array<Record<string, unknown>> }
  }

  const now = new Date()

  await Promise.all(filteredCreds.map(({ exchangeId }) =>
    db.exchangeSyncState.upsert({
      where: { userId_exchangeId: { userId, exchangeId } },
      create: { userId, exchangeId, status: "syncing" },
      update: { status: "syncing", error: null },
    })
  ))

  let result: Awaited<ReturnType<typeof fetchExchangeTransactions>>
  try {
    result = await fetchExchangeTransactions(filteredCreds)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh failure"
    await Promise.all(filteredCreds.map(({ exchangeId }) =>
      db.exchangeSyncState.upsert({
        where: { userId_exchangeId: { userId, exchangeId } },
        create: {
          userId, exchangeId, status: "error",
          supportsDeposits: false, supportsWithdrawals: false,
          lastSyncedAt: now, error: message,
        },
        update: { status: "error", lastSyncedAt: now, error: message },
      })
    ))
    throw error
  }

  const capabilityMap = new Map(result.capabilities.map((cap) => [cap.id, cap]))
  const exchangeIds = [...new Set(filteredCreds.map((cred) => cred.exchangeId))]

  return persistRefreshResults(userId, exchangeIds, result.transactions, capabilityMap, now)
}

// ─── Persistence of refresh results ─────────────────────────────

async function persistRefreshResults(
  userId: string,
  exchangeIds: string[],
  transactions: Awaited<ReturnType<typeof fetchExchangeTransactions>>["transactions"],
  capabilityMap: Map<string, { id: string; supportsDeposits: boolean; supportsWithdrawals: boolean; supportsTrades: boolean; error?: string | null }>,
  now: Date,
) {
  const groupedRows = new Map<string, Array<{
    userId: string; exchangeId: string; exchangeLabel: string
    txid: string; externalId: string; timestamp: number
    type: "deposit" | "withdrawal" | "trade"
    amount: number; currency: string; status: string; address: string
    fee: number; network: string | null; source: string; usdValue: number | null
    raw: object
  }>>()
  const stats = new Map<string, { attempted: number; skippedInvalid: number; sanitized: number }>()

  for (const exchangeId of exchangeIds) {
    groupedRows.set(exchangeId, [])
    stats.set(exchangeId, { attempted: 0, skippedInvalid: 0, sanitized: 0 })
  }

  for (const tx of transactions) {
    const exchangeStats = stats.get(tx.exchange) ?? { attempted: 0, skippedInvalid: 0, sanitized: 0 }
    exchangeStats.attempted += 1
    stats.set(tx.exchange, exchangeStats)

    const timestampSec = normalizeTimestampToSec(tx.timestamp)
    const amount = typeof tx.amount === "number" ? tx.amount : parseFloat(String(tx.amount))
    const currency = tx.currency?.trim()

    if (!timestampSec || !Number.isFinite(amount) || amount <= 0 || !currency) {
      exchangeStats.skippedInvalid += 1
      continue
    }

    exchangeStats.sanitized += 1
    const rows = groupedRows.get(tx.exchange) ?? []
    rows.push({
      userId, exchangeId: tx.exchange, exchangeLabel: tx.exchangeLabel,
      txid: tx.txid ?? "", externalId: tx.id, timestamp: timestampSec,
      type: tx.type, amount, currency, status: tx.status || "ok",
      address: tx.address ?? "", fee: Number.isFinite(tx.fee) ? tx.fee : 0,
      network: tx.network ?? null, source: "exchange", usdValue: null,
      raw: tx as unknown as object,
    })
    groupedRows.set(tx.exchange, rows)
  }

  let inserted = 0
  const diagnostics: Array<{
    exchangeId: string; status: "synced" | "unsupported" | "error"; inserted: number
    attempted: number; sanitized: number; skippedInvalid: number
    supportsDeposits: boolean; supportsWithdrawals: boolean; supportsTrades: boolean
    error: string | null
  }> = []

  for (const exchangeId of exchangeIds) {
    const cap = capabilityMap.get(exchangeId)
    const rows = groupedRows.get(exchangeId) ?? []
    const exchangeStats = stats.get(exchangeId) ?? { attempted: 0, skippedInvalid: 0, sanitized: rows.length }
    let insertedForExchange = 0
    let insertError: string | null = null

    if (rows.length > 0) {
      try {
        await db.exchangeTransactionCache.deleteMany({ where: { userId, exchangeId } })
        const insertResult = await db.exchangeTransactionCache.createMany({
          data: rows,
          skipDuplicates: true,
        })
        insertedForExchange = insertResult.count
        inserted += insertResult.count
      } catch (error) {
        insertError = error instanceof Error ? error.message : "Failed to persist exchange history rows"
        console.error("[portfolio][history/exchange][E9074_INSERT_FAILED]", {
          userId, exchangeId, error: insertError,
        })
      }
    }

    const supportsDeposits = cap?.supportsDeposits ?? false
    const supportsWithdrawals = cap?.supportsWithdrawals ?? false
    const supportsTrades = cap?.supportsTrades ?? false
    const supportsAnyHistory = supportsDeposits || supportsWithdrawals || supportsTrades
    const capabilityError = cap?.error ?? null
    const combinedError = insertError ?? capabilityError

    const status = combinedError
      ? "error"
      : (!supportsAnyHistory ? "unsupported" : "synced")

    await db.exchangeSyncState.upsert({
      where: { userId_exchangeId: { userId, exchangeId } },
      create: {
        userId, exchangeId, status, supportsDeposits, supportsWithdrawals,
        lastSyncedAt: now, error: combinedError,
      },
      update: {
        status, supportsDeposits, supportsWithdrawals,
        lastSyncedAt: now, error: combinedError,
      },
    })

    console.info("[portfolio][history/exchange][E9076_REFRESH_EXCHANGE]", {
      userId, exchangeId, status,
      attempted: exchangeStats.attempted, sanitized: exchangeStats.sanitized,
      skippedInvalid: exchangeStats.skippedInvalid, inserted: insertedForExchange,
      supportsDeposits, supportsWithdrawals, supportsTrades, error: combinedError,
    })

    diagnostics.push({
      exchangeId, status, inserted: insertedForExchange,
      attempted: exchangeStats.attempted, sanitized: exchangeStats.sanitized,
      skippedInvalid: exchangeStats.skippedInvalid,
      supportsDeposits, supportsWithdrawals, supportsTrades, error: combinedError,
    })
  }

  console.info("[portfolio][history/exchange][E9075_REFRESH_SUMMARY]", {
    userId, targetExchangeId: null, inserted, refreshedExchanges: exchangeIds.length, diagnostics,
  })

  return { inserted, refreshedExchanges: exchangeIds.length, diagnostics }
}
