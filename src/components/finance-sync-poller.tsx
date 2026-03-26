"use client"

import { useEffect, useRef, useCallback } from "react"
import { financeFetch } from "@/hooks/finance/shared"
import { useQueryClient } from "@tanstack/react-query"
import { useOnlineStatus } from "@/hooks/use-online-status"

const SYNC_INTERVAL_MS = 15 * 60_000 // 15 minutes
const STALE_THRESHOLD_MS = 10 * 60_000 // Skip if synced within 10 min
const SYNC_TIMEOUT_MS = 30_000 // 30s timeout (was 120s — too long on spotty mobile)

/**
 * Invisible component that auto-syncs all finance data (Plaid + SimpleFIN + investments)
 * every 15 minutes in the background. Skips if recently synced manually.
 * Mount once in the dashboard layout.
 *
 * Includes: reduced timeout for mobile, reconnect-triggered sync.
 */
export function FinanceSyncPoller() {
  const qc = useQueryClient()
  const syncingRef = useRef(false)
  const lastSyncRef = useRef(0)

  const sync = useCallback(async () => {
    if (syncingRef.current) return
    if (!navigator.onLine) return
    if (Date.now() - lastSyncRef.current < STALE_THRESHOLD_MS) return

    syncingRef.current = true
    try {
      await financeFetch("/plaid/resync", { method: "POST", timeoutMs: SYNC_TIMEOUT_MS })
      lastSyncRef.current = Date.now()
      qc.invalidateQueries({ queryKey: ["finance"] })
    } catch {
      // Silent — background sync shouldn't disturb the user
    } finally {
      syncingRef.current = false
    }
  }, [qc])

  // Reconnect recovery: sync immediately when coming back online
  useOnlineStatus(sync)

  useEffect(() => {
    const interval = setInterval(sync, SYNC_INTERVAL_MS)
    const initialTimeout = setTimeout(sync, 30_000)
    return () => {
      clearInterval(interval)
      clearTimeout(initialTimeout)
    }
  }, [sync])

  return null
}
