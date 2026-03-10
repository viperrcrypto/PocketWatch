"use client"

import { getChainMeta } from "@/lib/portfolio/chains"
import { EVENT_BADGE_STYLES } from "./history-constants"

export function EventBadge({ type }: { type: string }) {
  const normalized = type?.toLowerCase() ?? "unknown"
  const style = EVENT_BADGE_STYLES[normalized] ?? { className: "bg-foreground-muted/10 text-foreground-muted" }
  return (
    <span className={`inline-block px-2 py-0.5 rounded font-data text-[10px] font-semibold tracking-wide uppercase ${style.className}`}>
      {normalized}
    </span>
  )
}

export function formatTimestamp(ts: number | string): string {
  const date = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts)
  if (isNaN(date.getTime())) return String(ts)
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function getExplorerUrl(chain: string | undefined, path: string): string | null {
  if (!chain) return null
  const meta = getChainMeta(chain)
  if (!meta?.explorerUrl) return null
  return `${meta.explorerUrl}/${path}`
}
