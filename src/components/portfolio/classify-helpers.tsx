"use client"

import { useRef, useEffect } from "react"

// ─── Constants ───

export const PAGE_SIZE = 25

export const CLASSIFICATION_OPTIONS = [
  { value: "", label: "All Classifications" },
  { value: "swap", label: "Swap" },
  { value: "transfer", label: "Transfer" },
  { value: "inflow", label: "Inflow" },
  { value: "outflow", label: "Outflow" },
  { value: "yield", label: "Yield" },
  { value: "gas", label: "Gas" },
  { value: "spam", label: "Spam" },
  { value: "income", label: "Income" },
  { value: "gift_received", label: "Gift Received" },
  { value: "gift_sent", label: "Gift Sent" },
  { value: "lost", label: "Lost/Stolen" },
  { value: "bridge", label: "Bridge" },
  { value: "dust", label: "Dust" },
  { value: "unreviewed", label: "Unreviewed" },
] as const

export const DIRECTION_OPTIONS = [
  { value: "", label: "All Directions" },
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
] as const

export const CHAIN_FILTER_OPTIONS = [
  { value: "", label: "All Chains" },
  { value: "ethereum", label: "Ethereum" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "base", label: "Base" },
  { value: "optimism", label: "Optimism" },
  { value: "polygon", label: "Polygon" },
  { value: "solana", label: "Solana" },
] as const

export const QUICK_CLASSIFY_GROUPS = [
  {
    label: "Tax Events",
    options: [
      { value: "income", label: "Income" },
      { value: "swap", label: "Swap" },
    ],
  },
  {
    label: "Non-Taxable",
    options: [
      { value: "transfer", label: "Transfer" },
      { value: "bridge", label: "Bridge" },
      { value: "gift_received", label: "Gift Received" },
      { value: "gift_sent", label: "Gift Sent" },
    ],
  },
  {
    label: "Losses",
    options: [
      { value: "lost", label: "Lost/Stolen" },
    ],
  },
  {
    label: "Skip",
    options: [
      { value: "dust", label: "Dust" },
      { value: "spam", label: "Spam" },
      { value: "gas", label: "Gas" },
    ],
  },
] as const

export const BULK_ACTIONS = [
  { value: "transfer", label: "Transfer" },
  { value: "income", label: "Income" },
  { value: "swap", label: "Swap" },
  { value: "bridge", label: "Bridge" },
  { value: "spam", label: "Spam" },
] as const

// ─── Badge styles by classification ───

const CLASSIFICATION_BADGE_STYLES: Record<string, string> = {
  transfer: "bg-info/10 text-info",
  bridge: "bg-info/10 text-info",
  swap: "bg-purple-500/10 text-purple-500",
  inflow: "bg-success/10 text-success",
  income: "bg-success/10 text-success",
  gift_received: "bg-success/10 text-success",
  outflow: "bg-error/10 text-error",
  gift_sent: "bg-warning/10 text-warning",
  lost: "bg-error/10 text-error",
  yield: "bg-amber-500/10 text-amber-500",
  gas: "bg-foreground-muted/10 text-foreground-muted",
  spam: "bg-foreground-muted/10 text-foreground-muted line-through",
  dust: "bg-foreground-muted/10 text-foreground-muted line-through",
  unreviewed: "bg-warning/10 text-warning",
}

export function getClassificationBadgeStyle(classification: string): string {
  return CLASSIFICATION_BADGE_STYLES[classification] ?? "bg-foreground-muted/10 text-foreground-muted"
}

// ─── Helpers ───

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

export function formatClassificationLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Transaction Row interface ───

export interface TransactionRow {
  id: string
  txHash: string | null
  blockTimestamp: number | string
  chain: string
  direction: string | null
  asset: string
  symbol: string
  amount: number | string
  usdValue: number | string | null
  txClassification: string | null
  manualClassification: string | null
  contractAddress: string | null
}

// ─── Sub-Components ───

export function ClassificationBadge({
  classification,
  isManual,
}: {
  classification: string
  isManual?: boolean
}) {
  const style = getClassificationBadgeStyle(classification)
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-data text-[10px] font-semibold tracking-wide uppercase ${style}`}
    >
      {isManual && (
        <span className="material-symbols-rounded opacity-70" style={{ fontSize: 10 }} title="Manual override">edit</span>
      )}
      {formatClassificationLabel(classification)}
    </span>
  )
}

export function DirectionBadge({ direction }: { direction: string }) {
  const isIn = direction?.toLowerCase() === "in"
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded font-data text-[10px] font-semibold tracking-wide uppercase ${
        isIn ? "bg-success/10 text-success" : "bg-error/10 text-error"
      }`}
    >
      {isIn ? "IN" : "OUT"}
    </span>
  )
}

export function StatsBar({ stats }: { stats: Record<string, number> | undefined }) {
  if (!stats) return null

  const entries = Object.entries(stats).filter(([, count]) => count > 0)
  if (entries.length === 0) return null

  return (
    <div className="bg-card border border-card-border rounded-xl px-4 py-3 mb-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {entries.map(([classification, count]) => (
          <span key={classification} className="inline-flex items-center gap-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${getClassificationBadgeStyle(classification).split(" ")[0]}`}
            />
            <span className="text-foreground font-data font-medium">{count}</span>
            <span className="text-foreground-muted">
              {formatClassificationLabel(classification)}
              {count !== 1 ? "s" : ""}
            </span>
          </span>
        ))}
        {stats.manual_overrides != null && stats.manual_overrides > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="material-symbols-rounded opacity-60" style={{ fontSize: 12 }}>edit</span>
            <span className="text-foreground font-data font-medium">{stats.manual_overrides}</span>
            <span className="text-foreground-muted">Manual Override{stats.manual_overrides !== 1 ? "s" : ""}</span>
          </span>
        )}
      </div>
    </div>
  )
}

export function QuickClassifyDropdown({
  anchorRect,
  onSelect,
  onClear,
  onClose,
  currentManual,
}: {
  anchorRect: DOMRect
  onSelect: (classification: string) => void
  onClear: () => void
  onClose: () => void
  currentManual: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  const dropdownWidth = 200
  const top = anchorRect.bottom + 4
  const left = Math.min(
    Math.max(8, anchorRect.right - dropdownWidth),
    window.innerWidth - dropdownWidth - 8
  )

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-card border border-card-border rounded-xl shadow-lg py-1 w-[200px]"
      style={{ top, left }}
    >
      {QUICK_CLASSIFY_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 pt-2 pb-1 text-[9px] font-semibold tracking-widest text-foreground-muted uppercase">
            {group.label}
          </p>
          {group.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onSelect(opt.value)
                onClose()
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-primary-subtle transition-colors flex items-center gap-2"
            >
              <span
                className={`w-2 h-2 rounded-full ${getClassificationBadgeStyle(opt.value).split(" ")[0].replace("/10", "")}`}
              />
              {opt.label}
            </button>
          ))}
        </div>
      ))}
      {currentManual && (
        <>
          <div className="border-t border-card-border my-1" />
          <button
            onClick={() => {
              onClear()
              onClose()
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-warning hover:bg-primary-subtle transition-colors"
          >
            Clear Override
          </button>
        </>
      )}
    </div>
  )
}
