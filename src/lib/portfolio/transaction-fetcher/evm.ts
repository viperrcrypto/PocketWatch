/**
 * EVM (Alchemy) transaction sync step: bounded latest-first sync for one wallet/chain.
 */

import { db } from "@/lib/db"
import { ALCHEMY_TRANSFER_CHAINS } from "@/lib/tracker/chains"
import { withProviderPermitRotating } from "../provider-governor"
import { markKeyThrottled, markKeySuccess } from "../service-keys"
import {
  PHASES,
  WINDOW_BLOCKS,
  INCREMENTAL_WINDOW_BLOCKS,
  MAX_STEP_REQUESTS_DEFAULT,
  MAX_STEP_MS_DEFAULT,
  type AlchemyResponse,
  type SyncErrorDetail,
  type WalletChainSyncResult,
  type SyncStepOptions,
} from "./types"
import {
  phaseToString,
  parsePhase,
  nextPhase,
  classifyAlchemyError,
  throttleDetailFromError,
  fetchLatestBlock,
  sleep,
  deriveTransferValue,
} from "./helpers"
import { ensureWalletChainSyncState } from "./sync-state"

/**
 * Execute a bounded latest-first sync slice for one wallet/chain.
 * Safe for background workers to call repeatedly.
 */
export async function syncWalletTransactionsStep(options: SyncStepOptions): Promise<WalletChainSyncResult> {
  const {
    userId,
    walletAddress,
    chain,
    alchemyKeys,
    maxRequests = MAX_STEP_REQUESTS_DEFAULT,
    maxMs = MAX_STEP_MS_DEFAULT,
  } = options

  const slug = ALCHEMY_TRANSFER_CHAINS[chain as keyof typeof ALCHEMY_TRANSFER_CHAINS]
  const addr = walletAddress.toLowerCase()

  if (!slug) {
    const unsupported: SyncErrorDetail = {
      code: "unsupported_chain",
      message: `Unsupported sync chain: ${chain}`,
      retryable: false,
    }

    await db.transactionSyncState.upsert({
      where: { userId_walletAddress_chain: { userId, walletAddress: addr, chain } },
      create: {
        userId,
        walletAddress: addr,
        chain,
        lastBlockFetched: 0,
        isComplete: true,
        phase: "failed",
        lastErrorCode: unsupported.code,
        lastErrorMessage: unsupported.message,
      },
      update: {
        isComplete: true,
        phase: "failed",
        lastErrorCode: unsupported.code,
        lastErrorMessage: unsupported.message,
      },
    })

    return {
      wallet: addr,
      chain,
      newTransactions: 0,
      requestsProcessed: 0,
      isComplete: true,
      errors: [unsupported],
    }
  }

  const buildBaseUrl = (key: string) => `https://${slug}.g.alchemy.com/v2/${key}`
  const state = await ensureWalletChainSyncState(userId, addr, chain)

  if (state.retryAfter && state.retryAfter.getTime() > Date.now()) {
    return {
      wallet: addr,
      chain,
      newTransactions: 0,
      requestsProcessed: 0,
      isComplete: state.isComplete,
      errors: state.lastErrorCode
        ? [{ code: state.lastErrorCode, message: state.lastErrorMessage ?? "Sync blocked by retry window", retryable: true }]
        : [],
      blockedUntil: state.retryAfter.toISOString(),
    }
  }

  let phase = state.phase
  let cursorFromBlock = state.cursorFromBlock
  let cursorToBlock = state.cursorToBlock
  let pageKey = state.pageKey
  let isComplete = state.isComplete
  let lastBlockFetched = state.lastBlockFetched
  let requestsProcessed = state.requestsProcessed
  let recordsInserted = state.recordsInserted
  let retryAfter: Date | null = null
  let lastErrorCode: string | null = null
  let lastErrorMessage: string | null = null
  let highWaterMark: number | null = state.highWaterMark ?? null
  let syncMode: string = state.syncMode ?? "historical"
  let bootstrappedToBlock: number | null = null

  const errors: SyncErrorDetail[] = []
  let totalNew = 0
  let stepRequests = 0
  const startedAtMs = Date.now()

  // Bootstrap: fetch latest block and set up window
  if (!isComplete && (phase === "bootstrap" || cursorFromBlock === null || cursorToBlock === null)) {
    try {
      const latestBlock = await withProviderPermitRotating(
        userId,
        "alchemy",
        `latest-block:${chain}`,
        undefined,
        alchemyKeys,
        (key) => fetchLatestBlock(buildBaseUrl(key.key)),
        (keyId) => markKeyThrottled(keyId).catch(() => {}),
        (keyId) => markKeySuccess(keyId).catch(() => {})
      )
      bootstrappedToBlock = latestBlock
      cursorToBlock = latestBlock
      const effectiveWindow = syncMode === "incremental" ? INCREMENTAL_WINDOW_BLOCKS : WINDOW_BLOCKS
      cursorFromBlock = Math.max(0, latestBlock - effectiveWindow + 1)
      if (syncMode === "incremental" && state.highWaterMark !== null && state.highWaterMark !== undefined) {
        cursorFromBlock = Math.max(state.highWaterMark, cursorFromBlock)
      }
      highWaterMark = latestBlock
      phase = phaseToString(PHASES[0])
      pageKey = null
      lastBlockFetched = latestBlock
      retryAfter = null
      lastErrorCode = null
      lastErrorMessage = null
      requestsProcessed += 1
      stepRequests += 1
    } catch (err) {
      const detail = throttleDetailFromError(err, "Latest block query failed")
      errors.push(detail)
      if (detail.retryable) {
        retryAfter = new Date(Date.now() + (detail.retryAfterSec ?? 60) * 1000)
      } else {
        isComplete = true
        phase = "failed"
      }
      lastErrorCode = detail.code
      lastErrorMessage = detail.message
    }
  }

  // Main fetch loop
  while (!isComplete && errors.length === 0 && stepRequests < maxRequests && Date.now() - startedAtMs < maxMs) {
    const parsed = parsePhase(phase)
    if (!parsed || cursorFromBlock === null || cursorToBlock === null) {
      phase = phaseToString(PHASES[0])
      pageKey = null
      continue
    }

    const params: Record<string, unknown> = {
      fromBlock: `0x${Math.max(0, cursorFromBlock).toString(16)}`,
      toBlock: `0x${Math.max(0, cursorToBlock).toString(16)}`,
      category: [parsed.category],
      withMetadata: true,
      maxCount: "0x190",
      order: "desc",
    }
    if (parsed.direction === "from") params.fromAddress = addr
    else params.toAddress = addr
    if (pageKey) params.pageKey = pageKey

    let res: Response
    try {
      res = await withProviderPermitRotating(
        userId,
        "alchemy",
        `asset-transfers:${chain}:${addr}:${parsed.direction}:${parsed.category}`,
        undefined,
        alchemyKeys,
        async (key) => {
          const r = await fetch(buildBaseUrl(key.key), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "alchemy_getAssetTransfers",
              params: [params],
            }),
          })
          if (!r.ok) {
            const body = await r.text().catch(() => "")
            throw Object.assign(new Error(`Alchemy ${r.status}: ${body.slice(0, 180)}`), { status: r.status })
          }
          return r
        },
        (keyId) => markKeyThrottled(keyId).catch(() => {}),
        (keyId) => markKeySuccess(keyId).catch(() => {})
      )
    } catch (err) {
      const detail = throttleDetailFromError(err, "Alchemy request failed")
      detail.direction = parsed.direction
      detail.category = parsed.category
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

    const json = (await res.json()) as AlchemyResponse
    if (json.error) {
      const detail = classifyAlchemyError(undefined, json.error.message || "Alchemy RPC error")
      detail.direction = parsed.direction
      detail.category = parsed.category
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

    const transfers = json.result?.transfers ?? []
    const nextPage = json.result?.pageKey

    if (transfers.length > 0) {
      const records = transfers.map((tx) => {
        const blockNumber = parseInt(tx.blockNum, 16)
        const blockTimestamp = Math.floor(new Date(tx.metadata.blockTimestamp).getTime() / 1000)
        const txDirection = tx.from.toLowerCase() === addr ? "out" : "in"

        let asset: string | null = null
        if (parsed.category === "external" || parsed.category === "internal") {
          asset = "native"
        } else if (tx.rawContract.address) {
          asset = tx.rawContract.address.toLowerCase()
        }

        const rawValue = tx.rawContract.value
        const decimals = tx.rawContract.decimal ? parseInt(tx.rawContract.decimal, 16) : null
        const value = deriveTransferValue(tx.value, rawValue, decimals)

        return {
          userId,
          walletAddress: addr,
          chain,
          txHash: tx.hash,
          blockNumber,
          blockTimestamp,
          category: parsed.category,
          from: tx.from.toLowerCase(),
          to: tx.to?.toLowerCase() ?? null,
          asset,
          symbol: tx.asset,
          decimals,
          rawValue,
          value,
          usdValue: null as number | null,
          direction: txDirection,
        }
      })

      const result = await db.transactionCache.createMany({
        data: records,
        skipDuplicates: true,
      })
      totalNew += result.count
      recordsInserted += result.count
    }

    if (nextPage) {
      pageKey = nextPage
      await sleep(80)
      continue
    }

    pageKey = null
    const next = nextPhase(phase)

    if (next) {
      phase = next
      continue
    }

    // Window completed for all phase pairs
    const stopAt = syncMode === "incremental" ? (state.highWaterMark ?? 0) : 0
    if (cursorFromBlock <= stopAt) {
      isComplete = true
      phase = "completed"
      cursorFromBlock = stopAt
      cursorToBlock = stopAt
      lastBlockFetched = stopAt
      if (syncMode === "incremental") {
        highWaterMark = bootstrappedToBlock ?? highWaterMark
      }
    } else {
      const nextWindow = syncMode === "incremental" ? INCREMENTAL_WINDOW_BLOCKS : WINDOW_BLOCKS
      const nextTo = Math.max(0, cursorFromBlock - 1)
      const nextFrom = Math.max(stopAt, Math.max(0, nextTo - nextWindow + 1))

      cursorToBlock = nextTo
      cursorFromBlock = nextFrom
      phase = phaseToString(PHASES[0])
      lastBlockFetched = nextTo
    }
  }

  await db.transactionSyncState.update({
    where: { userId_walletAddress_chain: { userId, walletAddress: addr, chain } },
    data: {
      lastBlockFetched,
      isComplete,
      phase,
      cursorFromBlock,
      cursorToBlock,
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
