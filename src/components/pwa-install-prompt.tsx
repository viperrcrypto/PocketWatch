"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "trackme_pwa_install_dismissed"
const DISMISS_DAYS = 7

function getDevicePlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop"
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return "ios"
  if (/android/.test(ua)) return "android"
  return "desktop"
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  )
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const dismissedAt = parseInt(raw, 10)
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
    return daysSince < DISMISS_DAYS
  } catch {
    return false
  }
}

function dismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {}
}

export function PWAInstallPrompt() {
  const [platform, setPlatform] = useState<"ios" | "android" | "hidden">("hidden")
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isStandalone() || isDismissed()) return

    const device = getDevicePlatform()

    if (device === "ios") {
      // iOS Safari only — Chrome/Firefox on iOS won't support Add to Home Screen
      const isSafari =
        /safari/i.test(navigator.userAgent) &&
        !/crios|fxios|chrome/i.test(navigator.userAgent)
      if (isSafari) {
        const timer = setTimeout(() => {
          setPlatform("ios")
          setVisible(true)
        }, 3000)
        return () => clearTimeout(timer)
      }
    } else if (device === "android") {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setPlatform("android")
        setTimeout(() => setVisible(true), 2000)
      }
      window.addEventListener("beforeinstallprompt", handler)
      return () => window.removeEventListener("beforeinstallprompt", handler)
    }
    // Desktop: don't show
  }, [])

  const handleInstallAndroid = useCallback(async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === "accepted") {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    dismiss()
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] safe-area-bottom"
      style={{ animation: "slideUp 0.3s ease-out" }}
    >
      <div
        className="bg-card border-t border-card-border relative mx-auto"
        style={{
          padding: "16px 20px",
          maxWidth: 480,
        }}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            minWidth: 44,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="Dismiss install prompt"
        >
          <span
            className="material-symbols-rounded text-foreground-muted"
            style={{ fontSize: 18 }}
          >
            close
          </span>
        </button>

        {/* App icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <img
            src="/img/pwa-icon-192.png"
            alt=""
            width={40}
            height={40}
            style={{ borderRadius: 8 }}
          />
          <div>
            <div className="text-sm font-semibold text-foreground">
              Install PocketWatch
            </div>
            <div className="text-[11px] text-foreground-muted">
              Quick access from your home screen
            </div>
          </div>
        </div>

        {platform === "android" ? (
          <button
            onClick={handleInstallAndroid}
            className="btn-primary"
            style={{ width: "100%", height: 44 }}
          >
            Install App
          </button>
        ) : (
          /* iOS Safari instructions */
          <div className="text-xs text-foreground-muted leading-[1.8]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-foreground font-semibold min-w-[16px]">1.</span>
              <span>
                Tap the{" "}
                <span className="text-foreground">Share</span>{" "}
                button in Safari
              </span>
              <span
                className="material-symbols-rounded text-info"
                style={{ fontSize: 16 }}
              >
                ios_share
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-foreground font-semibold min-w-[16px]">2.</span>
              <span>
                Scroll down, tap{" "}
                <span className="text-foreground">Add to Home Screen</span>
              </span>
              <span
                className="material-symbols-rounded text-info"
                style={{ fontSize: 16 }}
              >
                add_box
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
