/**
 * Zerion-based EVM transaction history sync.
 *
 * Replaces the Alchemy 8-phase-per-chain approach with a single multi-chain call.
 * One TransactionSyncState row per wallet (chain="ZERION_MULTI") instead of one per chain.
 *
 * Advantages over Alchemy:
 * - Covers 20+ chains in one request (no per-chain phases)
 * - Returns USD price at time of transaction
 * - Simple cursor pagination (no block windows)
 * - ~5 API calls for a 500-tx wallet vs ~400+ with Alchemy
 */

import { db } from "@/lib/db"
import { isProviderThrottleError, withProviderPermitRotating } from "./provider-governor"
import type { ServiceKeyEntry } from "./service-keys"
import type { WalletChainSyncResult, SyncErrorDetail } from "./transaction-fetcher"
import { fetchWalletTransactions } from "./zerion-client"
import { zerionTxToRecords, extractZerionCursor } from "./zerion-tx-mapper"
import type { ZerionTransaction } from "./zerion-tx-mapper"

export const ZERION_MULTI_CHAIN = "ZERION_MULTI"

const MAX_STEP_REQUESTS_DEFAULT = 10
const MAX_STEP_MS_DEFAULT = 7_000
const PAGE_SIZE = 100

function classifyZerionError(status: number | undefined, message: string): SyncErrorDetail {
  const lower = message.toLowerCase()
  if (status === 401 || lower.includes("invalid zerion api key")) {
    return { code: "zerion_unauthorized", message, status, retryable: false }
  }
  if (status === 429 || lower.includes("rate limit")) {
    return { code: "zerion_rate_limited", message, status, retryable: true, retryAfterSec: 60 }
  }
  if (status && status >= 500) {
    return { code: "zerion_upstream_error", message, status, retryable: true, retryAfterSec: 60 }
  }
  return { code: "zerion_error", message, status, retryable: true, retryAfterSec: 45 }
}

function throttleDetailFromError(error: unknown, fallbackMessage: string): SyncErrorDetail {
  if (isProviderThrottleError(error)) {
    const retryAfterSec = error.nextAllowedAt
      ? Math.min(300, Math.max(5, Math.ceil((error.nextAllowedAt.getTime() - Date.now()) / 1000)))
      : 60
    return { code: "zerion_rate_limited", message: error.message, status: 429, retryable: true, retryAfterSec }
  }
  const status =
    error != null && typeof error === "object" && typeof (error as Record<string, unknown>).status === "number"
      ? (error as { status: number }).status
      : undefined
  return classifyZerionError(status, error instanceof Error ? error.message : fallbackMessage)
}

/**
 * Execute a bounded sync step for one EVM wallet using Zerion's transaction API.
 * Fetches all chains at once, stores into TransactionCache with per-chain chain values.
 */
