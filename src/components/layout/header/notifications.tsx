"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useForms } from "@/hooks/use-api"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { TabbedTicker } from "./tickers"

const NEW_FORM_STORAGE_KEY = "trackme-last-seen-form"

// New Form Indicator component with continuous scrolling
export function NewFormIndicator() {
  const { data: forms = [] } = useForms()
  const [newForm, setNewForm] = useState<{ id: string; title: string; template: string } | null>(null)
  const [, setHasActiveForms] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    if (forms.length === 0) {
      setHasActiveForms(false)
      return
    }

    const activeForms = forms.filter((f: any) => f.status === "ACTIVE")
    setHasActiveForms(activeForms.length > 0)

    if (activeForms.length === 0) return

    const latestForm = activeForms[0]
    const lastSeenFormId = localStorage.getItem(NEW_FORM_STORAGE_KEY)

    if (latestForm.id !== lastSeenFormId) {
      setNewForm({ id: latestForm.id, title: latestForm.title, template: latestForm.template })
    }
  }, [forms])

  function handleClick() {
    if (typeof window === "undefined") return
    if (newForm) {
      localStorage.setItem(NEW_FORM_STORAGE_KEY, newForm.id)
      setNewForm(null)
    }
  }

  // Show tabbed ticker when no unseen form banner to display
  if (!newForm) {
    return <TabbedTicker />
  }

  const bannerPrefix = newForm.template === "INTEREST_GAUGE"
    ? "INTEREST GAUGE:"
    : newForm.template === "COMMITMENT_SHEET"
      ? "COMMITMENT PROOF:"
      : "NEW FORM:"

  const textContent = (
    <>
      <span className="text-foreground font-semibold">{bannerPrefix}</span> {newForm.title}
      <span className="mx-4 text-card-border">&middot;</span>
    </>
  )

  return (
    <Link
      href="/forms"
      onClick={handleClick}
      className="hidden md:flex items-center flex-1 mx-2 overflow-hidden hover:opacity-80 transition-opacity border border-card-border bg-background-secondary rounded-lg"
      style={{ height: 32 }}
    >
      <div className="flex items-center whitespace-nowrap animate-scroll font-data text-[11px] font-medium tracking-tight text-foreground-muted">
        {textContent}{textContent}{textContent}{textContent}{textContent}
        {textContent}{textContent}{textContent}{textContent}{textContent}
      </div>
      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 45s linear infinite;
        }
      `}</style>
    </Link>
  )
}

// Bell icon linking to /settings/notifications
export function NotificationBell() {
  const { isSubscribed, isSupported, isLoading } = usePushNotifications()

  if (!isSupported || isLoading) return null

  const showNudge = !isSubscribed

  return (
    <Link
      href="/settings/notifications"
      aria-label="Notification settings"
      className="relative flex items-center justify-center w-9 h-9 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors flex-shrink-0"
    >
      <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
        {isSubscribed ? "notifications_active" : "notifications"}
      </span>
      {showNudge && (
        <span
          className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-success"
          style={{
            boxShadow: "0 0 6px var(--success)",
            animation: "bell-pulse 2s ease-in-out infinite",
          }}
        />
      )}
      <style jsx>{`
        @keyframes bell-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </Link>
  )
}
