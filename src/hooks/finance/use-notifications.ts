/**
 * React Query hooks for the notification settings system.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ─── Query Keys ──────────────────────────────────────────────

export const notificationKeys = {
  all: ["notifications"] as const,
  settings: () => [...notificationKeys.all, "settings"] as const,
  vapidKey: () => [...notificationKeys.all, "vapid-key"] as const,
}

// ─── Fetch Helper ────────────────────────────────────────────

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

// ─── Queries ─────────────────────────────────────────────────

export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationKeys.settings(),
    queryFn: () => notifyFetch<{
      channels: Array<{ channel: string; configured: boolean; updatedAt: string | null }>
      recentAlerts: Array<{
        id: string
        alertType: string
        title: string
        message: string
        amount: number | null
        merchantName: string | null
        sentAt: string
        channels: string[]
      }>
    }>("/settings"),
    staleTime: 30_000,
  })
}

export function useVapidKey() {
  return useQuery({
    queryKey: notificationKeys.vapidKey(),
    queryFn: () => notifyFetch<{ publicKey: string }>("/push/subscribe"),
    staleTime: Infinity,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useSaveNotificationChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { channel: string; webhookUrl?: string; botToken?: string; chatId?: string; topic?: string; serverUrl?: string; token?: string }) =>
      notifyFetch<{ saved: boolean }>("/settings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.settings() }),
  })
}

export function useDeleteNotificationChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (channel: string) =>
      notifyFetch<{ deleted: boolean }>(`/settings?channel=${channel}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.settings() }),
  })
}

export function useTestNotification() {
  return useMutation({
    mutationFn: (channel?: string) =>
      notifyFetch<{ sent: number; total: number; results: Array<{ channel: string; sent: boolean; error?: string }> }>(
        `/test${channel ? `?channel=${channel}` : ""}`,
        { method: "POST" },
      ),
  })
}
