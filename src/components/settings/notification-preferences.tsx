"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useNotificationPreferences, useSavePreferences } from "@/hooks/use-notification-center"

const CATEGORIES = [
  { key: "finance", label: "Finance", icon: "account_balance", description: "Budget alerts, large transactions, sync failures" },
  { key: "crypto", label: "Digital Assets", icon: "currency_bitcoin", description: "Price alerts, portfolio changes, staking events" },
  { key: "travel", label: "Travel", icon: "flight", description: "Flight deals, price drops, search results" },
  { key: "system", label: "System", icon: "settings", description: "Backups, sync errors, security events" },
]

const CHANNELS = [
  { key: "brrr", label: "brrr.now", icon: "phone_iphone" },
  { key: "telegram", label: "Telegram", icon: "send" },
  { key: "webpush", label: "Web Push", icon: "notifications" },
]

const SEVERITY_OPTIONS = [
  { value: "info", label: "All" },
  { value: "watch", label: "Important+" },
  { value: "urgent", label: "Urgent only" },
]

export function NotificationPreferencesSection() {
  const { data: prefs, isLoading } = useNotificationPreferences()
  const saveMutation = useSavePreferences()

  const [categories, setCategories] = useState<Record<string, boolean>>({})
  const [channelSeverity, setChannelSeverity] = useState<Record<string, string>>({})
  const [quietEnabled, setQuietEnabled] = useState(false)
  const [quietStart, setQuietStart] = useState("22:00")
  const [quietEnd, setQuietEnd] = useState("07:00")
  const [quietOverride, setQuietOverride] = useState(true)

  useEffect(() => {
    if (!prefs) return
    setCategories(prefs.categories)
    setChannelSeverity(prefs.channelSeverity)
    setQuietEnabled(prefs.quietEnabled)
    setQuietStart(prefs.quietStart)
    setQuietEnd(prefs.quietEnd)
    setQuietOverride(prefs.quietOverride)
  }, [prefs])

  // Debounced save
  useEffect(() => {
    if (!prefs) return
    const same = JSON.stringify(categories) === JSON.stringify(prefs.categories)
      && JSON.stringify(channelSeverity) === JSON.stringify(prefs.channelSeverity)
      && quietEnabled === prefs.quietEnabled
      && quietStart === prefs.quietStart
      && quietEnd === prefs.quietEnd
      && quietOverride === prefs.quietOverride
    if (same) return

    const t = setTimeout(() => {
      saveMutation.mutate(
        { categories, channelSeverity, quietEnabled, quietStart, quietEnd, quietOverride },
        { onError: (e) => toast.error(e.message) },
      )
    }, 600)
    return () => clearTimeout(t)
  }, [categories, channelSeverity, quietEnabled, quietStart, quietEnd, quietOverride]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return <div className="p-5 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-shimmer rounded-lg" />)}</div>
  }

  return (
    <div className="p-5 space-y-6">
      {/* Per-channel severity routing */}
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Channel Routing</p>
        <p className="text-xs text-foreground-muted mb-3">
          Control which notification severity reaches each channel
        </p>
        <div className="space-y-2">
          {CHANNELS.map((ch) => (
            <div key={ch.key} className="flex items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-rounded text-foreground-muted">{ch.icon}</span>
                <span className="text-sm text-foreground">{ch.label}</span>
              </div>
              <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setChannelSeverity({ ...channelSeverity, [ch.key]: opt.value })}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                      (channelSeverity[ch.key] ?? "info") === opt.value
                        ? "bg-primary text-white shadow-sm"
                        : "bg-transparent text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category toggles */}
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Categories</p>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <div key={cat.key} className="flex items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-rounded text-foreground-muted">{cat.icon}</span>
                <div>
                  <span className="text-sm text-foreground">{cat.label}</span>
                  <p className="text-xs text-foreground-muted">{cat.description}</p>
                </div>
              </div>
              <button
                onClick={() => setCategories({ ...categories, [cat.key]: !categories[cat.key] })}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  categories[cat.key] !== false ? "bg-primary" : "bg-foreground-muted/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    categories[cat.key] !== false ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quiet hours */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-medium text-foreground">Quiet Hours</p>
            <p className="text-xs text-foreground-muted">Suppress non-urgent notifications during these hours</p>
          </div>
          <button
            onClick={() => setQuietEnabled(!quietEnabled)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              quietEnabled ? "bg-primary" : "bg-foreground-muted/20"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                quietEnabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {quietEnabled && (
          <div className="space-y-3 pl-0.5">
            <div className="flex items-center gap-3">
              <div>
                <label className="text-xs text-foreground-muted block mb-1">From</label>
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="h-8 px-2 rounded text-sm bg-background border border-card-border text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-foreground-muted block mb-1">To</label>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="h-8 px-2 rounded text-sm bg-background border border-card-border text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-foreground-muted">
                Urgent alerts override quiet hours
              </span>
              <button
                onClick={() => setQuietOverride(!quietOverride)}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  quietOverride ? "bg-primary" : "bg-foreground-muted/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    quietOverride ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {saveMutation.isPending && (
        <p className="text-xs text-foreground-muted flex items-center gap-1">
          <span className="material-symbols-rounded text-xs animate-spin">progress_activity</span>
          Saving...
        </p>
      )}
    </div>
  )
}
