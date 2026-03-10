"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"

// ─── 14. Assets ───

export function useAssets() {
  return useQuery({
    queryKey: portfolioKeys.assets(),
    queryFn: () => portfolioFetch<any>("/assets"),
    staleTime: 10 * 60_000,
    retry: 1,
  })
}

// ─── 14b. Asset Name Mappings ───

export function useAssetMappings(identifiers: string[]) {
  // Only resolve CAIP identifiers (e.g. "eip155:1/erc20:0x..."), skip simple symbols
  const caipIds = identifiers.filter((id) => id.includes("/"))
  return useQuery({
    queryKey: portfolioKeys.assetMappings(caipIds),
    queryFn: async () => {
      if (caipIds.length === 0) return {} as Record<string, { name: string; symbol: string }>
      const data = await portfolioFetch<any>("/assets/mappings", {
        method: "POST",
        body: JSON.stringify({ identifiers: caipIds }),
      })
      // Response: { assets: { [id]: { name, symbol, ... } }, asset_collections: {...} }
      const assets = data?.assets || data || {}
      const map: Record<string, { name: string; symbol: string }> = {}
      for (const [id, info] of Object.entries(assets as Record<string, any>)) {
        if (info?.symbol) {
          map[id] = { name: info.name || info.symbol, symbol: info.symbol }
        }
      }
      return map
    },
    enabled: caipIds.length > 0,
    staleTime: 30 * 60_000,
  })
}

// ─── 17. Manual Prices + Unpriced Tokens ───

export function useUnpricedTokens() {
  return useQuery({
    queryKey: [...portfolioKeys.prices(), "unpriced"] as const,
    queryFn: () => portfolioFetch<any>("/prices/unpriced"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useManualPrices() {
  return useQuery({
    queryKey: [...portfolioKeys.prices(), "manual"] as const,
    queryFn: () => portfolioFetch<any>("/prices/manual"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useSetManualPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { chain: string; asset: string; symbol: string; priceUsd: number }) =>
      portfolioFetch<any>("/prices/manual", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.prices() })
    },
  })
}

export function useDeleteManualPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { chain: string; asset: string }) =>
      portfolioFetch<any>("/prices/manual", {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.prices() })
    },
  })
}

// ─── 18. Latest Prices ───

export function useLatestPrices() {
  return useQuery({
    queryKey: portfolioKeys.prices(),
    queryFn: () => portfolioFetch<any>("/prices"),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
