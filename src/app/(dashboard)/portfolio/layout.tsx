"use client"

import { ReactNode, useEffect, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { PortfolioNav } from "@/components/portfolio/portfolio-nav"
import {
  usePortfolioOverview,
  useTrackedAccounts,
} from "@/hooks/use-portfolio-tracker"

/**
 * Prefetch essential portfolio data in the layout.
 *
 * - overview + trackedAccounts: needed by all portfolio sub-pages (kept eager)
 * - netValueHistory, latestPrices, LP positions, staking: deferred to idle
 * - exchangeBalances, manualBalances, externalServices,
 *   portfolioSettings: load on-demand in their sub-pages
 */
function PortfolioPrefetch() {
  // Essential — needed across all portfolio tabs
  usePortfolioOverview()
  useTrackedAccounts()

  // Deferred — warm the cache during idle time
  const qc = useQueryClient()
  useEffect(() => {
    const scheduleIdle = (fn: () => void, fallbackMs: number) => {
      if (typeof requestIdleCallback !== "undefined") {
        const id = requestIdleCallback(fn, { timeout: fallbackMs + 2000 })
        return () => cancelIdleCallback(id)
      }
      const t = setTimeout(fn, fallbackMs)
      return () => clearTimeout(t)
    }

    const fetchJSON = async (url: string) => {
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error(`Failed to fetch ${url}`)
      return res.json()
    }

    const cancel1 = scheduleIdle(() => {
      qc.prefetchQuery({
        queryKey: ["portfolio", "history", "snapshots", "ALL", "total"],
        queryFn: () => fetchJSON("/api/portfolio/history/snapshots?range=ALL&scope=total"),
        staleTime: 5 * 60_000,
      })
    }, 1000)

    const cancel2 = scheduleIdle(() => {
      qc.prefetchQuery({
        queryKey: ["portfolio", "prices"],
        queryFn: () => fetchJSON("/api/portfolio/prices"),
        staleTime: 5 * 60_000,
      })
    }, 2000)

    const cancel4 = scheduleIdle(() => {
      qc.prefetchQuery({
        queryKey: ["portfolio", "balances", "lp"],
        queryFn: () => fetchJSON("/api/portfolio/balances/lp"),
        staleTime: 5 * 60_000,
      })
    }, 3500)

    const cancel5 = scheduleIdle(() => {
      qc.prefetchQuery({
        queryKey: ["portfolio", "staking"],
        queryFn: () => fetchJSON("/api/portfolio/staking"),
        staleTime: 60_000,
      })
    }, 4000)

    return () => { cancel1(); cancel2(); cancel4(); cancel5() }
  }, [qc])

  return null
}

/** Derive a quick asset count from the overview data for the nav badge */
function useAssetCount(): number {
  const { data: overview } = usePortfolioOverview()
  return useMemo(() => {
    if (!overview) return 0
    // Zerion positions array
    const positions = (overview as any)?.positions
    if (Array.isArray(positions) && positions.length > 0) {
      const symbols = new Set(positions.filter((p: any) => p?.symbol).map((p: any) => p.symbol))
      return symbols.size
    }
    // Flat assets map
    const assets = (overview as any)?.assets ?? (overview as any)?.totals?.assets
    if (assets && typeof assets === "object") return Object.keys(assets).length
    return 0
  }, [overview])
}

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  const assetCount = useAssetCount()

  const badges = useMemo(() => {
    if (assetCount <= 0) return undefined
    return { "/portfolio/balances": assetCount }
  }, [assetCount])

  return (
    <div className="space-y-0 fade-in">
      <PortfolioPrefetch />
      {children}
    </div>
  )
}
