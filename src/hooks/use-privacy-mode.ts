"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "privacyMode"

export function usePrivacyMode() {
  const [isHidden, setIsHidden] = useState(false)

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setIsHidden(true)
    } catch {
      // localStorage unavailable (SSR, private browsing)
    }
  }, [])

  const togglePrivacy = useCallback(() => {
    setIsHidden((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  return { isHidden, togglePrivacy } as const
}
