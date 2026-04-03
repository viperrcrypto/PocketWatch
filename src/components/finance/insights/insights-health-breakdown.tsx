"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const FACTOR_META: Record<string, { icon: string; color: string; description: string }> = {
  "Savings Rate": { icon: "savings", color: "#6366f1", description: "How much of your income you're saving each month. 20%+ is strong, under 10% needs attention." },
  "Budget Adherence": { icon: "rule", color: "#8b5cf6", description: "How well you stay within your set budgets. Tracks overspending across all budget categories." },
  "Spending Trend": { icon: "trending_down", color: "#3b82f6", description: "Whether your spending is increasing or decreasing compared to last month. Stable or declining is better." },
  "Cost Structure": { icon: "account_tree", color: "#06b6d4", description: "Balance between fixed recurring costs and variable spending. A high fixed ratio limits flexibility." },
  "Data Quality": { icon: "verified", color: "#14b8a6", description: "How well your transactions are categorized. Uncategorized transactions lower this score." },
}

function scoreMeta(score: number) {
  if (score >= 80) return { label: "Strong", dot: "#22c55e" }
  if (score >= 60) return { label: "Fair", dot: "#f59e0b" }
  return { label: "Low", dot: "#ef4444" }
}

export function InsightsHealthBreakdown({ health }: { health: any }) {
  const [showInfo, setShowInfo] = useState(false)
  if (!health || health.breakdown.length === 0) return null

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="px-5 py-3 border-b border-card-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>monitoring</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Health Score Breakdown</span>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
            showInfo ? "bg-primary/10 text-primary" : "text-foreground-muted/60 hover:text-foreground-muted hover:bg-background-secondary"
          )}
          title="What do these factors mean?"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{showInfo ? "close" : "info"}</span>
        </button>
      </div>

      <div className="p-5 space-y-3">
        {health.breakdown.map((b: any) => {
          const meta = FACTOR_META[b.factor] ?? { icon: "analytics", color: "#6366f1", description: "" }
          const sm = scoreMeta(b.score)
          return (
            <div
              key={b.factor}
              className="group rounded-lg transition-colors duration-150 hover:bg-background-secondary/40 -mx-2 px-2 py-1"
              style={{ borderLeft: "2px solid transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderLeftColor = meta.color }}
              onMouseLeave={(e) => { e.currentTarget.style.borderLeftColor = "transparent" }}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 18, color: meta.color }}>{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="relative flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground peer cursor-help">{b.factor}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-background-secondary text-foreground-muted/60 tabular-nums font-data">{b.weight}%</span>
                      {meta.description && (
                        <div className="absolute left-0 bottom-full mb-1.5 z-50 w-64 px-3 py-2 rounded-lg bg-foreground text-background text-[11px] leading-relaxed shadow-lg opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity duration-150">
                          {meta.description}
                          <div className="absolute -bottom-1 left-4 w-2 h-2 bg-foreground rotate-45" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sm.dot }} />
                        <span className="text-[10px] text-foreground-muted">{sm.label}</span>
                      </div>
                      <span
                        className="font-data text-xs font-bold tabular-nums px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                      >{b.score}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-background-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${b.score}%`,
                        background: `linear-gradient(90deg, ${meta.color}, color-mix(in srgb, ${meta.color} 70%, #fff))`,
                        opacity: 0.5 + (b.score / 100) * 0.5,
                      }}
                    />
                  </div>
                </div>
              </div>
              {showInfo && meta.description && (
                <p className="text-[10px] text-foreground-muted/70 mt-1.5 ml-12 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-150">
                  {meta.description}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
