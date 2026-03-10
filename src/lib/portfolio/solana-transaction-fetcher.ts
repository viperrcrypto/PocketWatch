/**
 * Solana transaction fetcher using the Helius Enhanced Transactions API.
 *
 * Design:
 * - Two-phase fetch: main wallet address + Associated Token Accounts (ATAs)
 * - Helius /v0/addresses/{addr}/transactions for main address (outgoing + SOL)
 * - Solana RPC getSignaturesForAddress on ATAs for incoming SPL transfers
 * - Helius /v0/transactions to enrich ATA signatures
 * - Bounded step execution matching the EVM fetcher pattern
 * - Writes to TransactionCache as the single source of truth
 */

import { db } from "@/lib/db"
import { isProviderThrottleError, withProviderPermitRotating } from "./provider-governor"
import type { ServiceKeyEntry } from "./service-keys"
import { heliusTxToRecords } from "./solana-tx-mapper"
import type { HeliusTransaction, TransactionCacheRecord } from "./solana-tx-mapper"
import type { WalletChainSyncResult, SyncErrorDetail } from "./transaction-fetcher"
import { fetchATATransactions, backfillSPLSymbols } from "./solana-ata-fetcher"

export { heliusTxToRecords } from "./solana-tx-mapper"
export type { HeliusTransaction, TransactionCacheRecord } from "./solana-tx-mapper"

const MAX_STEP_REQUESTS_DEFAULT = 10
const MAX_STEP_MS_DEFAULT = 7_000
const HELIUS_PAGE_LIMIT = 100

function classifyHeliusError(status: number | undefined, message: string): SyncErrorDetail {
  const lower = message.toLowerCase()

  if (status === 401 || status === 403 || lower.includes("unauthorized") || lower.includes("invalid api key")) {
    return { code: "helius_unauthorized", message, status, retryable: false }
  }

  if (status === 429 || lower.includes("rate") || lower.includes("too many requests")) {
    return { code: "helius_rate_limited", message, status, retryable: true, retryAfterSec: 90 }
  }

  if (status && status >= 500) {
    return { code: "helius_upstream_error", message, status, retryable: true, retryAfterSec: 60 }
  }

  return { code: "helius_error", message, status, retryable: true, retryAfterSec: 45 }
}

function throttleDetailFromError(error: unknown, fallbackMessage: string): SyncErrorDetail {
  if (isProviderThrottleError(error)) {
    const retryAfterSec = error.nextAllowedAt
      ? Math.min(300, Math.max(5, Math.ceil((error.nextAllowedAt.getTime() - Date.now()) / 1000)))
      : 90
    return { code: "helius_rate_limited", message: error.message, status: 429, retryable: true, retryAfterSec }
  }
  const status = error != null && typeof error === "object" && typeof (error as Record<string, unknown>).status === "number"
    ? (error as { status: number }).status
    : undefined
  return classifyHeliusError(status, error instanceof Error ? error.message : fallbackMessage)
}

/**
 * Execute a bounded sync step for one Solana wallet.
 * Safe for the background worker to call repeatedly.
 *
 * Two phases:
 * 1. "fetching" -- main wallet address via Helius (outgoing + SOL transfers)
 * 2. "fetching-atas" -- incoming SPL transfers via ATA signatures + Helius parsing
 */
