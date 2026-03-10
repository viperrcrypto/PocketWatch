/**
 * Sync state management: ensure, query, and reset sync states for wallets/chains.
 */

import { db } from "@/lib/db"
import { ALCHEMY_TRANSFER_CHAINS, ETHERSCAN_SYNC_CHAINS, isSolanaAddress } from "@/lib/tracker/chains"
import { ZERION_MULTI_CHAIN } from "../zerion-transaction-fetcher"
import type { HistoryJobStatus } from "./types"

/** All chains that support transaction sync (Alchemy + Etherscan-family + Solana via Helius) */
export const SYNC_CHAINS: string[] = [
  ...Object.keys(ALCHEMY_TRANSFER_CHAINS).filter(
    (chain) => !!ALCHEMY_TRANSFER_CHAINS[chain as keyof typeof ALCHEMY_TRANSFER_CHAINS],
  ),
  ...Object.keys(ETHERSCAN_SYNC_CHAINS).filter(
    (chain) => !!ETHERSCAN_SYNC_CHAINS[chain as keyof typeof ETHERSCAN_SYNC_CHAINS],
  ),
  "SOLANA",
]

export async function ensureWalletChainSyncState(userId: string, walletAddress: string, chain: string) {
  const addr = chain === "SOLANA" ? walletAddress : walletAddress.toLowerCase()
  return db.transactionSyncState.upsert({
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
}

export async function ensureSyncStatesForUser(userId: string): Promise<number> {
  const [wallets, zerionKeyCount] = await Promise.all([
    db.trackedWallet.findMany({ where: { userId }, select: { address: true } }),
    db.externalApiKey.count({ where: { userId, serviceName: "zerion", verified: true } }),
  ])

  const useZerion = zerionKeyCount > 0
  let created = 0

  console.log(`[sync] ensureSyncStatesForUser uid=${userId.slice(0, 8)} wallets=${wallets.length} zerionKeys=${zerionKeyCount} useZerion=${useZerion}`)

  for (const wallet of wallets) {
    const addr = wallet.address.slice(0, 10)
    if (isSolanaAddress(wallet.address)) {
      await ensureWalletChainSyncState(userId, wallet.address, "SOLANA")
      console.log(`[sync]   ${addr}… → SOLANA`)
      created++
    } else if (useZerion) {
      await ensureWalletChainSyncState(userId, wallet.address, ZERION_MULTI_CHAIN)
      console.log(`[sync]   ${addr}… → ZERION_MULTI`)
      created++
    } else {
      for (const chain of SYNC_CHAINS.filter((c) => c !== "SOLANA")) {
        await ensureWalletChainSyncState(userId, wallet.address, chain)
        created++
      }
      console.log(`[sync]   ${addr}… → Alchemy fallback (${SYNC_CHAINS.length - 1} chains) — add Zerion key to use faster path`)
    }
  }

  // Clean up stale sync states from invalid wallet-chain combos
  const allStates = await db.transactionSyncState.findMany({
    where: { userId, isComplete: false },
    select: { id: true, walletAddress: true, chain: true },
  })

  const zerionEmptyWallets = new Set<string>()
  if (useZerion) {
    const zerionStates = await db.transactionSyncState.findMany({
      where: { userId, chain: ZERION_MULTI_CHAIN, isComplete: true },
      select: { walletAddress: true, recordsInserted: true },
    })
    const candidateAddrs = zerionStates
      .filter((zs) => zs.recordsInserted === 0)
      .map((zs) => zs.walletAddress.toLowerCase())

    if (candidateAddrs.length > 0) {
      const walletsWithData = await db.transactionCache.groupBy({
        by: ["walletAddress"],
        where: { userId, walletAddress: { in: candidateAddrs } },
        _count: { _all: true },
      })
      const walletsWithDataSet = new Set(walletsWithData.map((w) => w.walletAddress.toLowerCase()))
      for (const addr of candidateAddrs) {
        if (!walletsWithDataSet.has(addr)) {
          zerionEmptyWallets.add(addr)
        }
      }
    }
  }

  for (const state of allStates) {
    const isSol = isSolanaAddress(state.walletAddress)
    const isZerionMulti = state.chain === ZERION_MULTI_CHAIN

    const solanaWithEvmChain = isSol && state.chain !== "SOLANA"
    const evmWithSolanaChain = !isSol && state.chain === "SOLANA"
    const isZerionFallback = zerionEmptyWallets.has(state.walletAddress.toLowerCase())
    const obsoleteAlchemy = !isSol && !isZerionMulti && useZerion && !isZerionFallback

    if (solanaWithEvmChain || evmWithSolanaChain || obsoleteAlchemy) {
      await db.transactionSyncState.update({
        where: { id: state.id },
        data: { isComplete: true, phase: "skipped", lastErrorCode: null, lastErrorMessage: null },
      })
    }
  }

  return created
}

export async function getLatestHistorySyncJob(userId: string) {
  return db.historySyncJob.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  })
}

