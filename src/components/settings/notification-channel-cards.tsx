"use client"

import { useState } from "react"
import { toast } from "sonner"
import { usePushNotifications } from "@/hooks/use-push-notifications"

// ─── Setup Guide Helper ─────────────────────────────────────

function SetupGuide({ steps, showGuide, onToggle }: {
  steps: Array<{ icon: string; text: React.ReactNode }>
  showGuide: boolean
  onToggle: () => void
}) {
  return (
    <>
      <button onClick={onToggle} className="text-[10px] text-primary hover:underline mt-2 flex items-center gap-1">
        <span className="material-symbols-rounded" style={{ fontSize: 12 }}>{showGuide ? "expand_less" : "help"}</span>
        {showGuide ? "Hide setup guide" : "How to set up"}
      </button>
      {showGuide && (
        <div className="mt-2 space-y-1.5 pl-1">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-foreground-muted leading-relaxed">
              <span className="text-primary font-bold shrink-0 w-4 text-center">{i + 1}.</span>
              <span>{step.text}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Channel Cards ───────────────────────────────────────────

export function BrrrChannelCard({ configured, onSave, onDelete, onTest, isTesting }: {
  configured: boolean
  onSave: (url: string) => void
  onDelete: () => void
  onTest: () => void
  isTesting: boolean
}) {
  const [url, setUrl] = useState("")
  const [editing, setEditing] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  return (
    <div className="p-4 border border-card-border rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="material-symbols-rounded text-foreground-muted">phone_iphone</span>
          <div>
            <p className="text-sm font-medium">brrr.now</p>
            <p className="text-xs text-foreground-muted">Apple push notifications (paid)</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${configured ? "bg-success" : "bg-foreground-muted/30"}`} />
          <span className="text-xs text-foreground-muted">{configured ? "Connected" : "Not set up"}</span>
        </div>
      </div>

      {(editing || !configured) && (
        <div className="mt-3 space-y-2">
          <SetupGuide
            showGuide={showGuide}
            onToggle={() => setShowGuide(!showGuide)}
            steps={[
              { icon: "open_in_new", text: <>Go to <a href="https://brrr.now" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">brrr.now</a> and create an account</> },
              { icon: "key", text: "Copy your webhook URL from the brrr dashboard" },
              { icon: "content_paste", text: "Paste it below and click Save" },
            ]}
          />
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
          <button onClick={onTest} disabled={isTesting} className="text-xs text-foreground-muted hover:text-foreground disabled:opacity-50">
            {isTesting ? "Sending..." : "Test"}
          </button>
        </div>
      )}
    </div>
  )
}

export function TelegramChannelCard({ configured, onSave, onDelete, onTest, isTesting }: {
  configured: boolean
  onSave: (botToken: string, chatId: string) => void
  onDelete: () => void
  onTest: () => void
  isTesting: boolean
}) {
  const [botToken, setBotToken] = useState("")
  const [chatId, setChatId] = useState("")
  const [editing, setEditing] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  return (
    <div className="p-4 border border-card-border rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="material-symbols-rounded text-foreground-muted">send</span>
          <div>
            <p className="text-sm font-medium">Telegram</p>
            <p className="text-xs text-foreground-muted">Bot API notifications (free)</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${configured ? "bg-success" : "bg-foreground-muted/30"}`} />
          <span className="text-xs text-foreground-muted">{configured ? "Connected" : "Not set up"}</span>
        </div>
      </div>

      {(editing || !configured) && (
        <div className="mt-3 space-y-2">
          <SetupGuide
            showGuide={showGuide}
            onToggle={() => setShowGuide(!showGuide)}
            steps={[
              { icon: "smart_toy", text: <>Open Telegram and message <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">@BotFather</a></> },
              { icon: "add", text: <>Send <code className="px-1 py-0.5 bg-background-secondary rounded text-[10px]">/newbot</code>, pick a name, and copy the bot token</> },
              { icon: "chat", text: "Start a chat with your new bot (send it any message)" },
              { icon: "tag", text: <>Get your Chat ID: message <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">@userinfobot</a> and it will reply with your ID</> },
              { icon: "content_paste", text: "Paste both values below and click Save" },
            ]}
          />
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
            placeholder="Chat ID (from @userinfobot)"
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
          <button onClick={onTest} disabled={isTesting} className="text-xs text-foreground-muted hover:text-foreground disabled:opacity-50">
            {isTesting ? "Sending..." : "Test"}
          </button>
        </div>
      )}
    </div>
  )
}

export function NtfyChannelCard({ configured, onSave, onDelete, onTest, isTesting }: {
  configured: boolean
  onSave: (topic: string, serverUrl: string, token: string) => void
  onDelete: () => void
  onTest: () => void
  isTesting: boolean
}) {
  const [topic, setTopic] = useState("")
  const [serverUrl, setServerUrl] = useState("")
  const [token, setToken] = useState("")
  const [editing, setEditing] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  return (
    <div className="p-4 border border-card-border rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="material-symbols-rounded text-foreground-muted">campaign</span>
          <div>
            <p className="text-sm font-medium">ntfy.sh</p>
            <p className="text-xs text-foreground-muted">Free push notifications (iOS / Android / Desktop)</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${configured ? "bg-success" : "bg-foreground-muted/30"}`} />
          <span className="text-xs text-foreground-muted">{configured ? "Connected" : "Not set up"}</span>
        </div>
      </div>

      {(editing || !configured) && (
        <div className="mt-3 space-y-2">
          <SetupGuide
            showGuide={showGuide}
            onToggle={() => setShowGuide(!showGuide)}
            steps={[
              { icon: "download", text: <>Install the ntfy app: <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">iOS</a> / <a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Android</a></> },
              { icon: "edit", text: <>Pick a unique topic name (e.g. <code className="px-1 py-0.5 bg-background-secondary rounded text-[10px]">pocketwatch-john-a8f3</code>) — anyone who knows the topic name can subscribe, so make it hard to guess</> },
              { icon: "add_circle", text: "In the ntfy app, tap + and subscribe to your topic" },
              { icon: "content_paste", text: "Enter the same topic name below and click Save" },
              { icon: "check_circle", text: "Click Test to verify you receive a notification" },
            ]}
          />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic name (e.g. pocketwatch-alerts-x7k2)"
            className="w-full px-3 py-2 text-sm bg-background border border-card-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="Server URL (default: https://ntfy.sh)"
            className="w-full px-3 py-2 text-sm bg-background border border-card-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Access token (optional, for private topics)"
            className="w-full px-3 py-2 text-sm bg-background border border-card-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (topic.trim()) onSave(topic.trim(), serverUrl.trim(), token.trim())
                setTopic(""); setServerUrl(""); setToken(""); setEditing(false)
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
          <button onClick={onTest} disabled={isTesting} className="text-xs text-foreground-muted hover:text-foreground disabled:opacity-50">
            {isTesting ? "Sending..." : "Test"}
          </button>
        </div>
      )}
    </div>
  )
}

export function WebPushChannelCard() {
  const { isSubscribed, isSupported, isLoading, subscribe, unsubscribe } = usePushNotifications()
  const [showGuide, setShowGuide] = useState(false)

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
              {isSupported ? "Browser notifications on this device (free)" : "Not supported in this browser"}
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
      {!isSubscribed && isSupported && (
        <SetupGuide
          showGuide={showGuide}
          onToggle={() => setShowGuide(!showGuide)}
          steps={[
            { icon: "touch_app", text: "Click Enable above — your browser will ask for permission" },
            { icon: "check", text: "Allow notifications when prompted" },
            { icon: "devices", text: "Works on this device and browser only. For notifications on your phone, use ntfy or Telegram instead." },
          ]}
        />
      )}
    </div>
  )
}
