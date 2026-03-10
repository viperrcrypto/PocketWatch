"use client"

import { useState } from "react"
import {
  useTelegramLink,
  useGenerateLinkCode,
  useUnlinkTelegram,
} from "@/hooks/use-tracker"

export default function TelegramLink() {
  const { data: linkStatus, isLoading } = useTelegramLink()
  const generateCode = useGenerateLinkCode()
  const unlinkTelegram = useUnlinkTelegram()
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerateCode = async () => {
    try {
      const result = await generateCode.mutateAsync()
      setLinkCode(result.code)
      setExpiresAt(result.expiresAt)
    } catch {
      // Error handled by mutation
    }
  }

  const handleCopyCode = async () => {
    if (!linkCode) return
    try {
      await navigator.clipboard.writeText(`/link ${linkCode}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback - select text
    }
  }

  const handleUnlink = async () => {
    if (!confirm("Disconnect your Telegram account? You will stop receiving alerts.")) return
    try {
      await unlinkTelegram.mutateAsync()
      setLinkCode(null)
      setExpiresAt(null)
    } catch {
      // Error handled by mutation
    }
  }

  if (isLoading) {
    return (
      <div className="card p-6 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-card-border" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-card-border" />
            <div className="h-3 w-48 bg-card-border" />
          </div>
        </div>
      </div>
    )
  }

  // ─── Linked State ───
  if (linkStatus?.isLinked) {
    return (
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 flex items-center justify-center border border-info bg-info-muted"
            >
              <span className="material-symbols-rounded text-info" style={{ fontSize: 20 }}>
                send
              </span>
            </div>
            <div>
              <p className="text-sm text-foreground font-medium">Telegram Connected</p>
              <p className="text-xs text-foreground-muted font-mono">
                @{linkStatus.username || linkStatus.firstName || "User"}
                {linkStatus.linkedAt && (
                  <span className="ml-2">
                    linked {new Date(linkStatus.linkedAt).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <span className="badge badge-success">
            <span className="material-symbols-rounded mr-1" style={{ fontSize: 12 }}>
              check_circle
            </span>
            Active
          </span>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-card-border">
          <button
            onClick={handleUnlink}
            className="btn-secondary text-error"
            disabled={unlinkTelegram.isPending}
            style={{ borderColor: "var(--error)", opacity: unlinkTelegram.isPending ? 0.4 : 1 }}
          >
            {unlinkTelegram.isPending ? (
              <>
                <span className="loading-spinner mr-2" />
                Disconnecting...
              </>
            ) : (
              <>
                <span className="material-symbols-rounded mr-2" style={{ fontSize: 16 }}>
                  link_off
                </span>
                Disconnect
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ─── Unlinked State ───
  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 flex items-center justify-center border border-card-border bg-background-secondary"
        >
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 20 }}>
            send
          </span>
        </div>
        <div>
          <p className="text-sm text-foreground font-medium">Connect Telegram</p>
          <p className="text-xs text-foreground-muted">
            Receive real-time alerts for wallet activity via Telegram
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-3 p-4 border border-card-border bg-background">
        <p className="section-label mb-2">How to connect</p>
        <ol className="space-y-2 text-xs text-foreground-muted">
          <li className="flex items-start gap-2">
            <span className="text-foreground font-mono font-bold shrink-0">1.</span>
            Open the WealthTracker bot on Telegram:{" "}
            <a
              href="https://t.me/trackmetrackerbot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:text-foreground transition-colors"
            >
              @trackmetrackerbot
            </a>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-foreground font-mono font-bold shrink-0">2.</span>
            Generate a link code below
          </li>
          <li className="flex items-start gap-2">
            <span className="text-foreground font-mono font-bold shrink-0">3.</span>
            Send <span className="text-foreground font-mono">/link YOUR_CODE</span> to the bot
          </li>
          <li className="flex items-start gap-2">
            <span className="text-foreground font-mono font-bold shrink-0">4.</span>
            The bot will confirm the connection
          </li>
        </ol>
      </div>

      {/* Generate / Display Code */}
      {linkCode ? (
        <div className="space-y-3">
          <p className="section-label">Your link code</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-10 px-3 flex items-center bg-background border border-card-border font-mono text-sm text-foreground tracking-widest">
              /link {linkCode}
            </div>
            <button
              onClick={handleCopyCode}
              className="btn-secondary h-10 px-4"
            >
              <span className="material-symbols-rounded mr-1" style={{ fontSize: 16 }}>
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {expiresAt && (
            <p className="text-[11px] text-foreground-muted">
              Expires {new Date(expiresAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleGenerateCode}
          className="btn-primary w-full"
          disabled={generateCode.isPending}
          style={{ opacity: generateCode.isPending ? 0.4 : 1 }}
        >
          {generateCode.isPending ? (
            <>
              <span className="loading-spinner mr-2" />
              Generating...
            </>
          ) : (
            <>
              <span className="material-symbols-rounded mr-2" style={{ fontSize: 16 }}>
                key
              </span>
              Generate Link Code
            </>
          )}
        </button>
      )}

      {generateCode.isError && (
        <div className="flex items-center gap-2 p-3 border border-error bg-error-muted">
          <span className="material-symbols-rounded text-error" style={{ fontSize: 16 }}>
            error
          </span>
          <span className="text-xs text-error">
            {generateCode.error?.message || "Failed to generate code"}
          </span>
        </div>
      )}
    </div>
  )
}
