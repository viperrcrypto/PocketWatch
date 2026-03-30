"use client"

import { useState, useEffect } from "react"

/**
 * Detects touch-primary devices via `(pointer: coarse)` media query.
 * Returns `false` on server and during hydration to avoid mismatch.
 * Safe to use for progressive enhancement (desktop → touch upgrades).
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)")
    setIsTouch(mq.matches)

    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return isTouch
}
