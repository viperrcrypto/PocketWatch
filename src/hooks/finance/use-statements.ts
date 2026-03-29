/**
 * React Query hooks for statement upload, data coverage, and manual accounts.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { csrfHeaders } from "@/lib/csrf-client"
import { financeKeys, financeFetch } from "./shared"
import type { AccountCoverage, StatementUploadResult } from "@/lib/finance/statement-types"

interface CoverageResponse {
  accounts: AccountCoverage[]
}

export interface ManualAccount {
  id: string
  name: string
  type: string
  mask: string | null
  createdAt: string
  transactionCount: number
}

export function useAccountCoverage() {
  return useQuery({
    queryKey: financeKeys.coverage(),
    queryFn: () => financeFetch<CoverageResponse>("/coverage"),
  })
}

export function useUploadStatement() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ file, accountId }: { file: File; accountId: string }) => {
      const form = new FormData()
      form.append("file", file)
      form.append("accountId", accountId)

      const res = await fetch("/api/finance/statements", {
        method: "POST",
        credentials: "include",
        headers: csrfHeaders(),
        body: form,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Upload failed: ${res.status}`)
      }

      return res.json() as Promise<StatementUploadResult>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}

export function useManualAccounts() {
  return useQuery({
    queryKey: [...financeKeys.all, "manual-accounts"],
    queryFn: () => financeFetch<ManualAccount[]>("/accounts/manual"),
  })
}

export function useCreateManualAccount() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string; mask?: string; type?: string }) => {
      const res = await fetch("/api/finance/accounts/manual", {
        method: "POST",
        credentials: "include",
        headers: { ...csrfHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed: ${res.status}`)
      }
      return res.json() as Promise<{ id: string; name: string; type: string; mask: string | null; institutionName: string }>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}

export function useDeleteManualAccount() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch(`/api/finance/accounts/manual?accountId=${accountId}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrfHeaders(),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed: ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}
