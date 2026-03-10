"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { TrackerWalletData, TrackerChain } from "@/lib/tracker/types"
import { trackerFetch, trackerKeys } from "./shared"

// ─── Wallet Management ───

export function useTrackerWallets() {
  return useQuery({
    queryKey: trackerKeys.wallets(),
    queryFn: () => trackerFetch<{ wallets: TrackerWalletData[] }>("/wallets"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export function useAddTrackerWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { address: string; label?: string; emoji?: string; chain: TrackerChain }) =>
      trackerFetch<{ wallet: TrackerWalletData }>("/wallets", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trackerKeys.wallets() })
    },
  })
}

export function useUpdateTrackerWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; label?: string; emoji?: string; isActive?: boolean }) =>
      trackerFetch<{ wallet: TrackerWalletData }>(`/wallets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trackerKeys.wallets() })
    },
  })
}

export function useRemoveTrackerWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      trackerFetch<{ success: boolean }>(`/wallets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trackerKeys.wallets() })
      qc.invalidateQueries({ queryKey: trackerKeys.feed({}) })
    },
  })
}

// ─── Wallet Scanning ───

export function useScanWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (walletId: string) =>
      trackerFetch<{
        success: boolean
        found: number
        inserted: number
        lastScannedAt: string
      }>(`/wallets/${walletId}/scan`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trackerKeys.feed({}) })
      qc.invalidateQueries({ queryKey: trackerKeys.wallets() })
      qc.invalidateQueries({ queryKey: [...trackerKeys.all, "analytics"] })
    },
  })
}
