"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Tracks browser online/offline state reactively.
 * Fires a callback on reconnect so pollers can recover.
 */
export function useOnlineStatus(onReconnect?: () => void) {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  )

  const handleOnline = useCallback(() => {
    setIsOnline(true)
    onReconnect?.()
  }, [onReconnect])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
  }, [])

  useEffect(() => {
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [handleOnline, handleOffline])

  return isOnline
}
