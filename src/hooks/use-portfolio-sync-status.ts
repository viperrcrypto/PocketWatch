/**
 * Sync status and wallet info hooks for the portfolio dashboard.
 */

import { useMemo } from "react"

export function useSyncStatus(overview: any, syncProgress: any) {
  const refreshMeta = useMemo(() => {
    const candidate = (overview as any)?.meta
    return candidate && typeof candidate === "object" ? candidate as Record<string, any> : null
  }, [overview])

  return useMemo(() => {
    const refreshJobStatus = typeof refreshMeta?.refreshJob?.status === "string" ? refreshMeta.refreshJob.status : null
    const nextAdvanceAtMs = typeof syncProgress?.nextAdvanceAt === "string" ? Date.parse(syncProgress.nextAdvanceAt) : Number.NaN
    const isActivelyThrottled = Boolean(syncProgress?.throttled) && Number.isFinite(nextAdvanceAtMs) && nextAdvanceAtMs > (Date.now() + 1_000)

    const totalSyncs = syncProgress?.totalSyncs ?? 0
    const processedSyncs = syncProgress?.processedSyncs ?? 0
    const allComplete = syncProgress?.allComplete ?? true
    const jobStatus = syncProgress?.job?.status
    const progressPctRaw = syncProgress?.progressPct ?? (totalSyncs > 0 ? Math.round((processedSyncs / totalSyncs) * 100) : 0)

    const refreshActive = refreshJobStatus === "running" || refreshJobStatus === "queued"
    const effectivelyComplete = allComplete || (progressPctRaw >= 100 && processedSyncs >= totalSyncs && totalSyncs > 0)
    const isSyncing = refreshActive || (!effectivelyComplete && (jobStatus === "running" || jobStatus === "queued"))
    const progress = syncProgress?.progressPct ?? (totalSyncs > 0 ? Math.round((processedSyncs / totalSyncs) * 100) : 0)

    if (isSyncing) {
      return {
        active: true, icon: "sync", title: "Syncing your portfolio",
        detail: totalSyncs > 0 ? `Fetching data across ${totalSyncs} chain${totalSyncs !== 1 ? "s" : ""}...` : "Fetching balances and transaction history...",
        progress, showProgress: totalSyncs > 0, variant: "info" as const,
      }
    }
    if (isActivelyThrottled) {
      const resumeTime = new Date(nextAdvanceAtMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      return {
        active: true, icon: "pace", title: "Sync paused \u2014 rate limited",
        detail: `Resuming at ${resumeTime}. Your data is still available below.`,
        progress, showProgress: false, variant: "warning" as const,
      }
    }
    if (refreshMeta?.stale && !isSyncing) {
      return {
        active: true, icon: "update", title: "Data may be outdated",
        detail: "Hit Refresh to fetch the latest balances.",
        progress: 0, showProgress: false, variant: "muted" as const,
      }
    }
    return null
  }, [refreshMeta, syncProgress])
}

export function useWalletInfoList(overview: any, trackedAccounts: any) {
  return useMemo(() => {
    const list: Array<{ address: string; label?: string }> = []
    const seen = new Set<string>()
    const ws = (overview as any)?.wallets
    if (Array.isArray(ws)) {
      for (const w of ws) {
        if (w?.address) {
          const lower = w.address.toLowerCase()
          if (!seen.has(lower)) { seen.add(lower); list.push({ address: w.address, label: w.label }) }
        }
      }
    }
    if (trackedAccounts && typeof trackedAccounts === "object") {
      for (const chainAccounts of Object.values(trackedAccounts as Record<string, any[]>)) {
        if (!Array.isArray(chainAccounts)) continue
        for (const acct of chainAccounts) {
          if (acct?.address) {
            const lower = acct.address.toLowerCase()
            if (!seen.has(lower)) { seen.add(lower); list.push({ address: acct.address, label: acct.label }) }
          }
        }
      }
    }
    return list
  }, [overview, trackedAccounts])
}
