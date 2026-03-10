"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { fetchJSON } from "@/lib/fetch-json"

// ─── Prefetch dashboard stats and seed updates on login ───
export function usePrefetchDashboardTabs(enabled = true) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    // High priority: dashboard stats + seed updates
    qc.prefetchQuery({
      queryKey: ["dashboard-stats"],
      queryFn: () => fetchJSON("/api/dashboard/stats"),
      staleTime: 5 * 60 * 1000,
    })
    qc.prefetchQuery({
      queryKey: ["updates-seed"],
      queryFn: () => fetchJSON("/api/discord/webhook?seed=true"),
      staleTime: 10 * 60 * 1000,
    })

    const cleanups: (() => void)[] = []

    const scheduleIdle = (fn: () => void, delayMs: number) => {
      const timer = setTimeout(() => {
        if (typeof requestIdleCallback !== "undefined") {
          const idleId = requestIdleCallback(fn, { timeout: 5000 })
          cleanups.push(() => cancelIdleCallback(idleId))
        } else {
          fn()
        }
      }, delayMs)
      cleanups.push(() => clearTimeout(timer))
    }

    // Batch 1 (~1s): lightweight static data
    scheduleIdle(() => {
      qc.prefetchQuery({
        queryKey: ["events"],
        queryFn: () => fetchJSON("/api/events"),
        staleTime: 5 * 60 * 1000,
      })
      qc.prefetchQuery({
        queryKey: ["forum-categories"],
        queryFn: () => fetchJSON("/api/forum"),
        staleTime: 15 * 60 * 1000,
      })
    }, 1000)

    // Batch 2 (~2s): common tab data
    scheduleIdle(() => {
      qc.prefetchQuery({
        queryKey: ["updates", "all", 1, 20],
        queryFn: () => fetchJSON("/api/discord/webhook?page=1&limit=20"),
        staleTime: 10 * 60 * 1000,
      })
      qc.prefetchQuery({
        queryKey: ["deal-campaigns", { includeArchived: false }],
        queryFn: () => fetchJSON("/api/deals/campaigns?includeArchived=false"),
        staleTime: 30 * 1000,
      })
    }, 2000)

    // Batch 3 (~3s): less frequently visited tabs
    scheduleIdle(() => {
      qc.prefetchQuery({
        queryKey: ["raffles", "all"],
        queryFn: () => fetchJSON("/api/raffles"),
        staleTime: 2 * 60 * 1000,
      })
      qc.prefetchQuery({
        queryKey: ["forms"],
        queryFn: () => fetchJSON("/api/forms"),
        staleTime: 2 * 60 * 1000,
      })
    }, 3000)

    return () => cleanups.forEach((fn) => fn())
  }, [qc, enabled])
}