export async function syncZerionWalletStep(options: {
  userId: string
  walletAddress: string
  zerionKeys: ServiceKeyEntry[]
  maxRequests?: number
  maxMs?: number
}): Promise<WalletChainSyncResult> {
  const {
    userId,
    walletAddress,
    zerionKeys,
    maxRequests = MAX_STEP_REQUESTS_DEFAULT,
    maxMs = MAX_STEP_MS_DEFAULT,
  } = options

  const addr = walletAddress.toLowerCase()
  const chain = ZERION_MULTI_CHAIN

  const state = await db.transactionSyncState.upsert({
    where: { userId_walletAddress_chain: { userId, walletAddress: addr, chain } },
    update: {},
    create: {
      userId,
      walletAddress: addr,
      chain,
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
      chain,
      newTransactions: 0,
      requestsProcessed: 0,
      isComplete: state.isComplete,
      errors: state.lastErrorCode
        ? [{ code: state.lastErrorCode, message: state.lastErrorMessage ?? "Blocked by retry window", retryable: true }]
        : [],
      blockedUntil: state.retryAfter.toISOString(),
    }
  }

  console.log(`[zerion-tx] START ${addr.slice(0, 10)}… phase=${state.phase} requestsProcessed=${state.requestsProcessed} pageKey=${state.pageKey ? state.pageKey.slice(0, 20) + "…" : "null"} syncMode=${state.syncMode ?? "historical"}`)

  let phase = state.phase === "bootstrap" ? "fetching" : state.phase
  let pageKey = state.phase === "bootstrap" ? null : state.pageKey
  let isComplete = state.isComplete
  let requestsProcessed = state.requestsProcessed
  let recordsInserted = state.recordsInserted
  let retryAfter: Date | null = null
  let lastErrorCode: string | null = null
  let lastErrorMessage: string | null = null
  let highWaterMark: number | null = state.highWaterMark ?? null
  const syncMode = state.syncMode ?? "historical"

  // For incremental: only fetch transactions newer than last high-water mark (stored as Unix sec).
  // Zerion expects Unix epoch seconds as an integer, not ISO strings.
  const minMinedAt: string | null =
    syncMode === "incremental" && highWaterMark && highWaterMark > 1
      ? String(highWaterMark)
      : null

  const errors: SyncErrorDetail[] = []
  let totalNew = 0
  let stepRequests = 0
  const startedAtMs = Date.now()

  while (
    !isComplete &&
    errors.length === 0 &&
    stepRequests < maxRequests &&
    Date.now() - startedAtMs < maxMs
  ) {
    let page: Awaited<ReturnType<typeof fetchWalletTransactions>>
    try {
      page = await withProviderPermitRotating(
        userId,
        "zerion",
        `transactions:${addr}`,
        undefined,
        zerionKeys,
        (keyEntry) =>
          fetchWalletTransactions(keyEntry.key, addr, {
            cursor: pageKey,
            minMinedAt,
            pageSize: PAGE_SIZE,
          }),
      )
    } catch (err) {
      // If we get a 400 "malformed parameter" with a cursor, the cursor is likely stale.
      // Reset cursor and retry fresh on next attempt instead of retrying the same bad request.
      const status400 =
        err != null && typeof err === "object" && (err as Record<string, unknown>).status === 400
      if (status400 && pageKey) {
        console.log(`[zerion-tx] 400 with stale cursor ${addr.slice(0, 10)}… — resetting cursor for fresh retry`)
        pageKey = null
        retryAfter = new Date(Date.now() + 10_000) // short retry
        lastErrorCode = "zerion_cursor_reset"
        lastErrorMessage = "Stale cursor reset — will retry fresh"
        break
      }

      const detail = throttleDetailFromError(err, "Zerion transactions request failed")
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

    const txs: ZerionTransaction[] = page.data ?? []
    const nextCursorRaw = extractZerionCursor(page.links?.next)
    console.log(`[zerion-tx] PAGE ${addr}… req#${stepRequests} txs=${txs.length} hasMore=${!!nextCursorRaw} cursor=${pageKey ? pageKey.slice(0, 20) + "…" : "null"}`)

    if (txs.length === 0) {
      // If this is the first page and we've never recorded any data for this wallet,
      // retry a few times before accepting the empty result — Zerion occasionally returns
      // empty pages transiently. After 3 retries (tracked via requestsProcessed), accept it.
      const isFirstPage = pageKey === null
      if (isFirstPage && state.requestsProcessed < 3) {
        console.log(`[zerion-tx] EMPTY FIRST PAGE ${addr}… attempt ${state.requestsProcessed + 1}/3 — retrying in 60s`)
        retryAfter = new Date(Date.now() + 60_000)
        lastErrorCode = "zerion_empty_response"
        lastErrorMessage = `Zerion returned 0 transactions (attempt ${state.requestsProcessed + 1}/3) — retrying in 60s`
        break
      }
      console.log(`[zerion-tx] DONE (empty) ${addr}… totalNew=${totalNew} requests=${stepRequests}`)
      isComplete = true
      phase = "completed"
      highWaterMark = Math.floor(Date.now() / 1000) // store current time as HWM for incremental
      break
    }

    // For incremental: check if we hit already-known transactions
    let hitKnown = false
    if (syncMode === "incremental") {
      const hashes = txs.map((tx) => tx.attributes.hash.toLowerCase())
      const existing = await db.transactionCache.findMany({
        where: { userId, txHash: { in: hashes } },
        select: { txHash: true },
        distinct: ["txHash"],
      })
      const knownHashes = new Set(existing.map((e) => e.txHash))
      if (knownHashes.size > 0) hitKnown = true
    }

    // Convert and insert
    const allRecords = txs.flatMap((tx) => zerionTxToRecords(tx, userId, addr))

    if (allRecords.length > 0) {
      const result = await db.transactionCache.createMany({
        data: allRecords,
        skipDuplicates: true,
      })
      totalNew += result.count
      recordsInserted += result.count
    }

    if (hitKnown) {
      isComplete = true
      phase = "completed"
      highWaterMark = Math.floor(Date.now() / 1000)
      break
    }

    // Advance cursor (nextCursorRaw already computed above for logging)
    if (!nextCursorRaw) {
      console.log(`[zerion-tx] DONE (no more pages) ${addr}… totalNew=${totalNew} requests=${stepRequests}`)
      // No more pages — full sync done
      isComplete = true
      phase = "completed"
      highWaterMark = Math.floor(Date.now() / 1000)
      break
    }
    pageKey = nextCursorRaw
  }

  await db.transactionSyncState.update({
    where: { userId_walletAddress_chain: { userId, walletAddress: addr, chain } },
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
    chain,
    newTransactions: totalNew,
    requestsProcessed: stepRequests,
    isComplete,
    errors,
    blockedUntil: retryAfter?.toISOString() ?? null,
  }
}
