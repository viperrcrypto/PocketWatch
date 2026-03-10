"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"

// Lazy-load non-critical UI — keeps them out of the initial JS bundle
const DynamicToaster = dynamic(
  () => import("sonner").then((m) => ({ default: m.Toaster }))
)
const DynamicPWAPrompt = dynamic(
  () => import("@/components/pwa-install-prompt").then((m) => ({ default: m.PWAInstallPrompt }))
)

function useActiveTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const html = document.documentElement
    setTheme((html.getAttribute("data-theme") as "light" | "dark") || "light")

    const observer = new MutationObserver(() => {
      setTheme((html.getAttribute("data-theme") as "light" | "dark") || "light")
    })
    observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] })
    return () => observer.disconnect()
  }, [])

  return theme
}

export function ClientShell() {
  const theme = useActiveTheme()

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[SW] Registration failed:", err)
      })
    }
  }, [])

  return (
    <>
      <DynamicToaster
        theme={theme}
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            color: "var(--foreground)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
          },
        }}
      />
      <DynamicPWAPrompt />
    </>
  )
}