export async function syncSolanaWalletStep(options: {
  userId: string
  walletAddress: string
  heliusKeys: ServiceKeyEntry[]
  maxRequests?: number
  maxMs?: number
}): Promise<WalletChainSyncResult> {
  const {
    userId,
    walletAddress,
    heliusKeys,
    maxRequests = MAX_STEP_REQUESTS_DEFAULT,
    maxMs = MAX_STEP_MS_DEFAULT,
  } = options

  // Solana addresses are case-sensitive -- store as-is (not lowercased)
  const addr = walletAddress

  const state = await db.transactionSyncState.upsert({
    where: { userId_walletAddress_chain: { userId, walletAddress: addr, chain: "SOLANA" } },
    update: {},
    create: {
      userId,
      walletAddress: addr,
      chain: "SOLANA",
      lastBlockFetched: 0,
      isComplete: false,
      phase: "bootstrap",
      cursorFromBlock: null,
      cursorToBlock: null,
      pageKey: null,
      retryAfter: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      requestsProcessed: 0,
      recordsInserted: 0,
    },
  })

  if (state.retryAfter && state.retryAfter.getTime() > Date.now()) {
    return {
      wallet: addr,
      chain: "SOLANA",
      newTransactions: 0,
      requestsProcessed: 0,
      isComplete: state.isComplete,
      errors: state.lastErrorCode
        ? [{ code: state.lastErrorCode, message: state.lastErrorMessage ?? "Blocked by retry window", retryable: true }]
        : [],
      blockedUntil: state.retryAfter.toISOString(),
    }
  }

  let phase = state.phase
  let pageKey = state.pageKey
  let isComplete = state.isComplete
  let requestsProcessed = state.requestsProcessed
  let recordsInserted = state.recordsInserted
  let retryAfter: Date | null = null
  let lastErrorCode: string | null = null
  let lastErrorMessage: string | null = null
  let highWaterMark: number | null = state.highWaterMark ?? null
  const syncMode = state.syncMode ?? "historical"

  const errors: SyncErrorDetail[] = []
  let totalNew = 0
  let stepRequests = 0
  const startedAtMs = Date.now()

  // Bootstrap: reset phase to "fetching"
  if (!isComplete && phase === "bootstrap") {
    phase = "fetching"
    pageKey = null
    retryAfter = null
    lastErrorCode = null
    lastErrorMessage = null
  }

  // -- Phase 1: Main address fetch via Helius --
  while (phase === "fetching" && errors.length === 0 && stepRequests < maxRequests && Date.now() - startedAtMs < maxMs) {
    let res: Response
    try {
      res = await withProviderPermitRotating(
        userId, "helius", `solana-txs:${addr}`, undefined, heliusKeys,
        async (keyEntry) => {
          const url = `https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${keyEntry.key}&limit=${HELIUS_PAGE_LIMIT}${pageKey ? `&before=${pageKey}` : ""}`
          const r = await fetch(url, { signal: AbortSignal.timeout(15_000) })
          if (!r.ok) {
            const body = await r.text().catch(() => "")
            throw Object.assign(new Error(`Helius ${r.status}: ${body.slice(0, 180)}`), { status: r.status })
          }
          return r
        }
      )
    } catch (err) {
      const detail = throttleDetailFromError(err, "Helius request failed")
      errors.push(detail)
      if (detail.retryable) {
        retryAfter = new Date(Date.now() + (detail.retryAfterSec ?? 60) * 1000)
      } else {
        isComplete = true
        phase = "failed"
      }
      lastErrorCode = detail.code
      lastErrorMessage = detail.message
      break
    }

    stepRequests += 1
    requestsProcessed += 1

    const heliusTxs: HeliusTransaction[] = await res.json()

    if (!heliusTxs || heliusTxs.length === 0) {
      phase = "fetching-atas"
      break
    }

    const allRecords: TransactionCacheRecord[] = []
    let hitKnown = false

    let knownSigs: Set<string> | null = null
    if (syncMode === "incremental") {
      const sigs = heliusTxs.map((htx) => htx.signature)
      const existing = await db.transactionCache.findMany({
        where: { userId, chain: "SOLANA", txHash: { in: sigs } },
        select: { txHash: true },
        distinct: ["txHash"],
      })
      knownSigs = new Set(existing.map((e) => e.txHash))
    }

    for (const htx of heliusTxs) {
      if (knownSigs?.has(htx.signature)) {
        hitKnown = true
        break
      }
      const records = heliusTxToRecords(htx, userId, addr)
      allRecords.push(...records)
    }

    await backfillSPLSymbols(allRecords)

    if (allRecords.length > 0) {
      const result = await db.transactionCache.createMany({ data: allRecords, skipDuplicates: true })
      totalNew += result.count
      recordsInserted += result.count
    }

    if (hitKnown) {
      phase = "fetching-atas"
      break
    }

    pageKey = heliusTxs[heliusTxs.length - 1]?.signature ?? null

    if (heliusTxs.length < HELIUS_PAGE_LIMIT) {
      phase = "fetching-atas"
      break
    }
  }

  // -- Phase 2: ATA fetch for incoming SPL transfers --
  if (phase === "fetching-atas" && errors.length === 0 && Date.now() - startedAtMs < maxMs) {
    const ataResult = await fetchATATransactions({
      userId,
      walletAddress: addr,
      heliusKeys,
      syncMode,
      maxSignaturesPerATA: syncMode === "incremental" ? 50 : 200,
    })

    totalNew += ataResult.newRecords
    recordsInserted += ataResult.newRecords
    stepRequests += ataResult.requestsUsed
    requestsProcessed += ataResult.requestsUsed

    if (ataResult.errors.length > 0) {
      for (const e of ataResult.errors) {
        errors.push(e)
      }
    }

    isComplete = true
    phase = "completed"
    highWaterMark = 1
  }

  // Persist state
  await db.transactionSyncState.update({
    where: { userId_walletAddress_chain: { userId, walletAddress: addr, chain: "SOLANA" } },
    data: {
      lastBlockFetched: 0,
      isComplete,
      phase,
      cursorFromBlock: 0,
      cursorToBlock: 0,
      pageKey,
      retryAfter,
      lastErrorCode,
      lastErrorMessage,
      requestsProcessed,
      recordsInserted,
      highWaterMark,
      syncMode,
    },
  })

  return {
    wallet: addr,
    chain: "SOLANA",
    newTransactions: totalNew,
    requestsProcessed: stepRequests,
    isComplete,
    errors,
    blockedUntil: retryAfter?.toISOString() ?? null,
  }
}
