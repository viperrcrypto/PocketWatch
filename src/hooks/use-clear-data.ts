"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { csrfHeaders } from "@/lib/csrf-client"
import { portfolioKeys } from "./portfolio/shared"
import { financeKeys } from "./finance/shared"

const COMBINED_NET_WORTH_KEY = ["combined-net-worth"]

async function clearAllData() {
  const res = await fetch("/api/user/clear-data", { method: "POST", credentials: "include", headers: csrfHeaders() })
  if (!res.ok) throw new Error("Failed to clear data")
  return res.json()
}

/** Wipes all cached portfolio + finance data and removes all query cache. */
export function useClearAllData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: clearAllData,
    onSuccess: () => {
      // removeQueries fully clears cache so stale data doesn't render on navigation
      qc.removeQueries({ queryKey: portfolioKeys.all })
      qc.removeQueries({ queryKey: financeKeys.all })
      qc.removeQueries({ queryKey: COMBINED_NET_WORTH_KEY })
    },
  })
}
