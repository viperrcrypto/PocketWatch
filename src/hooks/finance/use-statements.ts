/**
 * React Query hooks for statement upload and data coverage analysis.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { csrfHeaders } from "@/lib/csrf-client"
import { financeKeys, financeFetch } from "./shared"
import type { AccountCoverage, StatementUploadResult } from "@/lib/finance/statement-types"

interface CoverageResponse {
  accounts: AccountCoverage[]
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
        body: form, // No Content-Type — browser sets multipart boundary
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
