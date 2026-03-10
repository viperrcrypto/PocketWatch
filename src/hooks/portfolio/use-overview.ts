"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"

// ─── 3. Portfolio Overview (Balances aggregate) ───

export function usePortfolioOverview() {
  return useQuery({
    queryKey: portfolioKeys.overview(),
    queryFn: () => portfolioFetch<any>("/balances"),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  })
}

// ─── 4. Blockchain Balances ───

export function useBlockchainBalances(chain?: string) {
  const params = chain ? `?chain=${encodeURIComponent(chain)}` : ""
  return useQuery({
    queryKey: portfolioKeys.blockchainBalances(chain),
    queryFn: () => portfolioFetch<any>(`/balances/blockchain${params}`),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  })
}

// ─── 5. Exchange Balances ───

export function useExchangeBalances() {
  return useQuery({
    queryKey: portfolioKeys.exchangeBalances(),
    queryFn: () => portfolioFetch<any>("/balances/exchange"),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ─── 5d. Refresh Exchange Balances ───

export function useRefreshExchangeBalances() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<any>("/balances/exchange", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.exchangeBalances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.overview() })
      qc.invalidateQueries({ queryKey: portfolioKeys.balances() })
    },
  })
}

// ─── 6. Manual Balances ───

export function useManualBalances() {
  return useQuery({
    queryKey: portfolioKeys.manualBalances(),
    queryFn: () => portfolioFetch<any>("/balances/manual"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ─── 7. Add Manual Balance ───

export function useAddManualBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      asset: string
      label: string
      amount: string
      location?: string
      tags?: string[]
    }) =>
      portfolioFetch<any>("/balances/manual", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.manualBalances() })
    },
  })
}
