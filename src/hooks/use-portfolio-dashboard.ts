/**
 * Derived-data hooks for the portfolio dashboard.
 * Chart-related hooks are in use-portfolio-chart-data.ts.
 */

import { useMemo } from "react"
import {
  NATIVE_CHAIN_MAP,
  CAIP_CHAIN_MAP,
  LOCATION_CHAIN_MAP,
  parseFlatAssets,
  parsePerAccountAssets,
} from "@/lib/portfolio/overview-helpers"
import { aggregatePositionsBySymbol } from "@/lib/portfolio/aggregated-assets"

// ─── Total value ───

export function useTotalValue(
  overview: any,
  balancesLoading: boolean,
  blockchainLoading: boolean,
) {
  const balancesTotal = useMemo(() => {
    if (!overview) return 0
    for (const key of ["totalValue", "net_usd", "net_value", "net_usd_value", "total_usd_value", "total"]) {
      const v = (overview as any)[key]
      if (v != null && v !== "") {
        const parsed = parseFloat(String(v))
        if (parsed > 0) return parsed
      }
    }
    const totals = (overview as any).totals
    if (totals) {
      for (const key of ["net_usd", "net_value", "total_usd_value"]) {
        const v = totals[key]
        if (v != null && v !== "") {
          const parsed = parseFloat(String(v))
          if (parsed > 0) return parsed
        }
      }
    }
    return 0
  }, [overview])

  return {
    totalValue: balancesTotal,
    balancesSettled: !balancesLoading && !blockchainLoading,
    bothSourcesLoading: balancesLoading || blockchainLoading,
  }
}

// ─── On-chain value ───

export function useOnchainValue(overview: any, totalValue: number) {
  return useMemo(() => {
    const direct = (overview as any)?.onchainTotalValue
    if (typeof direct === "number" && direct > 0) return direct

    const chainDist = (overview as any)?.chainDistribution
    if (chainDist && typeof chainDist === "object") {
      let sum = 0
      for (const [chain, value] of Object.entries(chainDist as Record<string, unknown>)) {
        if (chain.toLowerCase() === "exchange") continue
        const parsed = typeof value === "number" ? value : parseFloat(String(value))
        if (Number.isFinite(parsed) && parsed > 0) sum += parsed
      }
      if (sum > 0) return sum
    }

    const exchangeSummary = (overview as any)?.exchangeSummary
    if (Array.isArray(exchangeSummary)) {
      const exchangeTotal = exchangeSummary.reduce((sum: number, item: any) => {
        const parsed = parseFloat(String(item?.totalValue ?? 0))
        return Number.isFinite(parsed) && parsed > 0 ? sum + parsed : sum
      }, 0)
      if (exchangeTotal > 0 && totalValue > exchangeTotal) return totalValue - exchangeTotal
    }

    return 0
  }, [overview, totalValue])
}

// ─── Asset parsing & aggregation ───

export function useAssetData(overview: any) {
  const rawPositions = useMemo(() => {
    const result: Array<{
      symbol: string; balance: number; value: number; chain?: string;
      wallet?: string; walletLabel?: string; iconUrl?: string; assetId?: string;
    }> = []

    const positions = (overview as any)?.positions
    if (Array.isArray(positions) && positions.length > 0) {
      for (const p of positions) {
        if (!p?.symbol) continue
        const val = parseFloat(String(p.value ?? 0)) || 0
        const amt = parseFloat(String(p.balance ?? p.quantity ?? 0)) || 0
        if (val <= 0 && amt <= 0) continue
        result.push({
          symbol: p.symbol, balance: amt, value: val, chain: p.chain,
          wallet: p.wallet, walletLabel: p.walletLabel, iconUrl: p.iconUrl,
          assetId: p.assetId ?? p.symbol,
        })
      }
    }

    if (result.length === 0) {
      let flatAssets: Array<{ asset: string; amount: number; usd_value: number }> = []
      if (overview?.assets && typeof overview.assets === "object") {
        flatAssets = parseFlatAssets(overview.assets as Record<string, any>)
      }
      if (flatAssets.length === 0) {
        const totals = (overview as any)?.totals
        if (totals?.assets && typeof totals.assets === "object") {
          flatAssets = parseFlatAssets(totals.assets as Record<string, any>)
        }
      }
      if (flatAssets.length === 0) {
        const perAccount = (overview as any)?.per_account
        if (perAccount && typeof perAccount === "object") {
          flatAssets = parsePerAccountAssets(perAccount)
        }
      }
      for (const a of flatAssets) {
        result.push({ symbol: a.asset, balance: a.amount, value: a.usd_value, assetId: a.asset })
      }
    }

    return result
  }, [overview])

  const aggregatedAssets = useMemo(() => aggregatePositionsBySymbol(rawPositions), [rawPositions])
  const overviewAssets = useMemo(
    () => aggregatedAssets.map((a) => ({ asset: a.assetId, amount: a.totalAmount, usd_value: a.totalValue })),
    [aggregatedAssets],
  )

  return { rawPositions, aggregatedAssets, overviewAssets }
}

