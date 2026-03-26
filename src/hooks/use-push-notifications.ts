"use client"

import { useState, useEffect, useCallback } from "react"

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

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false
    setIsLoading(true)
    try {
      // Request notification permission first
      const permission = await Notification.requestPermission()
      if (permission !== "granted") return false

      // Fetch VAPID public key from server
      const keyRes = await fetch("/api/notifications/push/subscribe", { credentials: "include" })
      if (!keyRes.ok) throw new Error("Failed to get VAPID key")
      const { publicKey } = await keyRes.json()
      if (!publicKey) throw new Error("No VAPID key configured")

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const subJson = sub.toJSON()
      const res = await fetch("/api/notifications/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      })

      if (!res.ok) throw new Error("Failed to save subscription")
      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error("[push] Subscribe failed:", err)
      return false
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
          headers: { "Content-Type": "application/json" },
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
