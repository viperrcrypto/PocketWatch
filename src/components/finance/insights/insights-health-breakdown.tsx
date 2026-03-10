"use client"

import { cn } from "@/lib/utils"

export function InsightsHealthBreakdown({ health }: { health: any }) {
  if (!health || health.breakdown.length === 0) return null

  return (
    <div className="bg-card border border-card-border rounded-xl p-6">
      <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
        Health Score Breakdown
      </span>
      <div className="mt-4 space-y-3">
        {health.breakdown.map((b: any) => {
          const barColor = b.score >= 80 ? "bg-success" : b.score >= 60 ? "bg-amber-500" : "bg-error"
          return (
            <div key={b.factor}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-foreground">{b.factor}</span>
                <span className="font-data text-xs text-foreground-muted tabular-nums">
                  {b.score}/100 ({b.weight}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-background-secondary overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", barColor)}
                  style={{ width: `${b.score}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
