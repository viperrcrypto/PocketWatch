"use client"

import { useState, useEffect, useCallback } from "react"
import { usePushNotifications } from "@/hooks/use-push-notifications"

const STORAGE_KEY = "pw_push_prompt_state"
const MIN_SESSIONS = 2

interface PromptState {
  dismissed: boolean
  dismissedAt: number
  sessionCount: number
}

function getPromptState(): PromptState {
  if (typeof window === "undefined") return { dismissed: false, dismissedAt: 0, sessionCount: 0 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { dismissed: false, dismissedAt: 0, sessionCount: 0 }
    return JSON.parse(raw)
  } catch {
    return { dismissed: false, dismissedAt: 0, sessionCount: 0 }
  }
}

function savePromptState(state: PromptState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  )
}

/**
 * Shows a push notification enrollment prompt ONLY when:
 * 1. The app is installed as a PWA (standalone mode)
 * 2. The user has opened the app at least 2 times (not first visit)
 * 3. Push is supported and not already subscribed
 * 4. User hasn't dismissed the prompt in the last 30 days
 */
export function PushNotificationPrompt() {
  const { isSubscribed, isSupported, isLoading, subscribe } = usePushNotifications()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isLoading || isSubscribed || !isSupported) return
    if (!isStandalone()) return

    const state = getPromptState()

    // Increment session count
    const updatedState = { ...state, sessionCount: state.sessionCount + 1 }
    savePromptState(updatedState)

    // Don't show if dismissed within last 30 days
    if (state.dismissed && Date.now() - state.dismissedAt < 30 * 24 * 60 * 60 * 1000) return

    // Don't show until 2nd session
    if (updatedState.sessionCount < MIN_SESSIONS) return

    // Show after 5 seconds
    const timer = setTimeout(() => setVisible(true), 5000)
    return () => clearTimeout(timer)
  }, [isLoading, isSubscribed, isSupported])

  const handleEnable = useCallback(async () => {
    const ok = await subscribe()
    if (ok) setVisible(false)
  }, [subscribe])

  const handleDismiss = useCallback(() => {
    savePromptState({ dismissed: true, dismissedAt: Date.now(), sessionCount: getPromptState().sessionCount })
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed top-4 left-4 right-4 z-[9998] mx-auto max-w-sm"
      style={{ animation: "slideDown 0.3s ease-out" }}
    >
      <div className="bg-card border border-card-border rounded-2xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--primary-muted)" }}
          >
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>
              notifications_active
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Enable notifications?
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">
              Get alerts for price moves, sync updates, and budget warnings.
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={handleEnable} className="btn-primary text-xs px-4 py-2">
                Enable
              </button>
              <button onClick={handleDismiss} className="btn-ghost text-xs px-3 py-2">
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-foreground-muted hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      </div>
    </div>
  )
}
