/**
 * History sync worker: orchestrates Alchemy, Etherscan, Zerion, and Solana
 * sync targets for a single run of the sync job.
 */

import { db } from "@/lib/db"
import { ALCHEMY_TRANSFER_CHAINS, ETHERSCAN_SYNC_CHAINS, CHAIN_CONFIGS } from "@/lib/tracker/chains"
import type { TrackerChain } from "@/lib/tracker/types"
import { selectServiceKey, getServiceKey, getAllHealthyServiceKeys } from "../service-keys"
import { syncSolanaWalletStep } from "../solana-transaction-fetcher"
import { syncEtherscanWalletStep } from "../etherscan-transaction-fetcher"
import { syncZerionWalletStep, ZERION_MULTI_CHAIN } from "../zerion-transaction-fetcher"
import {
  MAX_STEP_REQUESTS_DEFAULT,
  MAX_STEP_MS_DEFAULT,
  type HistoryJobStatus,
  type WalletChainSyncResult,
  type HistorySyncRunResult,
} from "./types"
import { syncWalletTransactionsStep } from "./evm"
import { ensureWalletChainSyncState, SYNC_CHAINS } from "./sync-state"
import { buildCursorSnapshot } from "./job-manager"

export async function runHistorySyncWorker(userId: string, opts?: {
  maxSyncsPerRun?: number
  maxRequestsPerSync?: number
  maxMsPerSync?: number
}): Promise<HistorySyncRunResult | null> {
  const job = await db.historySyncJob.findFirst({
    where: {
      userId,
      status: { in: ["queued", "running"] },
    },
    orderBy: { updatedAt: "desc" },
  })

  if (!job) return null

  if (job.status === "queued") {
    await db.historySyncJob.update({
      where: { id: job.id },
      data: { status: "running", startedAt: job.startedAt ?? new Date() },
    })
  }

  const syncStates = await db.transactionSyncState.findMany({
    where: { userId },
    orderBy: [{ isComplete: "asc" }, { updatedAt: "asc" }],
  })

  if (syncStates.length === 0) {
    await db.historySyncJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        error: "No tracked wallet sync states found",
      },
    })

    return {
      jobId: job.id,
      status: "failed",
      totalSyncs: 0,
      processedSyncs: 0,
      failedSyncs: 0,
      insertedTxCount: 0,
      results: [],
      completedAt: new Date().toISOString(),
    }
  }

  const now = Date.now()
  const eligible = syncStates.filter((s) => !s.isComplete && (!s.retryAfter || s.retryAfter.getTime() <= now))
  const blocked = syncStates.filter((s) => !s.isComplete && s.retryAfter && s.retryAfter.getTime() > now)

  console.log(`[sync-worker] uid=${userId.slice(0, 8)} job=${job.id.slice(0, 8)} total=${syncStates.length} complete=${syncStates.filter(s => s.isComplete).length} eligible=${eligible.length} blocked=${blocked.length}`)
  if (blocked.length > 0) {
    for (const b of blocked) {
      const waitSec = Math.ceil((b.retryAfter!.getTime() - now) / 1000)
      console.log(`[sync-worker]   BLOCKED ${b.walletAddress.slice(0, 10)}…/${b.chain} for ${waitSec}s reason=${b.lastErrorCode ?? "none"}`)
    }
  }

  const scored = eligible.map((s) => {
    let score = 0
    if (s.recordsInserted === 0 && (s.phase === "bootstrap" || s.phase === null)) score += 100
    if (s.syncMode === "incremental") score += 75
    const staleHours = (now - s.updatedAt.getTime()) / 3600000
    score += Math.min(50, staleHours * 5)
    return { state: s, score }
  })
  scored.sort((a, b) => b.score - a.score)

  const alchemyKeyCountForBatch = await db.externalApiKey.count({
    where: { userId, serviceName: "alchemy", verified: true },
  })
  const defaultMaxPerRun = Math.max(6, alchemyKeyCountForBatch * 4)
  const maxSyncsPerRun = Math.max(1, opts?.maxSyncsPerRun ?? defaultMaxPerRun)
  const targets = scored.slice(0, maxSyncsPerRun).map((s) => s.state)

  const results: WalletChainSyncResult[] = []

  const alchemyChainSet = new Set(Object.keys(ALCHEMY_TRANSFER_CHAINS))
  const etherscanOnlyChainSet = new Set(Object.keys(ETHERSCAN_SYNC_CHAINS))
  const solTargets = targets.filter((s) => s.chain === "SOLANA")
  const zerionTargets = targets.filter((s) => s.chain === ZERION_MULTI_CHAIN)
  const evmTargets = targets.filter((s) => s.chain !== "SOLANA" && s.chain !== ZERION_MULTI_CHAIN)

  const [initialAlchemy, initialHelius] = await Promise.all([
    selectServiceKey(userId, "alchemy"),
    selectServiceKey(userId, "helius"),
  ])

  const alchemyTargets: typeof targets = []
  const etherscanTargets: typeof targets = []
  const needsKeyTargets: typeof targets = []

  for (const state of evmTargets) {
    const isAlchemyChain = alchemyChainSet.has(state.chain)
    const isEtherscanOnlyChain = etherscanOnlyChainSet.has(state.chain)

    if (isAlchemyChain && initialAlchemy?.key) {
      alchemyTargets.push(state)
    } else if (isAlchemyChain || isEtherscanOnlyChain) {
      const chainConfig = CHAIN_CONFIGS[state.chain as TrackerChain]
      const explorerKey = chainConfig ? await getServiceKey(userId, chainConfig.apiKeyService) : null
      if (explorerKey || chainConfig?.freeApiTier) {
        etherscanTargets.push(state)
      } else {
        needsKeyTargets.push(state)
      }
    } else {
      needsKeyTargets.push(state)
    }
  }

  for (const state of needsKeyTargets) {
    const chainConfig = CHAIN_CONFIGS[state.chain as TrackerChain]
    const serviceName = chainConfig?.apiKeyService ?? state.chain.toLowerCase()
    const chainName = chainConfig?.name ?? state.chain
    await db.transactionSyncState.update({
      where: { id: state.id },
      data: {
        isComplete: true,
        phase: "needs_key",
        lastErrorCode: "explorer_key_missing",
        lastErrorMessage: `Add a ${serviceName} API key in Settings to sync ${chainName} transactions`,
      },
    })
    results.push({
      wallet: state.walletAddress,
      chain: state.chain,
      newTransactions: 0,
      requestsProcessed: 0,
      isComplete: true,
      errors: [{ code: "explorer_key_missing", message: `Add a ${serviceName} API key to sync ${chainName} transactions`, retryable: false }],
    })
  }

  const alchemyKeys = await getAllHealthyServiceKeys(userId, "alchemy")
  const parallelism = Math.max(1, alchemyKeys.length)

  if (alchemyTargets.length > 0 && alchemyKeys.length === 0) {
    for (const state of alchemyTargets) {
      await db.transactionSyncState.update({
        where: { id: state.id },
        data: {
          isComplete: true,
          phase: "needs_key",
          lastErrorCode: "alchemy_key_missing",
          lastErrorMessage: "Alchemy API key required for EVM chain sync",
        },
      })
      results.push({
        wallet: state.walletAddress,
        chain: state.chain,
        newTransactions: 0,
        requestsProcessed: 0,
        isComplete: true,
        errors: [{ code: "alchemy_key_missing", message: "Alchemy API key required for EVM chain sync", retryable: false }],
      })
    }
  }

  if (alchemyKeys.length > 0) {
    for (let i = 0; i < alchemyTargets.length; i += parallelism) {
      const batch = alchemyTargets.slice(i, i + parallelism)
      const batchResults = await Promise.allSettled(
        batch.map(async (state) => {
          const run = await syncWalletTransactionsStep({
            userId,
            walletAddress: state.walletAddress,
            chain: state.chain,
            alchemyKeys,
            maxRequests: opts?.maxRequestsPerSync ?? MAX_STEP_REQUESTS_DEFAULT,
            maxMs: opts?.maxMsPerSync ?? MAX_STEP_MS_DEFAULT,
          })
          return run
        })
      )
      for (const settled of batchResults) {
        results.push(settled.status === "fulfilled" ? settled.value : {
          wallet: "unknown",
          chain: "unknown",
          newTransactions: 0,
          requestsProcessed: 0,
          isComplete: true,
          errors: [{ code: "sync_crash", message: settled.reason?.message ?? "Unexpected sync error", retryable: true }],
        })
      }
    }
  }

  const etherscanByService = new Map<string, typeof etherscanTargets>()
  for (const state of etherscanTargets) {
    const chainConfig = CHAIN_CONFIGS[state.chain as TrackerChain]
    const service = chainConfig?.apiKeyService ?? state.chain
    if (!etherscanByService.has(service)) etherscanByService.set(service, [])
    etherscanByService.get(service)!.push(state)
  }

  const etherscanGroupResults = await Promise.allSettled(
    [...etherscanByService.values()].map(async (group) => {
      const groupResults: WalletChainSyncResult[] = []
      for (const state of group) {
        try {
          const run = await syncEtherscanWalletStep({
            userId,
            walletAddress: state.walletAddress,
            chain: state.chain,
            maxRequests: opts?.maxRequestsPerSync ?? MAX_STEP_REQUESTS_DEFAULT,
            maxMs: opts?.maxMsPerSync ?? MAX_STEP_MS_DEFAULT,
          })
          groupResults.push(run)
        } catch (err) {
          groupResults.push({
            wallet: state.walletAddress,
            chain: state.chain,
            newTransactions: 0,
            requestsProcessed: 0,
            isComplete: true,
            errors: [{ code: "sync_crash", message: err instanceof Error ? err.message : "Unexpected sync error", retryable: true }],
          })
        }
      }
      return groupResults
    })
  )
  for (const settled of etherscanGroupResults) {
    if (settled.status === "fulfilled") results.push(...settled.value)
  }

  if (zerionTargets.length > 0) {
    const zerionKeys = await getAllHealthyServiceKeys(userId, "zerion")
    console.log(`[sync-worker] zerionTargets=${zerionTargets.length} zerionKeys=${zerionKeys.length} (${zerionKeys.map(k => `${k.label ?? k.id.slice(0,6)}:${k.consecutive429}×429`).join(", ")})`)
    if (zerionKeys.length === 0) {
      for (const state of zerionTargets) {
        await db.transactionSyncState.update({
          where: { id: state.id },
          data: {
            isComplete: true,
            phase: "needs_key",
            lastErrorCode: "zerion_key_missing",
            lastErrorMessage: "Zerion API key required for EVM transaction history",
          },
        })
        results.push({
          wallet: state.walletAddress,
          chain: state.chain,
          newTransactions: 0,
          requestsProcessed: 0,
          isComplete: true,
          errors: [{ code: "zerion_key_missing", message: "Zerion API key required for EVM transaction history", retryable: false }],
        })
      }
    } else {
      for (const state of zerionTargets) {
        try {
          const run = await syncZerionWalletStep({
            userId,
            walletAddress: state.walletAddress,
            zerionKeys,
            maxRequests: opts?.maxRequestsPerSync ?? MAX_STEP_REQUESTS_DEFAULT,
            maxMs: opts?.maxMsPerSync ?? MAX_STEP_MS_DEFAULT,
          })
          results.push(run)

          if (run.isComplete && run.newTransactions === 0) {
            const totalZerionRecords = await db.transactionCache.count({
              where: { userId, walletAddress: state.walletAddress.toLowerCase() },
            })
            if (totalZerionRecords === 0) {
              console.log(`[sync] Zerion returned 0 txs for ${state.walletAddress.slice(0, 10)}… — creating Alchemy fallback states`)
              for (const chain of SYNC_CHAINS.filter((c) => c !== "SOLANA")) {
                const created = await ensureWalletChainSyncState(userId, state.walletAddress, chain)
                if (created) {
                  alchemyTargets.push(created)
                }
              }
            }
          }
        } catch (err) {
          results.push({
            wallet: state.walletAddress,
            chain: state.chain,
            newTransactions: 0,
            requestsProcessed: 0,
            isComplete: true,
            errors: [{ code: "sync_crash", message: err instanceof Error ? err.message : "Unexpected Zerion sync error", retryable: true }],
          })
        }
      }
    }
  }

  const heliusKeys = await getAllHealthyServiceKeys(userId, "helius")
  for (const state of solTargets) {
    if (heliusKeys.length === 0) {
      await db.transactionSyncState.update({
        where: { id: state.id },
        data: {
          isComplete: true,
          phase: "failed",
          lastErrorCode: "helius_key_missing",
          lastErrorMessage: "Helius API key required for Solana sync",
        },
      })
      results.push({
        wallet: state.walletAddress,
        chain: "SOLANA",
        newTransactions: 0,
        requestsProcessed: 0,
        isComplete: true,
        errors: [{ code: "helius_key_missing", message: "Helius API key required for Solana sync", retryable: false }],
      })
      continue
    }
    const run = await syncSolanaWalletStep({
      userId,
      walletAddress: state.walletAddress,
      heliusKeys,
      maxRequests: opts?.maxRequestsPerSync ?? MAX_STEP_REQUESTS_DEFAULT,
      maxMs: opts?.maxMsPerSync ?? MAX_STEP_MS_DEFAULT,
    })
    results.push(run)
  }

  const latestStates = await db.transactionSyncState.findMany({
    where: { userId },
    orderBy: [{ isComplete: "asc" }, { updatedAt: "asc" }],
  })

  const totalSyncs = latestStates.length
  const processedSyncs = latestStates.filter((s) => s.isComplete).length
  const failedSyncs = latestStates.filter((s) => s.isComplete && !!s.lastErrorCode && s.phase !== "skipped" && s.phase !== "needs_key").length
  const insertedTxCount = latestStates.reduce((sum, s) => sum + (s.recordsInserted ?? 0), 0)

  let status: HistoryJobStatus = "running"
  let completedAt: Date | null = null

  if (processedSyncs === totalSyncs && totalSyncs > 0) {
    completedAt = new Date()
    if (failedSyncs === 0) status = "completed"
    else if (failedSyncs === totalSyncs) status = "failed"
    else status = "partial"
  }

  await db.historySyncJob.update({
    where: { id: job.id },
    data: {
      status,
      lastRunAt: new Date(),
      completedAt,
      insertedTxCount,
      processedSyncs,
      failedSyncs,
      cursorSnapshot: buildCursorSnapshot(latestStates),
      error: status === "failed" ? "All wallet/chain syncs failed" : null,
    },
  })

  return {
    jobId: job.id,
    status,
    totalSyncs,
    processedSyncs,
    failedSyncs,
    insertedTxCount,
    results,
    completedAt: completedAt?.toISOString() ?? null,
  }
}