export function useBlockchainAssets(blockchainData: any) {
  return useMemo(() => {
    if (!blockchainData) return []
    const data = blockchainData as Record<string, any>
    if (data.error) return []
    if (data.totals?.assets && typeof data.totals.assets === "object") {
      const r = parseFlatAssets(data.totals.assets as Record<string, any>)
      if (r.length > 0) return r
    }
    if (data.per_account && typeof data.per_account === "object") {
      const r = parsePerAccountAssets(data.per_account)
      if (r.length > 0) return r
    }
    return []
  }, [blockchainData])
}

export function useMergedAssets(
  overviewAssets: { asset: string; amount: number; usd_value: number }[],
  blockchainAssets: { asset: string; amount: number; usd_value: number }[],
) {
  return useMemo(() => {
    const assetMap = new Map<string, { asset: string; amount: number; usd_value: number }>()
    for (const a of overviewAssets) {
      const existing = assetMap.get(a.asset)
      if (!existing || a.usd_value > existing.usd_value) assetMap.set(a.asset, a)
    }
    for (const a of blockchainAssets) {
      const existing = assetMap.get(a.asset)
      if (!existing || a.usd_value > existing.usd_value) assetMap.set(a.asset, a)
    }
    return Array.from(assetMap.values()).sort((a, b) => b.usd_value - a.usd_value)
  }, [overviewAssets, blockchainAssets])
}

// ─── Icon / prices / location maps ───

export function useIconMap(overview: any, blockchainData: any) {
  return useMemo(() => {
    const map: Record<string, string> = {}
    const addEntries = (obj: Record<string, any> | undefined) => {
      if (!obj || typeof obj !== "object") return
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") {
          if (!map[k]) map[k] = v
          if (!map[k.toLowerCase()]) map[k.toLowerCase()] = v
        }
      }
    }
    const positions = (overview as any)?.positions
    if (Array.isArray(positions)) {
      for (const p of positions) {
        if (p?.iconUrl && p?.symbol) {
          if (!map[p.symbol]) map[p.symbol] = p.iconUrl
          if (!map[p.symbol.toLowerCase()]) map[p.symbol.toLowerCase()] = p.iconUrl
        }
      }
    }
    addEntries((overview as any)?.icons)
    addEntries((blockchainData as any)?.icons)
    return map
  }, [overview, blockchainData])
}

export function usePricesMap(pricesData: any) {
  return useMemo(() => {
    if (!pricesData?.assets || typeof pricesData.assets !== "object") return {} as Record<string, number>
    const map: Record<string, number> = {}
    for (const [id, price] of Object.entries(pricesData.assets as Record<string, unknown>)) {
      let numPrice: number
      if (typeof price === "number") numPrice = price
      else if (price && typeof price === "object") numPrice = parseFloat(String((price as any).value ?? (price as any).usd_price ?? 0)) || 0
      else numPrice = parseFloat(String(price)) || 0
      map[id] = numPrice
      const lower = id.toLowerCase()
      if (lower !== id && !map[lower]) map[lower] = numPrice
    }
    return map
  }, [pricesData])
}

export function useLocationData(overview: any, topAssets: { asset: string; usd_value: number }[]) {
  return useMemo(() => {
    const parseLocMap = (source: Record<string, unknown>) => {
      const locs: Record<string, number> = {}
      for (const [key, val] of Object.entries(source)) {
        const v = typeof val === "string" ? parseFloat(val) || 0 : typeof val === "number" ? val : 0
        if (v > 0) {
          const chainId = LOCATION_CHAIN_MAP[key.toLowerCase()] || key.toUpperCase()
          locs[chainId] = (locs[chainId] || 0) + v
        }
      }
      return Object.keys(locs).length > 0 ? locs : null
    }

    const chainDist = (overview as any)?.chainDistribution
    if (chainDist && typeof chainDist === "object") {
      const r = parseLocMap(chainDist)
      if (r) return r
    }
    const loc = (overview as any)?.location
    if (loc && typeof loc === "object") {
      const r = parseLocMap(loc)
      if (r) return r
    }
    if (topAssets.length === 0) return {}
    const locs: Record<string, number> = {}
    for (const a of topAssets) {
      let chain: string | undefined
      const caipMatch = a.asset.match(/^eip155:(\d+)\//)
      if (caipMatch) chain = CAIP_CHAIN_MAP[caipMatch[1]]
      else if (!a.asset.includes("/")) chain = NATIVE_CHAIN_MAP[a.asset]
      if (chain) locs[chain] = (locs[chain] || 0) + a.usd_value
    }
    return locs
  }, [overview, topAssets])
}

