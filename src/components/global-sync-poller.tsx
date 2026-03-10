"use client"

import { useSyncProgress } from "@/hooks/use-portfolio-tracker"
import { useSyncLocalStorage } from "@/hooks/use-sync-settings"

/**
 * Invisible component that keeps the sync worker advancing
 * regardless of which page the user is viewing.
 * Mount once in the dashboard layout.
 * Controlled by the "Background Sync" toggle in Settings > Preferences.
 */
export function GlobalSyncPoller() {
  const { enabled } = useSyncLocalStorage()
  useSyncProgress({ advance: true, autoStart: true, enabled })
  return null
}
