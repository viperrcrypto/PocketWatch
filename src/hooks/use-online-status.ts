"use client"

import { useState, useEffect, useCallback, useRef } from "react"

/**
 * Tracks browser online/offline state reactively.
 * Falls back to a server ping when navigator.onLine is unreliable (common on macOS).
 */
export function useOnlineStatus(onReconnect?: () => void) {
  const [isOnline, setIsOnline] = useState(true)
  const wasOffline = useRef(false)

  const handleOnline = useCallback(() => {
    setIsOnline(true)
    if (wasOffline.current) {
      wasOffline.current = false
      onReconnect?.()
    }
  }, [onReconnect])

  const handleOffline = useCallback(() => {
    // Don't trust navigator.onLine immediately — verify with a fetch
    fetch("/api/auth/me", { method: "HEAD", cache: "no-store" })
      .then(() => {
        // Server is reachable — navigator.onLine lied
        setIsOnline(true)
      })
      .catch(() => {
        // Actually offline
        wasOffline.current = true
        setIsOnline(false)
      })
  }, [])

  useEffect(() => {
    // Initial check — navigator.onLine can be wrong on mount
    if (!navigator.onLine) {
      handleOffline()
    }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [handleOnline, handleOffline])

  return isOnline
}
