"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"

interface HiddenTokensResponse {
  hiddenTokens: string[]
}

export function useHiddenTokens() {
  return useQuery({
    queryKey: portfolioKeys.hiddenTokens(),
    queryFn: () => portfolioFetch<HiddenTokensResponse>("/balances/hidden-tokens"),
    staleTime: 5 * 60_000,
  })
}

export function useHideToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (symbol: string) =>
      portfolioFetch<HiddenTokensResponse>("/balances/hidden-tokens", {
        method: "POST",
        body: JSON.stringify({ symbol }),
      }),
    onMutate: async (symbol) => {
      await qc.cancelQueries({ queryKey: portfolioKeys.hiddenTokens() })
      const prev = qc.getQueryData<HiddenTokensResponse>(portfolioKeys.hiddenTokens())
      qc.setQueryData<HiddenTokensResponse>(portfolioKeys.hiddenTokens(), (old) => ({
        hiddenTokens: [...(old?.hiddenTokens ?? []), symbol],
      }))
      return { prev }
    },
    onError: (_err, _symbol, context) => {
      if (context?.prev) qc.setQueryData(portfolioKeys.hiddenTokens(), context.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.hiddenTokens() })
      qc.invalidateQueries({ queryKey: portfolioKeys.blockchainBalances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.balances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.overview() })
    },
  })
}

export function useUnhideToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (symbol: string) =>
      portfolioFetch<HiddenTokensResponse>("/balances/hidden-tokens", {
        method: "DELETE",
        body: JSON.stringify({ symbol }),
      }),
    onMutate: async (symbol) => {
      await qc.cancelQueries({ queryKey: portfolioKeys.hiddenTokens() })
      const prev = qc.getQueryData<HiddenTokensResponse>(portfolioKeys.hiddenTokens())
      qc.setQueryData<HiddenTokensResponse>(portfolioKeys.hiddenTokens(), (old) => ({
        hiddenTokens: (old?.hiddenTokens ?? []).filter((s) => s !== symbol),
      }))
      return { prev }
    },
    onError: (_err, _symbol, context) => {
      if (context?.prev) qc.setQueryData(portfolioKeys.hiddenTokens(), context.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.hiddenTokens() })
      qc.invalidateQueries({ queryKey: portfolioKeys.blockchainBalances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.balances() })
      qc.invalidateQueries({ queryKey: portfolioKeys.overview() })
    },
  })
}
