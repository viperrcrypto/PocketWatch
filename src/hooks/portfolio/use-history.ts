"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { toast } from "sonner"
import { portfolioFetch, portfolioKeys } from "./shared"

// ─── 11. History Events ───

export function useHistoryEvents(params: {
  offset?: number
  limit?: number
  event_type?: string
  asset?: string
  search?: string
  from_timestamp?: number
  to_timestamp?: number
  source?: "onchain" | "exchange" | "all"
  exchangeId?: string
  wallet_address?: string
} = {}) {
  const searchParams = new URLSearchParams()
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset))
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit))
  if (params.event_type) searchParams.set("event_type", params.event_type)
  if (params.asset) searchParams.set("asset", params.asset)
  if (params.search) searchParams.set("search", params.search)
  if (params.from_timestamp !== undefined) searchParams.set("from_timestamp", String(params.from_timestamp))
  if (params.to_timestamp !== undefined) searchParams.set("to_timestamp", String(params.to_timestamp))
  if (params.source) searchParams.set("source", params.source)
  if (params.exchangeId) searchParams.set("exchangeId", params.exchangeId)
  if (params.wallet_address) searchParams.set("wallet_address", params.wallet_address)
  const qs = searchParams.toString()

  return useQuery({
    queryKey: portfolioKeys.historyEvents(params),
    queryFn: () => portfolioFetch<any>(`/history/events${qs ? `?${qs}` : ""}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

// ─── 11b. Process History (trigger Alchemy sync + price resolution) ───

export function useProcessHistory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<any>("/history/sync?reconstruct=true", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "events"] })
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "snapshots"] })
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "sync-progress"] })
      qc.invalidateQueries({ queryKey: portfolioKeys.staking() })
      qc.invalidateQueries({ queryKey: portfolioKeys.stakingHistoryRoot() })
    },
  })
}

// ─── 11c. Reset Stuck Sync (clear retryAfter + gate consecutive429) ───

export function useResetSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<{ success: boolean; syncRowsReset: number; gatesReset: number }>(
        "/history/sync/reset",
        { method: "DELETE" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "sync-progress"] })
    },
  })
}

// ─── 5e. Exchange Transactions (History) ───

export function useExchangeTransactions() {
  return useExchangeTransactionsWithFilters({})
}

export function useExchangeTransactionsWithFilters(params: {
  exchangeId?: string
  type?: string
  asset?: string
  from_timestamp?: number
  to_timestamp?: number
  offset?: number
  limit?: number
} = {}) {
  const searchParams = new URLSearchParams()
  if (params.exchangeId) searchParams.set("exchangeId", params.exchangeId)
  if (params.type) searchParams.set("type", params.type)
  if (params.asset) searchParams.set("asset", params.asset)
  if (params.from_timestamp !== undefined) searchParams.set("from_timestamp", String(params.from_timestamp))
  if (params.to_timestamp !== undefined) searchParams.set("to_timestamp", String(params.to_timestamp))
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset))
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit))
  const qs = searchParams.toString()

  return useQuery({
    queryKey: [...portfolioKeys.exchangeTransactions(), params],
    queryFn: () => portfolioFetch<any>(`/history/exchange${qs ? `?${qs}` : ""}`),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ─── 5f. Refresh Exchange Transactions ───

export function useRefreshExchangeTransactions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: { exchangeId?: string }) =>
      portfolioFetch<any>("/history/exchange", {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "exchange"] })
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "events"] })
    },
  })
}

// ─── Flag / Whitelist Transactions ───

export function useFlagTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { txHash: string; chain: string; walletAddress: string; flagged: boolean }) =>
      portfolioFetch<{ success: boolean; isFlagged: boolean }>("/history/flags", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: portfolioKeys.historyEvents({}) })
      toast.success(vars.flagged ? "Transaction flagged" : "Flag removed")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update flag")
    },
  })
}

export function useWhitelistTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { txHash: string; chain: string; walletAddress: string; whitelisted: boolean }) =>
      portfolioFetch<{ success: boolean; isWhitelisted: boolean }>("/history/flags", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: portfolioKeys.historyEvents({}) })
      toast.success(vars.whitelisted ? "Marked as not spam" : "Whitelist removed")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update whitelist")
    },
  })
}
