/**
 * Etherscan-family transaction fetcher for chains without Alchemy getAssetTransfers support.
 *
 * Uses block explorer APIs (BscScan, LineaScan, ScrollScan, zkSync Explorer) which all
 * share the same Etherscan-compatible API format.
 *
 * 4 actions (vs Alchemy's 8 phases — explorer APIs return both directions in one call):
 *   txlist       → category "external" (native transfers)
 *   tokentx      → category "erc20"
 *   tokennfttx   → category "erc721"
 *   txlistinternal → category "internal"
 */

import { db } from "@/lib/db"
import { CHAIN_CONFIGS, ETHERSCAN_SYNC_CHAINS } from "@/lib/tracker/chains"
import type { TrackerChain } from "@/lib/tracker/types"
import { getServiceKey } from "./service-keys"
import { withProviderPermit } from "./provider-governor"
import type { WalletChainSyncResult, SyncErrorDetail } from "./transaction-fetcher"

type EtherscanAction = "txlist" | "tokentx" | "tokennfttx" | "txlistinternal"

const ACTIONS: Array<{ action: EtherscanAction; category: string }> = [
  { action: "txlist", category: "external" },
  { action: "tokentx", category: "erc20" },
  { action: "tokennfttx", category: "erc721" },
  { action: "txlistinternal", category: "internal" },
]

const PAGE_SIZE = 10_000

interface EtherscanApiResponse {
  status: string
  message: string
  result: EtherscanTx[] | string
}

interface EtherscanTx {
  blockNumber: string
  timeStamp: string
  hash: string
  from: string
  to: string
  value: string
  contractAddress?: string
  tokenName?: string
  tokenSymbol?: string
  tokenDecimal?: string
  isError?: string
  functionName?: string
}

function actionToPhase(actionIdx: number): string {
  return `etherscan:${ACTIONS[actionIdx].action}`
}

function parseActionIndex(phase: string | null): number {
  if (!phase?.startsWith("etherscan:")) return 0
  const action = phase.slice("etherscan:".length)
  const idx = ACTIONS.findIndex((a) => a.action === action)
  return idx >= 0 ? idx : 0
}

