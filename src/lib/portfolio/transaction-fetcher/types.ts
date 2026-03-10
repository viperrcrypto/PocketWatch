/**
 * Types and constants for the multi-chain transaction fetcher.
 */

import type { Prisma } from "@/generated/prisma/client"

export type AlchemyCategory = "external" | "erc20" | "erc721" | "internal"
export type SyncDirection = "from" | "to"

export interface AlchemyTransfer {
  blockNum: string
  hash: string
  from: string
  to: string | null
  value: number | null
  asset: string | null
  category: AlchemyCategory
  rawContract: {
    value: string | null
    address: string | null
    decimal: string | null
  }
  metadata: {
    blockTimestamp: string
  }
}

export interface AlchemyResponse {
  result?: {
    transfers: AlchemyTransfer[]
    pageKey?: string
  }
  error?: {
    code?: number
    message?: string
  }
}

export type HistoryJobStatus = "queued" | "running" | "partial" | "completed" | "failed"

export interface SyncErrorDetail {
  code: string
  message: string
  status?: number
  direction?: SyncDirection
  category?: AlchemyCategory
  retryable?: boolean
  retryAfterSec?: number
}

export interface WalletChainSyncResult {
  wallet: string
  chain: string
  newTransactions: number
  requestsProcessed: number
  isComplete: boolean
  errors: SyncErrorDetail[]
  blockedUntil?: string | null
}

export interface HistorySyncRunResult {
  jobId: string
  status: HistoryJobStatus
  totalSyncs: number
  processedSyncs: number
  failedSyncs: number
  insertedTxCount: number
  results: WalletChainSyncResult[]
  completedAt?: string | null
}

export interface SyncStepOptions {
  userId: string
  walletAddress: string
  chain: string
  alchemyKeys: import("../service-keys").ServiceKeyEntry[]
  maxRequests?: number
  maxMs?: number
}

export const CATEGORIES: AlchemyCategory[] = ["external", "erc20", "erc721", "internal"]

export const PHASES: Array<{ direction: SyncDirection; category: AlchemyCategory }> = [
  { direction: "from", category: "external" },
  { direction: "to", category: "external" },
  { direction: "from", category: "erc20" },
  { direction: "to", category: "erc20" },
  { direction: "from", category: "erc721" },
  { direction: "to", category: "erc721" },
  { direction: "from", category: "internal" },
  { direction: "to", category: "internal" },
]

export const WINDOW_BLOCKS = Math.max(2_000, parseInt(process.env.HISTORY_SYNC_WINDOW_BLOCKS ?? "500000", 10) || 500_000)
export const INCREMENTAL_WINDOW_BLOCKS = Math.max(2_000, parseInt(process.env.HISTORY_SYNC_INCREMENTAL_WINDOW ?? "50000", 10) || 50_000)
export const MAX_STEP_REQUESTS_DEFAULT = Math.max(1, parseInt(process.env.HISTORY_SYNC_MAX_STEP_REQUESTS ?? "10", 10) || 10)
export const MAX_STEP_MS_DEFAULT = Math.max(1000, parseInt(process.env.HISTORY_SYNC_MAX_STEP_MS ?? "7000", 10) || 7000)
