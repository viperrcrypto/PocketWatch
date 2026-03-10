"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"

// ─── Snapshot types ───

export interface NetValueHistoryPoint {
  timestamp: number
  total_value: number
  total_usd_value: number
  source: string
}

export interface NetValueHistoryMeta {
  scope: "onchain" | "total"
  effectiveScope?: "onchain" | "total"
  range: "ALL" | "1Y" | "3M" | "1W" | "1D"
  status: "ready" | "syncing" | "insufficient_history"
  coverageStart: string | null
  coverageEnd: string | null
  incompleteSyncCount: number
  warningCode: "onchain_sync_incomplete" | "onchain_missing_coverage" | "total_sparse_history" | null
  asOf?: string | null
  freshnessMs?: number | null
  stale?: boolean
  nextEligibleRefreshAt?: string | null
  refreshJob?: { status: "queued" | "running" | "completed" | "failed"; jobId: string } | null
}

export interface NetValueHistoryResponse {
  points: NetValueHistoryPoint[]
  meta: NetValueHistoryMeta
}

function normalizeNetValueHistoryPayload(
  payload: unknown,
  scope: "onchain" | "total",
  range: "ALL" | "1Y" | "3M" | "1W" | "1D"
): NetValueHistoryResponse {
  if (Array.isArray(payload)) {
    return {
      points: payload as NetValueHistoryPoint[],
      meta: {
        scope,
        range,
        status: "ready",
        coverageStart: null,
        coverageEnd: null,
        incompleteSyncCount: 0,
        warningCode: null,
      },
    }
  }

  const obj = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
  const points = Array.isArray(obj.points) ? (obj.points as NetValueHistoryPoint[]) : []
  const meta = (obj.meta && typeof obj.meta === "object" ? obj.meta : {}) as Partial<NetValueHistoryMeta>

  return {
    points,
    meta: {
      scope: meta.scope ?? scope,
      effectiveScope: meta.effectiveScope ?? meta.scope ?? scope,
      range: meta.range ?? range,
      status: meta.status ?? "ready",
      coverageStart: meta.coverageStart ?? null,
      coverageEnd: meta.coverageEnd ?? null,
      incompleteSyncCount: meta.incompleteSyncCount ?? 0,
      warningCode: meta.warningCode ?? null,
      asOf: meta.asOf ?? null,
      freshnessMs: meta.freshnessMs ?? null,
      stale: meta.stale ?? false,
      nextEligibleRefreshAt: meta.nextEligibleRefreshAt ?? null,
      refreshJob: meta.refreshJob ?? null,
    },
  }
}

// ─── 12. Net Value History (Snapshots) ───

export function useNetValueHistory(
  range: "ALL" | "1Y" | "3M" | "1W" | "1D" = "ALL",
  scope: "onchain" | "total" = "total"
) {
  const params = new URLSearchParams({ range, scope })
  return useQuery({
    queryKey: portfolioKeys.netValueHistory(range, scope),
    queryFn: async () => {
      const payload = await portfolioFetch<unknown>(`/history/snapshots?${params.toString()}`)
      return normalizeNetValueHistoryPayload(payload, scope, range)
    },
    staleTime: 5 * 60_000,
    retry: 1,
    // Poll every 15s if we have no chart points yet (waiting for snapshots to build)
    refetchInterval: (query) => {
      const data = query.state.data as NetValueHistoryResponse | undefined
      const hasPoints = (data?.points?.length ?? 0) > 1
      return hasPoints ? false : 15_000
    },
  })
}

// ─── 12a. Wipe Chart Data ───

export function useWipeChartData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<{ success: boolean; purged: { snapshots: number; chartCache: number; syncStates: number } }>(
        "/history/snapshots",
        { method: "DELETE" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "snapshots"] })
    },
  })
}

// ─── 12a-ii. Wipe All Transaction Data & Restart Sync ───

export function useWipeAndRestartSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<{
        success: boolean
        purged: {
          transactionCache: number
          syncStates: number
          chartCache: number
          snapshots: number
          providerGates: number
          usageMinutes: number
          jobsReset: number
        }
        newJob: { jobId: string; status: string }
      }>("/history/wipe", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.all })
    },
  })
}

// ─── 12b. Take Portfolio Snapshot (manual) ───

export function useTakeSnapshot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<any>("/history/snapshots", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...portfolioKeys.all, "history", "snapshots"] })
    },
  })
}
