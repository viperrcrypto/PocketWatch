"use client"

import { useChartPointEvents, type ChartPointEvent } from "@/hooks/portfolio/use-chart-point-events"
import { formatFiatValue } from "@/lib/portfolio/utils"

interface ChartPointDetailProps {
  timestamp: number
  value: number
  previousValue: number | null
  onClose: () => void
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  swap: "Swap",
  bridge: "Bridge",
  yield: "Yield / Reward",
  gas: "Gas Fee",
  internal_transfer: "Internal Transfer",
  airdrop: "Airdrop",
  spam: "Spam",
  unknown: "Unknown",
}

const DIRECTION_ICONS: Record<string, string> = {
  in: "south_west",
  out: "north_east",
}

function groupByClassification(events: ChartPointEvent[]): Map<string, ChartPointEvent[]> {
  const groups = new Map<string, ChartPointEvent[]>()
  for (const event of events) {
    const key = event.classification ?? "unknown"
    const list = groups.get(key) ?? []
    groups.set(key, [...list, event])
  }
  return groups
}

function computeNetFlow(events: ChartPointEvent[]): { inflow: number; outflow: number } {
  let inflow = 0
  let outflow = 0
  for (const e of events) {
    const usd = Math.abs(e.usdValue ?? 0)
    if (e.direction === "in") inflow += usd
    else outflow += usd
  }
  return { inflow, outflow }
}

export function ChartPointDetail({ timestamp, value, previousValue, onClose }: ChartPointDetailProps) {
  const { data, isLoading } = useChartPointEvents(timestamp)
  const events = data?.events ?? []
  const grouped = groupByClassification(events)
  const { inflow, outflow } = computeNetFlow(events)
  const delta = previousValue !== null ? value - previousValue : null
  const deltaPct = previousValue && previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : null

  const date = new Date(timestamp * 1000)
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-card-border shadow-2xl flex flex-col animate-slide-in-right-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
        <div>
          <p className="text-xs text-foreground-muted">{dateStr}</p>
          <p className="text-lg font-semibold text-foreground">{formatFiatValue(value)}</p>
          {delta !== null && deltaPct !== null && (
            <p className={`text-xs ${delta >= 0 ? "text-success" : "text-error"}`}>
              {delta >= 0 ? "+" : ""}{formatFiatValue(delta)} ({deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(2)}%)
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-background-secondary transition-colors"
        >
          <span className="material-symbols-rounded text-foreground-muted text-xl">close</span>
        </button>
      </div>

      {/* Net flow summary */}
      {(inflow > 0 || outflow > 0) && (
        <div className="px-5 py-3 border-b border-card-border flex gap-4">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-rounded text-success text-sm">south_west</span>
            <span className="text-xs text-foreground-muted">In:</span>
            <span className="text-xs font-medium text-foreground">{formatFiatValue(inflow)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-rounded text-error text-sm">north_east</span>
            <span className="text-xs text-foreground-muted">Out:</span>
            <span className="text-xs font-medium text-foreground">{formatFiatValue(outflow)}</span>
          </div>
        </div>
      )}

      {/* Event list */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-foreground-muted">
            <span className="material-symbols-rounded text-2xl mb-2">receipt_long</span>
            <p className="text-sm">No transactions found for this date</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([classification, groupEvents]) => (
            <div key={classification}>
              <p className="text-[10px] uppercase tracking-wider text-foreground-muted mb-1.5">
                {CLASSIFICATION_LABELS[classification] ?? classification} ({groupEvents.length})
              </p>
              <div className="space-y-1">
                {groupEvents.map((event, idx) => (
                  <div
                    key={`${event.txHash}-${idx}`}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-background-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`material-symbols-rounded text-sm ${event.direction === "in" ? "text-success" : "text-error"}`}>
                        {DIRECTION_ICONS[event.direction] ?? "swap_horiz"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {event.symbol ?? "Unknown Token"}
                        </p>
                        <p className="text-[10px] text-foreground-muted">
                          {event.chain} · {event.txHash.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {event.usdValue !== null && event.usdValue !== 0 ? (
                        <p className={`text-xs font-medium ${event.direction === "in" ? "text-success" : "text-error"}`}>
                          {event.direction === "in" ? "+" : "-"}{formatFiatValue(Math.abs(event.usdValue))}
                        </p>
                      ) : (
                        <p className="text-xs text-foreground-muted">—</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
