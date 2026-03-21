"use client"

import type { ChatThread } from "@/lib/chat/types"

interface ThreadListProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onSwitch: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function ThreadList({ threads, activeThreadId, onSwitch, onDelete, onClose }: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="p-4 text-sm text-foreground-muted text-center">
        No conversations yet.
      </div>
    )
  }

  return (
    <div className="max-h-64 overflow-y-auto">
      {threads.map((thread) => (
        <div
          key={thread.id}
          className={`flex items-center gap-2 px-3 py-2 hover:bg-card-hover cursor-pointer transition-colors ${
            thread.id === activeThreadId ? "bg-card-hover" : ""
          }`}
        >
          <button
            onClick={() => { onSwitch(thread.id); onClose() }}
            className="flex-1 text-left min-w-0"
          >
            <div className="text-sm truncate">{thread.title}</div>
            <div className="text-xs text-foreground-muted">
              {formatDate(thread.updatedAt)} &middot; {thread.messages.length} msgs
            </div>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(thread.id) }}
            className="shrink-0 p-1 rounded hover:bg-red-500/10 text-foreground-muted hover:text-red-400 transition-colors"
            aria-label="Delete thread"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>delete</span>
          </button>
        </div>
      ))}
    </div>
  )
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < 60_000) return "just now"
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
