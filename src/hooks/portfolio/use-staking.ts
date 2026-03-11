"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"

// ─── 29. Staking Positions ───

export function useStakingPositions() {
  return useQuery({
    queryKey: portfolioKeys.staking(),
    queryFn: () => portfolioFetch<any>("/staking"),
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    retry: 0,
  })
}

// ─── 29b. Staking History ───

export function useStakingHistory(
  params?: number | {
    year?: number
    range?: "ytd" | "year" | "all"
    positionKey?: string
    protocol?: string
  },
) {
  const resolved = typeof params === "number"
    ? { year: params }
    : (params ?? {})

  return useQuery({
    queryKey: portfolioKeys.stakingHistory(resolved),
    queryFn: () => {
      const qs = new URLSearchParams()
      if (resolved.year) qs.set("year", String(resolved.year))
      if (resolved.range) qs.set("range", resolved.range)
      if (resolved.positionKey) qs.set("positionKey", resolved.positionKey)
      if (resolved.protocol) qs.set("protocol", resolved.protocol)
      const suffix = qs.toString() ? `?${qs.toString()}` : ""
      return portfolioFetch<any>(`/staking/history${suffix}`)
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ─── 29c. Refresh Staking (force-refresh) ───

export function useRefreshStaking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<any>("/staking", { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(portfolioKeys.staking(), data)
      qc.invalidateQueries({ queryKey: portfolioKeys.stakingHistoryRoot() })
    },
  })
}

// ─── 29d. Rebuild Staking (reset lifecycle + recompute) ───

export function useRebuildStaking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<any>("/staking?action=rebuild", { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(portfolioKeys.staking(), data)
      qc.invalidateQueries({ queryKey: portfolioKeys.stakingHistoryRoot() })
    },
  })
}
