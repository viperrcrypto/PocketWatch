/**
 * Repair action handlers for the quality check POST endpoint.
 * Each function performs a specific data repair operation and returns a JSON-serializable result.
 */

import { db } from "@/lib/db"
import { SUPPORTED_CHAINS } from "@/lib/tracker/chains"
import type { TrackerChain } from "@/lib/tracker/types"
import { startOrResumeHistorySyncJob } from "@/lib/portfolio/transaction-fetcher"

// ── Types ──

export type RepairAction =
  | "future_timestamps"
  | "ancient_timestamps"
  | "empty_tx_hashes"
  | "zero_value_txs"
  | "null_value_txs"
  | "duplicate_txs"
  | "resync_chain"
  | "resync_all_failed"
  | "clear_throttle"
  | "delete_chain_data"
  | "nuke_wallet"
  | "resync_wallet"

export interface RepairRequest {
  action: RepairAction
  chain?: string
  wallet?: string
}

export interface RepairResult {
  success: boolean
  action: string
  [key: string]: unknown
}

const SYNC_RESET_DATA = {
  isComplete: false,
  phase: "bootstrap",
  syncMode: "historical",
  cursorFromBlock: null,
  cursorToBlock: null,
  pageKey: null,
  retryAfter: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  requestsProcessed: 0,
  recordsInserted: 0,
  highWaterMark: null,
} as const

// ── Repair handlers ──

export async function repairFutureTimestamps(userId: string): Promise<RepairResult> {
  const nowSec = Math.floor(Date.now() / 1000)
  const deleted = await db.transactionCache.deleteMany({
    where: { userId, blockTimestamp: { gt: nowSec + 3600 } },
  })
  return {
    success: true,
    action: "future_timestamps",
    deleted: deleted.count,
    message: `Deleted ${deleted.count} transactions with future timestamps`,
  }
}

export async function repairAncientTimestamps(userId: string): Promise<RepairResult> {
  const deleted = await db.transactionCache.deleteMany({
    where: { userId, blockTimestamp: { lt: 1438300800 } },
  })
  return {
    success: true,
    action: "ancient_timestamps",
    deleted: deleted.count,
    message: `Deleted ${deleted.count} transactions with pre-genesis timestamps`,
  }
}

export async function repairEmptyTxHashes(userId: string): Promise<RepairResult> {
  const deleted = await db.transactionCache.deleteMany({
    where: { userId, txHash: "" },
  })
  return {
    success: true,
    action: "empty_tx_hashes",
    deleted: deleted.count,
    message: `Deleted ${deleted.count} transactions with empty tx hashes`,
  }
}

export function repairZeroValueTxs(): RepairResult {
  return {
    success: false,
    action: "zero_value_txs",
    error: "Zero-value transaction cleanup is disabled — these often include legitimate approvals and contract interactions",
    repaired: 0,
  }
}

export async function repairNullValueTxs(userId: string): Promise<RepairResult> {
  const deleted = await db.transactionCache.deleteMany({
    where: { userId, value: null },
  })
  return {
    success: true,
    action: "null_value_txs",
    deleted: deleted.count,
    message: `Deleted ${deleted.count} null-value transactions`,
  }
}

export async function repairDuplicateTxs(userId: string): Promise<RepairResult> {
  const deleted = await db.$executeRaw`
    DELETE FROM "TransactionCache"
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY "userId", chain, "txHash", category, "from", "to"
          ORDER BY id
        ) AS rn
        FROM "TransactionCache"
        WHERE "userId" = ${userId}
      ) dupes
      WHERE rn > 1
    )
  `
  return {
    success: true,
    action: "duplicate_txs",
    deleted,
    message: `Removed ${deleted} duplicate transaction rows`,
  }
}

export async function repairResyncChain(
  userId: string,
  chain: string | undefined,
  wallet: string | undefined
): Promise<RepairResult | { error: string; code: string; status: number }> {
  if (!chain) {
    return { error: "resync_chain requires a chain parameter", code: "E9100", status: 400 }
  }
  if (!SUPPORTED_CHAINS.includes(chain as TrackerChain)) {
    return { error: `Unknown chain: ${chain}`, code: "E9100", status: 400 }
  }

  const whereClause = {
    userId,
    chain,
    ...(wallet ? { walletAddress: wallet.toLowerCase() } : {}),
  }

  const [deletedTxs, resetStates] = await db.$transaction(async (tx) => {
    const txDel = await tx.transactionCache.deleteMany({ where: whereClause })

    const syncReset = await tx.transactionSyncState.updateMany({
      where: {
        userId,
        chain,
        ...(wallet ? { walletAddress: wallet.toLowerCase() } : {}),
      },
      data: SYNC_RESET_DATA,
    })

    await tx.providerCallGate.deleteMany({
      where: {
        userId,
        operationKey: { contains: chain },
      },
    })

    return [txDel.count, syncReset.count] as const
  })

  const job = await startOrResumeHistorySyncJob(userId)

  return {
    success: true,
    action: "resync_chain",
    chain,
    wallet: wallet ?? null,
    deletedTxs,
    resetSyncStates: resetStates,
    newJob: job,
    message: `Wiped ${deletedTxs} txs and reset ${resetStates} sync states for ${chain}. Fresh sync started.`,
  }
}