function classifyExplorerError(status: number | undefined, message: string): SyncErrorDetail {
  const lower = message.toLowerCase()

  if (lower.includes("max rate limit") || lower.includes("rate limit") || status === 429) {
    return {
      code: "explorer_rate_limited",
      message,
      status: status ?? 429,
      retryable: true,
      retryAfterSec: 5,
    }
  }

  if (lower.includes("invalid api") || lower.includes("missing/invalid") || status === 401 || status === 403) {
    return {
      code: "explorer_unauthorized",
      message,
      status,
      retryable: false,
    }
  }

  return {
    code: "explorer_error",
    message,
    status,
    retryable: true,
    retryAfterSec: 10,
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface EtherscanSyncOptions {
  userId: string
  walletAddress: string
  chain: string
  maxRequests?: number
  maxMs?: number
}

/**
 * Execute a bounded sync step for one wallet/chain using Etherscan-family APIs.
 * Returns the same WalletChainSyncResult shape as the Alchemy fetcher.
 */
export async function syncEtherscanWalletStep(options: EtherscanSyncOptions): Promise<WalletChainSyncResult> {
  const {
    userId,
    walletAddress,
    chain,
    maxRequests = 10,
    maxMs = 7_000,
  } = options

  const addr = walletAddress.toLowerCase()
  const chainConfig = CHAIN_CONFIGS[chain as TrackerChain]
  if (!chainConfig) {
    return {
      wallet: addr,
      chain,
      newTransactions: 0,
      requestsProcessed: 0,
      isComplete: true,
      errors: [{ code: "unsupported_chain", message: `No chain config for ${chain}`, retryable: false }],
    }
  }

  const apiKey = await getServiceKey(userId, chainConfig.apiKeyService)
  const keyless = !apiKey && !!chainConfig.freeApiTier
  const keylessIntervalMs = keyless ? Math.ceil(1000 / chainConfig.freeApiTier!.ratePerSecond) : 0

  if (!apiKey && !keyless) {
    // No key and no free tier — mark as needs_key
    return {
      wallet: addr,
      chain,
      newTransactions: 0,
      requestsProcessed: 0,
      isComplete: true,
      errors: [{ code: "explorer_key_missing", message: `Add a ${chainConfig.apiKeyService} API key to sync ${chainConfig.name} transactions`, retryable: false }],
    }
  }

  if (keyless) {
    console.log(`[etherscan] Using keyless mode for ${chain} (${chainConfig.freeApiTier!.ratePerSecond} req/s — get a free key from ${chainConfig.freeApiTier!.signupLabel} for 25x faster sync)`)
  }

  // Load or create sync state
  const state = await db.transactionSyncState.upsert({
    where: { userId_walletAddress_chain: { userId, walletAddress: addr, chain } },
    update: {},
    create: {
      userId,
      walletAddress: addr,
      chain,
      lastBlockFetched: 0,
      isComplete: false,
      phase: actionToPhase(0),
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

  if (state.isComplete) {
    return {
      wallet: addr,
      chain,
      newTransactions: 0,
      requestsProcessed: 0,
      isComplete: true,
      errors: [],
    }
  }

  let actionIdx = parseActionIndex(state.phase)
  let page = state.pageKey ? parseInt(state.pageKey, 10) || 1 : 1
  let isComplete = false
  let lastErrorCode: string | null = null
  let lastErrorMessage: string | null = null
  let retryAfter: Date | null = null
  let requestsProcessed = state.requestsProcessed
  let recordsInserted = state.recordsInserted
  let totalNew = 0
  let stepRequests = 0
  const errors: SyncErrorDetail[] = []
  const startedAtMs = Date.now()

  while (!isComplete && errors.length === 0 && stepRequests < maxRequests && Date.now() - startedAtMs < maxMs) {
    if (actionIdx >= ACTIONS.length) {
      isComplete = true
      break
    }

    const { action, category } = ACTIONS[actionIdx]
    const url = new URL(chainConfig.explorerApiUrl)
    url.searchParams.set("module", "account")
    url.searchParams.set("action", action)
    url.searchParams.set("address", addr)
    url.searchParams.set("startblock", "0")
    url.searchParams.set("endblock", "99999999")
    url.searchParams.set("page", String(page))
    url.searchParams.set("offset", String(PAGE_SIZE))
    url.searchParams.set("sort", "asc")
    if (apiKey) url.searchParams.set("apikey", apiKey)

    let res: Response
    try {
      res = await withProviderPermit(
        userId,
        "etherscan",
        `${action}:${chain}:${addr}`,
        keyless ? { minIntervalMs: keylessIntervalMs } : undefined,
        () => fetch(url.toString(), { signal: AbortSignal.timeout(15_000) }),
      )
    } catch (err) {
      const detail = classifyExplorerError(undefined, err instanceof Error ? err.message : "Explorer request failed")
      errors.push(detail)
      if (detail.retryable) {
        retryAfter = new Date(Date.now() + (detail.retryAfterSec ?? 10) * 1000)
      }
      lastErrorCode = detail.code
      lastErrorMessage = detail.message
      break
    }

    stepRequests += 1
    requestsProcessed += 1

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const detail = classifyExplorerError(res.status, body.slice(0, 220) || `HTTP ${res.status}`)
      errors.push(detail)
      if (detail.retryable) {
        retryAfter = new Date(Date.now() + (detail.retryAfterSec ?? 10) * 1000)
      }
      lastErrorCode = detail.code
      lastErrorMessage = detail.message
      break
    }

    const data = (await res.json()) as EtherscanApiResponse

    // status "0" with "No transactions found" is normal — move to next action
    if (data.status === "0" && !Array.isArray(data.result)) {
      const msg = typeof data.result === "string" ? data.result : data.message
      if (msg.toLowerCase().includes("no transactions") || msg.toLowerCase().includes("no records")) {
        // No data for this action — advance
        actionIdx++
        page = 1
        continue
      }
      // Actual error
      const detail = classifyExplorerError(undefined, msg)
      errors.push(detail)
      if (detail.retryable) {
        retryAfter = new Date(Date.now() + (detail.retryAfterSec ?? 10) * 1000)
      }
      lastErrorCode = detail.code
      lastErrorMessage = detail.message
      break
    }

    const txs = Array.isArray(data.result) ? data.result : []

    if (txs.length > 0) {
      const records = txs
        .filter((tx) => tx.isError !== "1") // skip failed txs
        .map((tx) => {
          const from = tx.from?.toLowerCase() ?? ""
          const to = tx.to?.toLowerCase() ?? ""
          const direction = from === addr ? "out" : "in"
          const blockNumber = parseInt(tx.blockNumber, 10) || 0
          const blockTimestamp = parseInt(tx.timeStamp, 10) || 0

          let asset: string | null = null
          let symbol: string | null = null
          let decimals: number | null = null
          let rawValue: string | null = tx.value ?? null
          let value: number | null = null

          if (category === "external" || category === "internal") {
            asset = "native"
            symbol = chainConfig.nativeToken
            decimals = chainConfig.nativeDecimals
          } else {
            asset = tx.contractAddress?.toLowerCase() ?? null
            symbol = tx.tokenSymbol ?? null
            decimals = tx.tokenDecimal ? parseInt(tx.tokenDecimal, 10) : null
          }

          if (rawValue && decimals !== null) {
            try {
              const raw = BigInt(rawValue)
              const divisor = 10n ** BigInt(decimals)
              const whole = raw / divisor
              const fraction = raw % divisor
              const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "")
              const composed = fractionStr ? `${whole.toString()}.${fractionStr}` : whole.toString()
              value = Number(composed)
              if (!Number.isFinite(value)) value = null
            } catch {
              value = null
            }
          }

          return {
            userId,
            walletAddress: addr,
            chain,
            txHash: tx.hash.toLowerCase(),
            blockNumber,
            blockTimestamp,
            category,
            from,
            to,
            asset,
            symbol,
            decimals,
            rawValue,
            value,
            usdValue: null as number | null,
            direction,
          }
        })

      if (records.length > 0) {
        const result = await db.transactionCache.createMany({
          data: records,
          skipDuplicates: true,
        })
        totalNew += result.count
        recordsInserted += result.count
      }
    }

    // If exactly PAGE_SIZE results, there may be more pages
    if (txs.length >= PAGE_SIZE) {
      page++
      await sleep(250) // respect rate limits
      continue
    }

    // Done with this action — move to next
    actionIdx++
    page = 1
    await sleep(250)
  }

  const phase = isComplete ? "completed" : actionToPhase(Math.min(actionIdx, ACTIONS.length - 1))

  await db.transactionSyncState.update({
    where: { userId_walletAddress_chain: { userId, walletAddress: addr, chain } },
    data: {
      isComplete,
      phase,
      pageKey: isComplete ? null : String(page),
      retryAfter,
      lastErrorCode,
      lastErrorMessage,
      requestsProcessed,
      recordsInserted,
      lastBlockFetched: 99999999,
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
