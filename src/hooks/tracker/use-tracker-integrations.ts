"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { TrackerApiKeyData, TelegramLinkStatus, AlertRule } from "@/lib/tracker/types"
import { trackerFetch, trackerKeys } from "./shared"

// ─── API Key Management ───

export function useTrackerApiKeys() {
  return useQuery({
    queryKey: trackerKeys.apiKeys(),
    queryFn: () => trackerFetch<{ apiKeys: TrackerApiKeyData[] }>("/api-keys"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useSetTrackerApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { service: string; apiKey: string }) =>
      trackerFetch<{ success: boolean }>("/api-keys", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trackerKeys.apiKeys() })
    },
  })
}

export function useDeleteTrackerApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (service: string) =>
      trackerFetch<{ success: boolean }>(`/api-keys?service=${encodeURIComponent(service)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trackerKeys.apiKeys() })
    },
  })
}

// ─── Telegram Integration ───

export function useTelegramLink() {
  return useQuery({
    queryKey: trackerKeys.telegram(),
    queryFn: () => trackerFetch<TelegramLinkStatus>("/telegram/link"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useGenerateLinkCode() {
  return useMutation({
    mutationFn: () =>
      trackerFetch<{ code: string; expiresAt: string }>("/telegram/link-code", {
        method: "POST",
      }),
  })
}

export function useUnlinkTelegram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      trackerFetch<{ success: boolean }>("/telegram/link", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trackerKeys.telegram() })
    },
  })
}

export function useUpdateTelegramSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { alertRules?: AlertRule[]; isActive?: boolean }) => {
      const { alertRules, ...rest } = data
      return trackerFetch<{ success: boolean }>("/telegram/settings", {
        method: "PATCH",
        body: JSON.stringify({ preferences: alertRules, ...rest }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trackerKeys.telegram() })
    },
  })
}
