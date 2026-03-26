"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  useNotificationSettings,
  useSaveNotificationChannel,
  useDeleteNotificationChannel,
  useTestNotification,
} from "@/hooks/finance/use-notifications"
import { usePushNotifications } from "@/hooks/use-push-notifications"

// ─── Channel Config Forms ────────────────────────────────────

function BrrrChannelCard({ configured, onSave, onDelete }: {
  configured: boolean
  onSave: (url: string) => void
  onDelete: () => void
}) {
  const [url, setUrl] = useState("")
  const [editing, setEditing] = useState(false)

  return (
    <div className="p-4 border border-card-border rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="material-symbols-rounded text-foreground-muted">phone_iphone</span>
          <div>
            <p className="text-sm font-medium">brrr.now</p>
            <p className="text-xs text-foreground-muted">Apple push notifications</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${configured ? "bg-success" : "bg-foreground-muted/30"}`} />
          <span className="text-xs text-foreground-muted">{configured ? "Connected" : "Not set up"}</span>
        </div>
      </div>

      {(editing || !configured) && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.brrr.now/v1/your-secret"
            className="w-full px-3 py-2 text-sm bg-background border border-card-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button onClick={() => { if (url.trim()) onSave(url.trim()); setUrl(""); setEditing(false) }} className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90">
              Save
            </button>
            {configured && (
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-foreground-muted hover:text-foreground">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {configured && !editing && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">Update</button>
          <button onClick={onDelete} className="text-xs text-error hover:underline">Remove</button>
        </div>
      )}
    </div>
  )
}

function TelegramChannelCard({ configured, onSave, onDelete }: {
  configured: boolean
  onSave: (botToken: string, chatId: string) => void
  onDelete: () => void
}) {
  const [botToken, setBotToken] = useState("")
  const [chatId, setChatId] = useState("")
  const [editing, setEditing] = useState(false)

  return (
    <div className="p-4 border border-card-border rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="material-symbols-rounded text-foreground-muted">send</span>
          <div>
            <p className="text-sm font-medium">Telegram</p>
            <p className="text-xs text-foreground-muted">Bot API notifications</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${configured ? "bg-success" : "bg-foreground-muted/30"}`} />
          <span className="text-xs text-foreground-muted">{configured ? "Connected" : "Not set up"}</span>
        </div>
      </div>

      {(editing || !configured) && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="Bot token (from @BotFather)"
            className="w-full px-3 py-2 text-sm bg-background border border-card-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Chat ID (your user/group ID)"
            className="w-full px-3 py-2 text-sm bg-background border border-card-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (botToken.trim() && chatId.trim()) onSave(botToken.trim(), chatId.trim())
                setBotToken(""); setChatId(""); setEditing(false)
              }}
              className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Save
            </button>
            {configured && (
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-foreground-muted hover:text-foreground">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {configured && !editing && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">Update</button>
          <button onClick={onDelete} className="text-xs text-error hover:underline">Remove</button>
        </div>
      )}
    </div>
  )
}

function WebPushChannelCard() {
  const { isSubscribed, isSupported, isLoading, subscribe, unsubscribe } = usePushNotifications()

  const handleToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribe()
      if (ok) toast.success("Web push disabled")
      else toast.error("Failed to disable web push")
    } else {
      const result = await subscribe()
      if (result.ok) toast.success("Web push enabled — try Send Test Notification")
      else toast.error(result.error ?? "Failed to enable web push")
    }
  }

  return (
    <div className="p-4 border border-card-border rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="material-symbols-rounded text-foreground-muted">notifications</span>
          <div>
            <p className="text-sm font-medium">Web Push</p>
            <p className="text-xs text-foreground-muted">
              {isSupported ? "Browser notifications on this device" : "Not supported in this browser"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${isSubscribed ? "bg-success" : "bg-foreground-muted/30"}`} />
          {isSupported && (
            <button
              onClick={handleToggle}
              disabled={isLoading}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                isSubscribed
                  ? "bg-foreground-muted/10 text-foreground-muted hover:text-foreground"
                  : "bg-primary text-white hover:bg-primary/90"
              } disabled:opacity-50`}
            >
              {isLoading ? "..." : isSubscribed ? "Disable" : "Enable"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────

export function NotificationSettings() {
  const { data, isLoading } = useNotificationSettings()
  const saveMutation = useSaveNotificationChannel()
  const deleteMutation = useDeleteNotificationChannel()
  const testMutation = useTestNotification()
  const push = usePushNotifications()

  const brrrConfigured = data?.channels.find((c) => c.channel === "brrr")?.configured ?? false
  const telegramConfigured = data?.channels.find((c) => c.channel === "telegram")?.configured ?? false
  const hasAnyChannel = brrrConfigured || telegramConfigured || push.isSubscribed

  const handleSaveBrrr = (webhookUrl: string) => {
    saveMutation.mutate(
      { channel: "notify_brrr", webhookUrl },
      { onSuccess: () => toast.success("brrr.now connected"), onError: (e) => toast.error(e.message) },
    )
  }

  const handleSaveTelegram = (botToken: string, chatId: string) => {
    saveMutation.mutate(
      { channel: "notify_telegram", botToken, chatId },
      { onSuccess: () => toast.success("Telegram connected"), onError: (e) => toast.error(e.message) },
    )
  }

  const handleTest = async () => {
    // If no channels configured and web push is available, auto-enable it first
    if (!hasAnyChannel && push.isSupported && !push.isSubscribed) {
      const result = await push.subscribe()
      if (!result.ok) {
        toast.error(result.error ?? "Enable a notification channel first")
        return
      }
      toast.success("Web push enabled")
    }

    testMutation.mutate(undefined, {
      onSuccess: (res) => {
        if (res.sent > 0) toast.success(`Test sent to ${res.sent} channel(s)`)
        else toast.error("No channels responded — try enabling a channel above")
      },
      onError: (e) => toast.error(e.message),
    })
  }

  if (isLoading) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-shimmer rounded-lg" />)}</div>
  }

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        <BrrrChannelCard configured={brrrConfigured} onSave={handleSaveBrrr} onDelete={() => deleteMutation.mutate("notify_brrr", { onSuccess: () => toast.success("brrr.now removed") })} />
        <TelegramChannelCard configured={telegramConfigured} onSave={handleSaveTelegram} onDelete={() => deleteMutation.mutate("notify_telegram", { onSuccess: () => toast.success("Telegram removed") })} />
        <WebPushChannelCard />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-card-border pt-4">
        <button onClick={handleTest} disabled={testMutation.isPending || push.isLoading} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
          {testMutation.isPending || push.isLoading ? "Sending..." : hasAnyChannel ? "Send Test Notification" : "Enable & Test"}
        </button>
        {!hasAnyChannel && (
          <span className="text-[10px] text-foreground-muted">No channels enabled yet</span>
        )}
      </div>

      {data?.recentAlerts && data.recentAlerts.length > 0 && (
        <div className="border-t border-card-border pt-4">
          <p className="text-xs font-medium text-foreground-muted mb-2">Recent Alerts</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.recentAlerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-background/50">
                <div className="min-w-0">
                  <span className="font-medium">{alert.title}</span>
                  <span className="text-foreground-muted ml-1.5">{alert.message}</span>
                </div>
                <span className="text-foreground-muted shrink-0">
                  {new Date(alert.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
