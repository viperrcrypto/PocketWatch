"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { csrfHeaders } from "@/lib/csrf-client"
import { portfolioFetch, portfolioKeys } from "./shared"

const COMBINED_NET_WORTH_KEY = ["combined-net-worth"]

async function triggerClearAll() {
  await fetch("/api/user/clear-data", { method: "POST", credentials: "include", headers: csrfHeaders() }).catch((err) => {
    console.warn("[triggerClearAll] Failed to clear data:", err)
  })
}

// ─── 9. Tracked Accounts ───

export function useTrackedAccounts() {
  return useQuery({
    queryKey: portfolioKeys.accounts(),
    queryFn: () => portfolioFetch<any>("/accounts"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ─── 10. Add Account ───

export function useAddAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      address: string
      chains: string[]
      label?: string
    }) =>
      portfolioFetch<any>("/accounts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.accounts() })
      // Queue one shared refresh job for all portfolio read-models.
      let tokenDetection = false
      try {
        const balResp = await portfolioFetch<any>("/balances", { method: "POST" })
        tokenDetection = !!balResp?._tokenDetectionTriggered
      } catch { /* non-critical */ }
      // Invalidate all balance-related queries so dashboard picks up new data
      qc.invalidateQueries({ queryKey: portfolioKeys.balances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.overview() })
      qc.invalidateQueries({ queryKey: portfolioKeys.blockchainBalances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.prices() })

      // Kick off history sync job for the new wallet
      try {
        await portfolioFetch<any>("/history/sync", { method: "POST" })
      } catch { /* non-critical */ }
      qc.invalidateQueries({ queryKey: portfolioKeys.syncProgress() })

      // Auto-refresh after token detection completes in background
      if (tokenDetection) {
        setTimeout(() => qc.invalidateQueries({ queryKey: portfolioKeys.all }), 15_000)
        setTimeout(() => qc.invalidateQueries({ queryKey: portfolioKeys.all }), 40_000)
      }
    },
  })
}

// ─── 10a. Rename Account ───

export function useRenameAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { address: string; label: string }) =>
      portfolioFetch<any>("/accounts", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.accounts() })
    },
  })
}

// ─── 10a2. Update Account Chains ───

export function useUpdateAccountChains() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { address: string; chains: string[] }) =>
      portfolioFetch<any>("/accounts", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.accounts() })
      qc.invalidateQueries({ queryKey: portfolioKeys.balances() })
    },
  })
}

// ─── 10b. Remove Account ───

export function useRemoveAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { address: string; chains: string[] }) =>
      portfolioFetch<any>("/accounts", {
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
