"use client"

import { useSyncExternalStore, useCallback } from "react"

const STORAGE_KEY = "wt:background-sync-enabled"

function getSnapshot(): boolean {
  if (typeof window === "undefined") return true
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === null ? true : raw === "true"
}

function getServerSnapshot(): boolean {
  return true
}

function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback()
  }
  window.addEventListener("storage", handler)
  // Also listen for custom events so same-tab updates propagate
  window.addEventListener("wt:sync-settings", callback)
  return () => {
    window.removeEventListener("storage", handler)
    window.removeEventListener("wt:sync-settings", callback)
  }
}

export function useSyncLocalStorage() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setEnabled = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(value))
    window.dispatchEvent(new Event("wt:sync-settings"))
  }, [])

  return { enabled, setEnabled }
}
