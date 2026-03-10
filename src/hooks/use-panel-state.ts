"use client"

import { useState, useEffect, useCallback } from "react"

export function usePanelState(key: string, defaultOpen = true) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) {
        setIsOpen(stored === "true")
      } else {
        const isDesktop = window.matchMedia("(min-width: 1024px)").matches
        setIsOpen(isDesktop && defaultOpen)
      }
    } catch {
      // localStorage unavailable
    }
  }, [key, defaultOpen])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      try { localStorage.setItem(key, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [key])

  const close = useCallback(() => {
    setIsOpen(false)
    try { localStorage.setItem(key, "false") } catch { /* ignore */ }
  }, [key])

  return { isOpen, toggle, close } as const
}
