"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"

// ─── Sync progress types ───

export interface SyncProgressRow {
  walletAddress: string
  chain: string
  isComplete: boolean
  phase: string
  lastBlockFetched: number
  retryAfter: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  requestsProcessed: number
  recordsInserted: number
  highWaterMark: number | null
  syncMode: string
  transactionCount: number
  updatedAt: string
}

export interface SyncProgressResponse {
  success: boolean
  job?: { jobId: string; status: "queued" | "running" | "partial" | "completed" | "failed" } | null
  progress: SyncProgressRow[]
  totalSyncs: number
  processedSyncs: number
  progressPct: number
  failedSyncs: number
  failedDetails?: Array<{
    walletAddress: string
    chain: string
    code: string
    message: string | null
    retryAfter: string | null
  }>
  allComplete: boolean
  throttled: boolean
  nextAdvanceAt: string | null
  budgetState?: {
    alchemy?: {
      provider: string
      operationCount: number
      activeLeases: number
      nextAllowedAt: string | null
    }
    helius?: {
      provider: string
      operationCount: number
      activeLeases: number
      nextAllowedAt: string | null
    }
  }
  keyHealth?: Record<string, Array<{
    id: string
    label: string | null
    service: string
    consecutive429: number
    lastUsedAt: string | null
    lastErrorAt: string | null
    verified: boolean
    active: boolean
  }>>
  autoStarted?: { jobId: string; status: string } | null
  advanced?: {
    status: string
    processedSyncs: number
    failedSyncs: number
    insertedTxCount: number
  } | null
}

export interface RepairSummaryResponse {
  userId: string
  walletFingerprint: string
  walletCount: number
  coverageStart: { timestamp: number; iso: string } | null
  sync: {
    states: number
    incompleteSyncCount: number
    syncErrorCount: number
    latestStateUpdate: string | null
  }
  latestPoints: {
    total: { timestamp: number; iso: string; value: number; source: string } | null
    onchain: { timestamp: number; iso: string; value: number; source: string } | null
  }
  seriesSanity: Array<{
    source: string
    _count: { _all: number }
    _min: { createdAt: string | null; totalValue: number | null }
    _max: { createdAt: string | null; totalValue: number | null }
  }>
  generatedAt: string
}

// ─── 11a5. Sync Progress (shows when last sync happened) ───

export function useSyncProgress(options?: {
  advance?: boolean
  reconstruct?: boolean
  autoStart?: boolean
  enabled?: boolean
}) {
  const advance = options?.advance ?? true
  const reconstruct = options?.reconstruct ?? false
  const autoStart = options?.autoStart ?? true
  const enabled = options?.enabled ?? true

  const params = new URLSearchParams()
  if (advance) params.set("advance", "1")
  if (reconstruct) params.set("reconstruct", "1")
  if (autoStart) params.set("autoStart", "1")
  const qs = params.toString()

  return useQuery({
    queryKey: portfolioKeys.syncProgress(qs),
    queryFn: () => portfolioFetch<SyncProgressResponse>(`/history/sync${qs ? `?${qs}` : ""}`),
    staleTime: 60_000,
    enabled,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data as any
      const status = data?.job?.status
      const allComplete = Boolean(data?.allComplete)
      if (status === "running") return 4_000
      if (status === "queued") return 6_000

      const nextAdvanceAt = typeof data?.nextAdvanceAt === "string"
        ? Date.parse(data.nextAdvanceAt)
        : Number.NaN
      if (Boolean(data?.throttled) && Number.isFinite(nextAdvanceAt)) {
        const msUntil = Math.max(0, nextAdvanceAt - Date.now())
        if (msUntil <= 0) return 1_500
        return Math.min(60_000, Math.max(4_000, msUntil + 1_000))
      }

      if (!allComplete && advance) return 30_000
      return 60_000
    },
  })
}

// ─── History Repair Summary ───

export function useHistoryRepairSummary(enabled = true) {
  return useQuery({
    queryKey: portfolioKeys.repairSummary(),
    queryFn: () => portfolioFetch<RepairSummaryResponse>("/history/repair-summary"),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    enabled,
    retry: 1,
  })
}

// ─── Trigger History Sync (from any page) ───

export function useTriggerHistorySync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<any>("/history/sync", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "sync-progress"] })
      qc.invalidateQueries({ queryKey: portfolioKeys.staking() })
      qc.invalidateQueries({ queryKey: portfolioKeys.stakingHistoryRoot() })
    },
  })
}

// ─── 30. Refresh Balances (triggers background task) ───

export function useRefreshBalances() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<any>("/balances", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.balances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.overview() })
      qc.invalidateQueries({ queryKey: portfolioKeys.blockchainBalances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.exchangeBalances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.manualBalances() })
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "snapshots"] })
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "sync-progress"] })
    },
  })
}
