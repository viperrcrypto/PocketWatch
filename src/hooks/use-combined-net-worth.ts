"use client"

import { useQuery } from "@tanstack/react-query"

export interface CombinedNetWorthData {
  totalNetWorth: number
  fiat: {
    cash: number
    investments: number
    debt: number
    netWorth: number
  }
  crypto: {
    value: number
    snapshotAt: string | null
  }
  history: Array<{
    date: string
    fiat: number
    crypto: number
    total: number
  }>
}

async function fetchCombinedNetWorth(): Promise<CombinedNetWorthData> {
  const res = await fetch("/api/net-worth", { credentials: "include" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export const combinedNetWorthKeys = {
  all: ["combined-net-worth"] as const,
  summary: () => [...combinedNetWorthKeys.all, "summary"] as const,
}

export function useCombinedNetWorth() {
  return useQuery({
    queryKey: combinedNetWorthKeys.summary(),
    queryFn: fetchCombinedNetWorth,
    staleTime: 2 * 60_000,
  })
}