export async function repairDeleteChainData(
  userId: string,
  chain: string | undefined
): Promise<RepairResult | { error: string; code: string; status: number }> {
  if (!chain) {
    return { error: "delete_chain_data requires a chain parameter", code: "E9100", status: 400 }
  }

  const [deletedTxs, deletedStates] = await db.$transaction(async (tx) => {
    const txDel = await tx.transactionCache.deleteMany({
      where: { userId, chain },
    })
    const stateDel = await tx.transactionSyncState.deleteMany({
      where: { userId, chain },
    })
    return [txDel.count, stateDel.count] as const
  })

  return {
    success: true,
    action: "delete_chain_data",
    chain,
    deletedTxs,
    deletedSyncStates: deletedStates,
    message: `Deleted ${deletedTxs} txs and ${deletedStates} sync states for ${chain}`,
  }
}

export async function repairResyncAllFailed(userId: string): Promise<RepairResult> {
  const failedStates = await db.transactionSyncState.findMany({
    where: {
      userId,
      isComplete: true,
      lastErrorCode: { not: null },
      phase: { notIn: ["skipped", "needs_key", "completed"] },
    },
    select: { id: true, chain: true, walletAddress: true },
  })

  if (failedStates.length === 0) {
    return {
      success: true,
      action: "resync_all_failed",
      resetCount: 0,
      message: "No failed sync states to retry",
    }
  }

  await db.$transaction(async (tx) => {
    for (const s of failedStates) {
      await tx.transactionCache.deleteMany({
        where: { userId, chain: s.chain, walletAddress: s.walletAddress },
      })
    }

    await tx.transactionSyncState.updateMany({
      where: { id: { in: failedStates.map((s) => s.id) } },
      data: SYNC_RESET_DATA,
    })
  })

  const job = await startOrResumeHistorySyncJob(userId)

  return {
    success: true,
    action: "resync_all_failed",
    resetCount: failedStates.length,
    chains: [...new Set(failedStates.map((s) => s.chain))],
    newJob: job,
    message: `Reset ${failedStates.length} failed syncs and started fresh sync`,
  }
}

export async function repairClearThrottle(userId: string): Promise<RepairResult> {
  const deleted = await db.providerCallGate.deleteMany({
    where: { userId },
  })
  return {
    success: true,
    action: "clear_throttle",
    deleted: deleted.count,
    message: `Cleared ${deleted.count} provider throttle gates — all rate limits reset`,
  }
}

export async function repairNukeWallet(
  userId: string,
  wallet: string | undefined
): Promise<RepairResult | { error: string; code: string; status: number }> {
  if (!wallet) {
    return { error: "nuke_wallet requires a wallet parameter", code: "E9100", status: 400 }
  }
  const addr = wallet.toLowerCase()

  const [deletedTxs, deletedStates] = await db.$transaction(async (tx) => {
    const txDel = await tx.transactionCache.deleteMany({
      where: { userId, walletAddress: addr },
    })
    const stateDel = await tx.transactionSyncState.deleteMany({
      where: { userId, walletAddress: addr },
    })
    await tx.providerCallGate.deleteMany({
      where: {
        userId,
        operationKey: { contains: addr },
      },
    })
    return [txDel.count, stateDel.count] as const
  })

  const job = await startOrResumeHistorySyncJob(userId)

  return {
    success: true,
    action: "nuke_wallet",
    wallet: addr,
    deletedTxs,
    deletedSyncStates: deletedStates,
    newJob: job,
    message: `Nuked ${deletedTxs} txs and ${deletedStates} sync states for wallet ${addr.slice(0, 10)}... Fresh sync started.`,
  }
}

export async function repairResyncWallet(
  userId: string,
  wallet: string | undefined
): Promise<RepairResult | { error: string; code: string; status: number }> {
  if (!wallet) {
    return { error: "resync_wallet requires a wallet parameter", code: "E9100", status: 400 }
  }
  const addr = wallet.toLowerCase()

  const resetStates = await db.transactionSyncState.updateMany({
    where: { userId, walletAddress: addr },
    data: SYNC_RESET_DATA,
  })

  await db.providerCallGate.deleteMany({
    where: {
      userId,
      operationKey: { contains: addr },
    },
  })

  const job = await startOrResumeHistorySyncJob(userId)

  return {
    success: true,
    action: "resync_wallet",
    wallet: addr,
    resetSyncStates: resetStates.count,
    newJob: job,
    message: `Reset ${resetStates.count} sync states for wallet ${addr.slice(0, 10)}... Fresh sync started.`,
  }
}
