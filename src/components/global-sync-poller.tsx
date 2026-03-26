"use client"

import { useCallback } from "react"
import { useSyncProgress } from "@/hooks/use-portfolio-tracker"
import { useSyncLocalStorage } from "@/hooks/use-sync-settings"
import { useOnlineStatus } from "@/hooks/use-online-status"

/**
 * Invisible component that keeps the sync worker advancing
 * regardless of which page the user is viewing.
 * Mount once in the dashboard layout.
 * Controlled by the "Background Sync" toggle in Settings > Preferences.
 *
 * Includes reconnect recovery: if the network drops and React Query
 * exhausts retries, the polling stalls. On reconnect we manually refetch
 * to restart the interval.
 */
export function GlobalSyncPoller() {
  const { enabled } = useSyncLocalStorage()
  const { refetch } = useSyncProgress({ advance: true, autoStart: true, enabled })

  const handleReconnect = useCallback(() => {
    refetch()
  }, [refetch])

  useOnlineStatus(handleReconnect)
  return null
}
