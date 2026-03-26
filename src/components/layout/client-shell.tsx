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
const DynamicOfflineBanner = dynamic(
  () => import("@/components/offline-banner").then((m) => ({ default: m.OfflineBanner }))
)
const DynamicPushPrompt = dynamic(
  () => import("@/components/push-notification-prompt").then((m) => ({ default: m.PushNotificationPrompt }))
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
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates periodically (every 30 min)
        setInterval(() => reg.update(), 30 * 60 * 1000)

        // Detect when a new SW is waiting to activate
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New version available — show update toast
              import("sonner").then(({ toast }) => {
                toast("Update available", {
                  description: "Tap to refresh and get the latest version.",
                  duration: Infinity,
                  action: {
                    label: "Update",
                    onClick: () => {
                      newWorker.postMessage({ type: "SKIP_WAITING" })
                      window.location.reload()
                    },
                  },
                })
              })
            }
          })
        })
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err)
      })
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
      <DynamicOfflineBanner />
      <DynamicPushPrompt />
    </>
  )
}
