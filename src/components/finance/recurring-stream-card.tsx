"use client"

import { formatCurrency, cn } from "@/lib/utils"

const FREQ_COLORS: Record<string, string> = {
  WEEKLY: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  BIWEEKLY: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  SEMI_MONTHLY: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
  MONTHLY: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  ANNUALLY: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
}

interface Stream {
  streamId: string; merchantName: string | null; description: string
  frequency: string; averageAmount: number | null; lastAmount: number | null
  isActive: boolean; status: string; firstDate: string | null; lastDate: string | null
  streamType: string
}

export function RecurringStreamCard({ stream }: { stream: Stream }) {
  const freqClass = FREQ_COLORS[stream.frequency] ?? "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-400"

  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", stream.isActive ? "bg-success" : "bg-foreground-muted/30")} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{stream.merchantName ?? stream.description}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("px-1.5 py-0.5 text-[9px] font-medium uppercase rounded", freqClass)}>
              {stream.frequency.replace(/_/g, " ")}
            </span>
            {stream.firstDate && stream.lastDate && (
              <span className="text-[10px] text-foreground-muted">
                {new Date(stream.firstDate).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                {" → "}
                {new Date(stream.lastDate).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={cn("font-data text-sm font-semibold tabular-nums", stream.streamType === "inflow" ? "text-success" : "text-foreground")}>
          {stream.lastAmount != null ? formatCurrency(Math.abs(stream.lastAmount)) : "—"}
        </p>
        {stream.averageAmount != null && stream.lastAmount !== stream.averageAmount && (
          <p className="text-[10px] text-foreground-muted font-data tabular-nums">
            avg {formatCurrency(Math.abs(stream.averageAmount))}
          </p>
        )}
      </div>
    </div>
  )
}

interface StreamListProps {
  title: string
  streams: Stream[]
  total: number
  icon: string
}

export function RecurringStreamList({ title, streams, total, icon }: StreamListProps) {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>{icon}</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">{title}</span>
        </div>
        <span className="font-data text-xs font-medium text-foreground-muted tabular-nums">{formatCurrency(total)}/mo</span>
      </div>
      <div className="divide-y divide-card-border/30">
        {streams.length > 0 ? streams.map((s) => (
          <RecurringStreamCard key={s.streamId} stream={s} />
        )) : (
          <p className="text-sm text-foreground-muted text-center py-8">No streams detected</p>
        )}
      </div>
    </div>
  )
}
