/**
 * Account, Plaid link, SimpleFIN, and sync hooks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { csrfHeaders } from "@/lib/csrf-client"
import { financeFetch, financeKeys } from "./shared"

const COMBINED_NET_WORTH_KEY = ["combined-net-worth"]

async function triggerClearAll() {
  await fetch("/api/user/clear-data", { method: "POST", credentials: "include", headers: csrfHeaders() }).catch((err) => {
    console.warn("[triggerClearAll] Failed to clear data:", err)
  })
}

// ─── Types ──────────────────────────────────────────────────────

interface InstitutionWithAccounts {
  id: string
  provider: string
  institutionName: string
  institutionLogo: string | null
  status: string
  errorMessage: string | null
  lastSyncedAt: string | null
  accounts: Array<{
    id: string
    externalId: string
    linkedExternalId: string | null
    name: string
    officialName: string | null
    type: string
    subtype: string | null
    mask: string | null
    currentBalance: number | null
    availableBalance: number | null
    creditLimit: number | null
    currency: string
    isHidden: boolean
  }>
}

// ─── Account Hooks ──────────────────────────────────────────────

export function useFinanceAccounts() {
  return useQuery({
    queryKey: financeKeys.accounts(),
    queryFn: () => financeFetch<InstitutionWithAccounts[]>("/accounts"),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { accountId: string; name?: string; isHidden?: boolean; type?: string }) =>
      financeFetch("/accounts", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.accounts() }),
  })
}

export function useDisconnectInstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (institutionId: string) =>
      financeFetch(`/accounts?institutionId=${institutionId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      qc.invalidateQueries({ queryKey: COMBINED_NET_WORTH_KEY })
    },
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accountId: string) =>
      financeFetch<{ deleted: boolean; institutionRemoved: boolean }>(
        `/accounts?accountId=${accountId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      qc.invalidateQueries({ queryKey: COMBINED_NET_WORTH_KEY })
    },
  })
}

// ─── Account Spending Hook ───────────────────────────────────────

interface AccountSpendingData {
  accountId: string
  name: string
  totalSpending: number
  topCategories: Array<{ category: string; amount: number }>
  recentTransactions: Array<{ date: string; name: string; amount: number }>
  balanceHistory: number[]
}

export function useAccountSpending(period = "this-month") {
  return useQuery({
    queryKey: financeKeys.accountSpending(period),
    queryFn: () =>
      financeFetch<{ accounts: AccountSpendingData[] }>(
        `/accounts/spending?period=${period}`
      ),
  })
}

// ─── Account Identity Hook ───────────────────────────────────────

export function useAccountIdentity() {
  return useQuery({
    queryKey: financeKeys.identity(),
    queryFn: () => financeFetch<{
      accounts: Array<{
        accountId: string; accountName: string | null; mask: string | null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ownerNames: string[][]; emails: Array<any>; phoneNumbers: Array<any>; addresses: Array<any>
      }>
    }>("/identity"),
  })
}

// ─── Plaid Link Hooks ───────────────────────────────────────────

export function useCreateLinkToken() {
  return useMutation({
    mutationFn: () =>
      financeFetch<{ linkToken: string }>("/plaid/link-token", { method: "POST" }),
  })
}

export function useExchangePlaidToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { publicToken: string; institutionId: string }) =>
      financeFetch<{ institutionId: string; institutionName: string; accountCount: number }>(
        "/plaid/exchange",
        { method: "POST", body: JSON.stringify(data) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

// ─── Plaid Reconnect Hooks ──────────────────────────────────────

export function useCreateReconnectToken() {
  return useMutation({
    mutationFn: (institutionId: string) =>
      financeFetch<{ linkToken: string; institutionId: string; institutionName: string }>(
        "/plaid/reconnect",
        { method: "POST", body: JSON.stringify({ institutionId }) },
      ),
  })
}

export function useCompleteReconnect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (institutionId: string) =>
      financeFetch<{ success: boolean }>(
        "/plaid/reconnect",
        { method: "PATCH", body: JSON.stringify({ institutionId }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

export function usePlaidSyncStatus() {
  return useQuery({
    queryKey: financeKeys.plaidSyncStatus(),
    queryFn: () => financeFetch<{
      institutions: Array<{
        id: string; name: string; logo: string | null; lastSyncedAt: string | null
        dataTypes: Record<string, string | null>
      }>
    }>("/plaid/sync-status"),
  })
}

export function useResyncPlaidData() {
  const qc = useQueryClient()
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: () => financeFetch<any>("/plaid/resync", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

// ─── SimpleFIN Hooks ────────────────────────────────────────────

export function useConnectSimpleFIN() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (setupToken: string) =>
      financeFetch<{ institutionId: string; institutionName: string; accountCount: number }>("/simplefin/connect", {
        method: "POST",
        body: JSON.stringify({ setupToken }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

// ─── Sync Hooks ─────────────────────────────────────────────────

export function useSyncInstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (institutionId: string) =>
      financeFetch("/sync", {
        method: "POST",
        body: JSON.stringify({ institutionId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

export function useSyncAll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => financeFetch("/sync", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

export function useFetchFullHistory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      financeFetch<{ fetched: number; inserted: number }>(
        "/sync/history",
        { method: "POST" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}
