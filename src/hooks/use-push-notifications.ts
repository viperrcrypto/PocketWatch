"use client"

import { useState, useEffect, useCallback } from "react"
import { csrfHeaders } from "@/lib/csrf-client"

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer as ArrayBuffer
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window
    setIsSupported(supported)

    if (!supported) {
      setIsLoading(false)
      return
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const subscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupported) return { ok: false, error: "Push notifications are not supported in this browser" }
    setIsLoading(true)
    try {
      // Check secure context (required for Push API)
      if (typeof window !== "undefined" && !window.isSecureContext) {
        return { ok: false, error: "Push notifications require HTTPS. Access via https:// or localhost." }
      }

      const permission = await Notification.requestPermission()
      if (permission === "denied") return { ok: false, error: "Notification permission was denied. Reset it in your browser settings." }
      if (permission !== "granted") return { ok: false, error: "Notification permission is required" }

      // Fetch VAPID public key from server
      const keyRes = await fetch("/api/notifications/push/subscribe", { credentials: "include" })
      if (!keyRes.ok) return { ok: false, error: "Failed to get push configuration from server" }
      const { publicKey } = await keyRes.json()
      if (!publicKey) return { ok: false, error: "VAPID keys not configured on server" }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const subJson = sub.toJSON()
      const res = await fetch("/api/notifications/push/subscribe", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      })

      if (!res.ok) return { ok: false, error: "Failed to save push subscription" }
      setIsSubscribed(true)
      return { ok: true }
    } catch (err) {
      console.error("[push] Subscribe failed:", err)
      const msg = err instanceof Error ? err.message : "Unknown error"
      if (msg.includes("secure context") || msg.includes("SecurityError")) {
        return { ok: false, error: "Push notifications require HTTPS. Access via https:// or localhost." }
      }
      return { ok: false, error: `Push subscription failed: ${msg}` }
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        // Send endpoint so server removes only THIS device, not all devices
        await fetch("/api/notifications/push/subscribe", {
          method: "DELETE",
          headers: csrfHeaders({ "Content-Type": "application/json" }),
          credentials: "include",
          body: JSON.stringify({ endpoint }),
        })
      }
      setIsSubscribed(false)
      return true
    } catch (err) {
      console.error("[push] Unsubscribe failed:", err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { isSubscribed, isSupported, isLoading, subscribe, unsubscribe }
}
