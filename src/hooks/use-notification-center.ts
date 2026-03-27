/**
 * Hooks for the notification center — bell badge, history, mark-as-read.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { notificationKeys } from "./finance/use-notifications"
import { csrfHeaders } from "@/lib/csrf-client"

async function notifyFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/notifications${path}`, {
    ...options,
    credentials: "include",
    headers: csrfHeaders({ "Content-Type": "application/json", ...options?.headers }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Query Keys ──────────────────────────────────────────────

const HISTORY_PREFIX = [...notificationKeys.all, "history"] as const

export const centerKeys = {
  all: notificationKeys.all,
  unread: () => [...notificationKeys.all, "unread"] as const,
  historyPrefix: () => HISTORY_PREFIX,
  history: (filters?: Record<string, unknown>) => [...HISTORY_PREFIX, filters] as const,
  preferences: () => [...notificationKeys.all, "preferences"] as const,
}

// ─── Types ───────────────────────────────────────────────────

export interface NotificationItem {
  id: string
  category: string
  alertType: string
  severity: string
  title: string
  body: string
  metadata: Record<string, unknown> | null
  channels: string[]
  readAt: string | null
  sentAt: string
}

export interface NotificationPrefs {
  channelSeverity: Record<string, string>
  categories: Record<string, boolean>
  quietEnabled: boolean
  quietStart: string
  quietEnd: string
  quietOverride: boolean
}

// ─── Queries ─────────────────────────────────────────────────

export function useUnreadCount() {
  return useQuery({
    queryKey: centerKeys.unread(),
    queryFn: () => notifyFetch<{ count: number }>("/unread"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useNotificationHistory(filters?: { limit?: number; offset?: number; category?: string; severity?: string }) {
  const params = new URLSearchParams()
  if (filters?.limit !== undefined) params.set("limit", String(filters.limit))
  if (filters?.offset !== undefined) params.set("offset", String(filters.offset))
  if (filters?.category) params.set("category", filters.category)
  if (filters?.severity) params.set("severity", filters.severity)
  const qs = params.toString()

  return useQuery({
    queryKey: centerKeys.history(filters as Record<string, unknown>),
    queryFn: () => notifyFetch<{ items: NotificationItem[]; total: number; limit: number; offset: number }>(
      `/history${qs ? `?${qs}` : ""}`,
    ),
    staleTime: 30_000,
  })
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: centerKeys.preferences(),
    queryFn: () => notifyFetch<NotificationPrefs>("/preferences"),
    staleTime: 60_000,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      notifyFetch<{ updated: number }>("/history", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: centerKeys.unread() })
      qc.invalidateQueries({ queryKey: centerKeys.historyPrefix() })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      notifyFetch<{ updated: number }>("/history", { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: centerKeys.unread() })
      qc.invalidateQueries({ queryKey: centerKeys.historyPrefix() })
    },
  })
}

export function useSavePreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prefs: Partial<NotificationPrefs>) =>
      notifyFetch<{ ok: boolean }>("/preferences", {
        method: "PUT",
        body: JSON.stringify(prefs),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: centerKeys.preferences() })
    },
  })
}
