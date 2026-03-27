"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { csrfHeaders } from "@/lib/csrf-client"
import {
  portfolioFetch,
  portfolioKeys,
  type ExternalServicesResponse,
  type ExternalServiceMutationResult,
} from "./shared"

const COMBINED_NET_WORTH_KEY = ["combined-net-worth"]

async function triggerClearAll() {
  await fetch("/api/user/clear-data", { method: "POST", credentials: "include", headers: csrfHeaders() }).catch((err) => {
    console.warn("[triggerClearAll] Failed to clear data:", err)
  })
}

// ─── 19. Portfolio Settings ───

export function usePortfolioSettings() {
  return useQuery({
    queryKey: portfolioKeys.settings(),
    queryFn: () => portfolioFetch<any>("/settings"),
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

// ─── 20. Update Settings ───

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      portfolioFetch<any>("/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.settings() })
    },
  })
}

// ─── 21. External Services ───

export function useExternalServices() {
  return useQuery({
    queryKey: portfolioKeys.externalServices(),
    queryFn: () => portfolioFetch<ExternalServicesResponse>("/external-services"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ─── 22. Set External Service ───

export function useSetExternalService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; api_key?: string; api_secret?: string; passphrase?: string; label?: string }) =>
      portfolioFetch<ExternalServiceMutationResult>("/external-services", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.externalServices() })
    },
  })
}

// ─── 23. Delete External Service ───

export function useDeleteExternalService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; id?: string }) =>
      portfolioFetch<any>("/external-services", {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await triggerClearAll()
      qc.invalidateQueries({ queryKey: portfolioKeys.all })
      qc.invalidateQueries({ queryKey: COMBINED_NET_WORTH_KEY })
    },
  })
}

// ─── 23b. Rename External Service Key ───

export function useRenameExternalServiceKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { id: string; label: string }) =>
      portfolioFetch<any>("/external-services", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.externalServices() })
    },
  })
}

// ─── 5b. Add Exchange Connection ───

export function useAddExchangeConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; api_key: string; api_secret: string; passphrase?: string }) =>
      portfolioFetch<ExternalServiceMutationResult>("/external-services", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.externalServices() })
      // Queue one shared refresh job for all portfolio read-models.
      try {
        await portfolioFetch<any>("/balances", { method: "POST" })
      } catch (err) { console.warn("[portfolio] Cache bust failed:", (err as Error).message) }
      qc.invalidateQueries({ queryKey: portfolioKeys.exchangeBalances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.overview() })
      qc.invalidateQueries({ queryKey: portfolioKeys.balances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.prices() })
    },
  })
}

// ─── 5c. Remove Exchange Connection ───

export function useRemoveExchangeConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string }) =>
      portfolioFetch<any>("/external-services", {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await triggerClearAll()
      qc.invalidateQueries({ queryKey: portfolioKeys.all })
      qc.invalidateQueries({ queryKey: COMBINED_NET_WORTH_KEY })
    },
  })
}

// ─── 5c2. Verify Exchange Connection ───

export function useVerifyExternalService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; id?: string }) =>
      portfolioFetch<ExternalServiceMutationResult>(
        "/external-services/verify",
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.externalServices() })
    },
  })
}

export function useVerifyExchange() {
  return useVerifyExternalService()
}

// ─── 24. Task Status (Polling) ───

export function useTaskStatus(taskId: string | null) {
  return useQuery({
    queryKey: portfolioKeys.task(taskId),
    queryFn: () => portfolioFetch<any>(`/tasks?taskId=${encodeURIComponent(taskId!)}`),
    enabled: !!taskId,
    refetchInterval: 2000,
    staleTime: 0,
  })
}
