"use client"

import { toast } from "sonner"
import {
  useNotificationSettings,
  useSaveNotificationChannel,
  useDeleteNotificationChannel,
  useTestNotification,
} from "@/hooks/finance/use-notifications"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import {
  BrrrChannelCard,
  TelegramChannelCard,
  NtfyChannelCard,
  WebPushChannelCard,
} from "./notification-channel-cards"

export function NotificationSettings() {
  const { data, isLoading } = useNotificationSettings()
  const saveMutation = useSaveNotificationChannel()
  const deleteMutation = useDeleteNotificationChannel()
  const testMutation = useTestNotification()
  const push = usePushNotifications()

  const brrrConfigured = data?.channels.find((c) => c.channel === "brrr")?.configured ?? false
  const telegramConfigured = data?.channels.find((c) => c.channel === "telegram")?.configured ?? false
  const ntfyConfigured = data?.channels.find((c) => c.channel === "ntfy")?.configured ?? false
  const hasAnyChannel = brrrConfigured || telegramConfigured || ntfyConfigured || push.isSubscribed

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

  const handleSaveNtfy = (topic: string, serverUrl: string, token: string) => {
    saveMutation.mutate(
      { channel: "notify_ntfy", topic, serverUrl: serverUrl || undefined, token: token || undefined },
      { onSuccess: () => toast.success("ntfy connected"), onError: (e) => toast.error(e.message) },
    )
  }

  const handleTestChannel = (channel: string) => {
    testMutation.mutate(channel, {
      onSuccess: (res) => {
        const result = res.results[0]
        if (result?.sent) toast.success(`${channel} test sent!`)
        else toast.error(`${channel} test failed${result?.error ? `: ${result.error}` : ""}`)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  const handleTest = async () => {
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
        <BrrrChannelCard configured={brrrConfigured} onSave={handleSaveBrrr} onDelete={() => deleteMutation.mutate("notify_brrr", { onSuccess: () => toast.success("brrr.now removed") })} onTest={() => handleTestChannel("brrr")} isTesting={testMutation.isPending} />
        <TelegramChannelCard configured={telegramConfigured} onSave={handleSaveTelegram} onDelete={() => deleteMutation.mutate("notify_telegram", { onSuccess: () => toast.success("Telegram removed") })} onTest={() => handleTestChannel("telegram")} isTesting={testMutation.isPending} />
        <NtfyChannelCard configured={ntfyConfigured} onSave={handleSaveNtfy} onDelete={() => deleteMutation.mutate("notify_ntfy", { onSuccess: () => toast.success("ntfy removed") })} onTest={() => handleTestChannel("ntfy")} isTesting={testMutation.isPending} />
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