/**
 * Get sync progress for all wallets/chains.
 */
export async function getSyncProgress(userId: string) {
  const states = await db.transactionSyncState.findMany({
    where: { userId },
    orderBy: [{ walletAddress: "asc" }, { chain: "asc" }],
  })

  const txCounts = await db.transactionCache.groupBy({
    by: ["walletAddress", "chain"],
    where: { userId },
    _count: true,
  })

  const countMap = new Map<string, number>()
  for (const row of txCounts) {
    countMap.set(`${row.walletAddress}:${row.chain}`, row._count)
  }

  return states.map((s) => ({
    walletAddress: s.walletAddress,
    chain: s.chain,
    lastBlockFetched: s.lastBlockFetched,
    isComplete: s.isComplete,
    phase: s.phase,
    cursorFromBlock: s.cursorFromBlock,
    cursorToBlock: s.cursorToBlock,
    pageKey: s.pageKey,
    retryAfter: s.retryAfter,
    lastErrorCode: s.lastErrorCode,
    lastErrorMessage: s.lastErrorMessage,
    requestsProcessed: s.requestsProcessed,
    recordsInserted: s.recordsInserted,
    highWaterMark: s.highWaterMark ?? null,
    syncMode: s.syncMode ?? "historical",
    transactionCount: countMap.get(`${s.walletAddress}:${s.chain}`) ?? 0,
    updatedAt: s.updatedAt,
  }))
}

/**
 * Check whether an incremental sync is due for a user.
 */
export async function isIncrementalSyncStale(userId: string, thresholdMs = 3_600_000): Promise<boolean> {
  const states = await db.transactionSyncState.findMany({
    where: { userId },
    select: { isComplete: true, highWaterMark: true, updatedAt: true },
  })

  if (states.length === 0) return false

  const allComplete = states.every((s) => s.isComplete)
  if (!allComplete) return false

  const anyHasHighWaterMark = states.some((s) => s.highWaterMark !== null)
  if (!anyHasHighWaterMark) return false

  const latestUpdate = Math.max(...states.map((s) => s.updatedAt.getTime()))
  return Date.now() - latestUpdate > thresholdMs
}

/**
 * Reset completed sync states to incremental mode and queue a new history sync job.
 */
export async function scheduleIncrementalSync(userId: string): Promise<{ jobId: string; status: HistoryJobStatus } | null> {
  const completedWithHWM = await db.transactionSyncState.findMany({
    where: { userId, isComplete: true, highWaterMark: { not: null } },
    select: { id: true },
  })

  if (completedWithHWM.length === 0) return null

  await db.transactionSyncState.updateMany({
    where: { userId, isComplete: true, highWaterMark: { not: null } },
    data: {
      isComplete: false,
      phase: "bootstrap",
      syncMode: "incremental",
      cursorFromBlock: null,
      cursorToBlock: null,
      pageKey: null,
      retryAfter: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })

  // Import dynamically to avoid circular dependency
  const { startOrResumeHistorySyncJob } = await import("./job-manager")
  return startOrResumeHistorySyncJob(userId)
}
