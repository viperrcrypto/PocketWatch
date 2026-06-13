/**
 * Trip CRUD hooks — list, detail, create, update, delete.
 * Mirrors the per-module fetch helper + query-key factory pattern
 * (see src/hooks/travel/shared.ts).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { csrfHeaders } from "@/lib/csrf-client"

// ─── Types (mirror the API select exactly) ──────────────────────

export type TripStatus = "upcoming" | "active" | "past"
export type TripSegmentType = "flight" | "hotel" | "car" | "activity"

export interface Trip {
  id: string
  name: string
  destination: string | null
  startDate: string
  endDate: string | null
  status: TripStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface TripSegment {
  id: string
  type: TripSegmentType
  title: string
  startAt: string | null
  endAt: string | null
  location: string | null
  details: unknown
  createdAt: string
}

export interface TripDetail extends Trip {
  segments: TripSegment[]
}

export interface TripSpend {
  count: number
  total: number
  byCategory: ReadonlyArray<{ category: string; total: number; count: number }>
}

export interface TripTaggedTransaction {
  id: string
  date: string
  name: string
  merchantName: string | null
  amount: number
  category: string | null
}

export interface GmailAccount {
  /** Lowercased account email, or null for a legacy unknown-email account. */
  email: string | null
  /** FinanceCredential service string identifying this account. */
  service: string
}

export interface GmailSyncResult {
  scanned: number
  imported: number
  skipped: number
  trips: { id: string; name: string }[]
  accounts: { email: string | null; imported: number }[]
}

export interface CreateTripInput {
  name: string
  startDate: string
  destination?: string
  endDate?: string
  status?: TripStatus
  notes?: string
}

export interface UpdateTripInput {
  id: string
  name?: string
  destination?: string | null
  startDate?: string
  endDate?: string | null
  status?: TripStatus
  notes?: string | null
}

// ─── Fetch Helper ───────────────────────────────────────────────

async function tripFetch<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = 30_000, ...fetchOptions } = options ?? {}
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`/api/trips${path}`, {
      ...fetchOptions,
      credentials: "include",
      headers: csrfHeaders({
        "Content-Type": "application/json",
        ...fetchOptions?.headers,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }

    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Query Key Factory ──────────────────────────────────────────

export const tripKeys = {
  all: ["trips"] as const,
  lists: () => [...tripKeys.all, "list"] as const,
  detail: (id: string) => [...tripKeys.all, "detail", id] as const,
  gmail: () => [...tripKeys.all, "gmail-connection"] as const,
}

// ─── Hooks ──────────────────────────────────────────────────────

export function useTrips() {
  return useQuery({
    queryKey: tripKeys.lists(),
    queryFn: () => tripFetch<{ trips: Trip[] }>("").then((d) => d.trips),
  })
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () =>
      tripFetch<{ trip: TripDetail; spend: TripSpend; taggedTransactions: TripTaggedTransaction[] }>(
        `/${id}`,
      ),
    enabled: !!id,
  })
}

/**
 * Untag a single transaction from its trip (sets tripId = null).
 * Hits the finance transactions endpoint directly (not /api/trips), so it uses
 * a plain CSRF-authenticated fetch rather than tripFetch.
 */
export function useUntagTripTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ transactionId }: { transactionId: string; tripId: string }) => {
      const res = await fetch("/api/finance/transactions", {
        method: "PATCH",
        credentials: "include",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ transactionId, tripId: null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed: ${res.status}`)
      }
      return res.json()
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: tripKeys.detail(vars.tripId) }),
  })
}

export function useCreateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTripInput) =>
      tripFetch<{ trip: Trip }>("", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.lists() }),
  })
}

export function useUpdateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateTripInput) =>
      tripFetch<{ trip: TripDetail }>(`/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: tripKeys.lists() })
      qc.invalidateQueries({ queryKey: tripKeys.detail(vars.id) })
    },
  })
}

export function useDeleteTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      tripFetch<{ deleted: boolean }>(`/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: tripKeys.lists() })
      qc.removeQueries({ queryKey: tripKeys.detail(id) })
    },
  })
}

/** The user's connected Gmail accounts (drives the connect/sync/accounts UI). */
export function useGmailAccounts() {
  return useQuery({
    queryKey: tripKeys.gmail(),
    queryFn: () =>
      tripFetch<{ connected: boolean; accounts: GmailAccount[] }>("/sync-gmail").then(
        (d) => d.accounts,
      ),
  })
}

/** Disconnect one connected Gmail account by its FinanceCredential service. */
export function useDisconnectGmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (service: string) => {
      const res = await fetch(
        `/api/integrations/gmail/account?service=${encodeURIComponent(service)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: csrfHeaders(),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed: ${res.status}`)
      }
      return res.json() as Promise<{
        disconnected: string
        accounts: GmailAccount[]
      }>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.gmail() }),
  })
}

/** Scan Gmail for travel confirmations and import new ones as trips. */
export function useSyncGmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      tripFetch<GmailSyncResult>("/sync-gmail", { method: "POST", timeoutMs: 120_000 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.lists() }),
  })
}

/** Auto-tag the user's transactions in this trip's date window to the trip. */
export function useTagTripExpenses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      tripFetch<{ tagged: number }>(`/${id}/expenses`, { method: "POST" }),
    onSuccess: (_data, id) => qc.invalidateQueries({ queryKey: tripKeys.detail(id) }),
  })
}
