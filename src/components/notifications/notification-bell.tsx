"use client"

import { useState, useRef, useEffect, memo } from "react"
import { useUnreadCount, useNotificationHistory, useMarkRead, useMarkAllRead } from "@/hooks/use-notification-center"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS: Record<string, string> = {
  finance: "account_balance",
  crypto: "currency_bitcoin",
  travel: "flight",
  system: "settings",
}

const SEVERITY_COLORS: Record<string, string> = {
  urgent: "var(--error)",
  watch: "var(--warning, #f59e0b)",
  info: "var(--foreground-muted)",
}

function formatTimeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return days < 7 ? `${days}d` : new Date(iso).toLocaleDateString()
}

export const NotificationBell = memo(function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { data: unread } = useUnreadCount()
  const { data: history } = useNotificationHistory({ limit: 20 })
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const count = unread?.count ?? 0
  const items = history?.items ?? []

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
          open
            ? "text-primary bg-primary-muted"
            : "text-foreground-muted hover:text-foreground hover:bg-background-secondary",
        )}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
        title="Notifications"
      >
        <span className="material-symbols-rounded text-lg">notifications</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-[10px] font-bold text-white flex items-center justify-center pointer-events-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-[360px] max-h-[480px] bg-card border border-card-border rounded-xl shadow-lg overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
              {count > 0 && (
                <span className="ml-2 text-xs font-normal text-foreground-muted">
                  {count} unread
                </span>
              )}
            </h3>
            {count > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-rounded text-xs">done_all</span>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <span className="material-symbols-rounded text-3xl text-foreground-muted/30 mb-2">notifications_off</span>
                <p className="text-sm text-foreground-muted">All caught up</p>
              </div>
            ) : (
              <div className="py-1">
                {items.map((item) => {
                  const isUnread = !item.readAt
                  return (
                    <div
                      key={item.id}
                      className="group flex items-start gap-3 px-4 py-2.5 hover:bg-background/50 transition-colors cursor-default"
                      style={{ borderLeft: `3px solid ${SEVERITY_COLORS[item.severity] ?? SEVERITY_COLORS.info}` }}
                    >
                      <span className={cn("material-symbols-rounded text-base mt-0.5", isUnread ? "text-foreground" : "text-foreground-muted/50")}>
                        {CATEGORY_ICONS[item.category] ?? "circle_notifications"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm leading-tight", isUnread ? "font-medium text-foreground" : "text-foreground-muted")}>
                          {item.title}
                        </p>
                        {item.body && (
                          <p className="text-xs text-foreground-muted line-clamp-2 mt-0.5">{item.body}</p>
                        )}
                        <p className="text-[10px] text-foreground-muted/50 mt-1">{formatTimeAgo(item.sentAt)}</p>
                      </div>
                      {isUnread && (
                        <button
                          onClick={() => markRead.mutate([item.id])}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1 w-6 h-6 rounded flex items-center justify-center text-foreground-muted hover:text-primary hover:bg-primary-muted"
                          title="Mark as read"
                        >
                          <span className="material-symbols-rounded text-sm">check</span>
                        </button>
                      )}
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-card-border px-4 py-2.5">
            <a
              href="/settings"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline"
            >
              Notification settings
            </a>
          </div>
        </div>
      )}
    </div>
  )
})

NotificationBell.displayName = "NotificationBell"
