"use client"

import { useState, useEffect } from "react"

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

  return { isSubscribed, isSupported, isLoading }
}
