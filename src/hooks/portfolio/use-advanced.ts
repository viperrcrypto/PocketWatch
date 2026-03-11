"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { toast } from "sonner"
import { portfolioFetch, portfolioKeys } from "./shared"

// ─── Quality check types ───

export interface QualityCheckIssue {
  severity: "error" | "warning" | "info"
  chain: string | null
  wallet: string | null
  code: string
  message: string
  detail?: string
}

export interface QualityCheckResponse {
  success: boolean
  score: number
  verdict: string
  syncRunning: boolean
  totalRows: number
  walletCount: number
  chainCount: number
  chainDetail: Record<string, {
    count: number
    earliest: string | null
    latest: string | null
    spanDays: number | null
    categories: Record<string, number>
    directions: { in: number; out: number }
    syncComplete: boolean
    syncPhase: string | null
    syncError: string | null
    recordsInserted: number
    dbVsSyncDelta: number | null
  }>
  walletDetail: Array<{
    wallet: string
    chain: string
    count: number
    syncComplete: boolean
    syncPhase: string | null
    syncError: string | null
    recordsInserted: number
    dbVsSyncDelta: number | null
  }>
  issues: QualityCheckIssue[]
  counts: { errors: number; warnings: number; info: number }
  syncStates: Array<{
    chain: string
    wallet: string
    isComplete: boolean
    phase: string
    errorCode: string | null
    requestsProcessed: number
    recordsInserted: number
    syncMode: string
  }>
  checkedAt: string
}

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

// ─── 12a-iii. Data Quality Check ───

export function useDataQualityCheck(enabled = false) {
  return useQuery({
    queryKey: [...portfolioKeys.all, "history", "quality-check"],
    queryFn: () => portfolioFetch<QualityCheckResponse>("/history/quality-check"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled,
    retry: 1,
  })
}

// ─── Repair Action ───

export function useRepairAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { action: RepairAction; chain?: string; wallet?: string }) =>
      portfolioFetch<{ success: boolean; message: string; [key: string]: unknown }>(
        "/history/quality-check",
        { method: "POST", body: JSON.stringify(params) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "quality-check"] })
      qc.invalidateQueries({ queryKey: portfolioKeys.all })
    },
  })
}

// ─── 32. LP Positions (Uniswap V3) ───

export function useLPPositions() {
  return useQuery({
    queryKey: portfolioKeys.lpPositions(),
    queryFn: () => portfolioFetch<any>("/balances/lp"),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ─── 33. Transaction Classification ───

export function useClassifyTransactions(params: {
  page?: number
  limit?: number
  classification?: string | null
  asset?: string | null
  chain?: string | null
  search?: string | null
  unreviewed?: boolean
  direction?: string | null
}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set("page", String(params.page))
  if (params.limit) searchParams.set("limit", String(params.limit))
  if (params.classification) searchParams.set("classification", params.classification)
  if (params.asset) searchParams.set("asset", params.asset)
  if (params.chain) searchParams.set("chain", params.chain)
  if (params.search) searchParams.set("search", params.search)
  if (params.unreviewed) searchParams.set("unreviewed", "true")
  if (params.direction) searchParams.set("direction", params.direction)

  return useQuery({
    queryKey: portfolioKeys.classify(params),
    queryFn: () => portfolioFetch<any>(`/history/classify?${searchParams.toString()}`),
    placeholderData: keepPreviousData,
  })
}

export function useSetManualClassification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      ids?: string[]
      transactionId?: string
      transactionIds?: string[]
      classification: string | null
    }) => {
      // Normalize to { ids, classification } for the API
      const ids = body.ids
        ?? (body.transactionId ? [body.transactionId] : undefined)
        ?? body.transactionIds
        ?? []
      return portfolioFetch<any>("/history/classify", {
        method: "PATCH",
        body: JSON.stringify({ ids, classification: body.classification }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "classify"] })
      toast.success("Classification updated")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
