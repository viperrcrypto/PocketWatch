"use client"

import { useState, useMemo } from "react"
import { useAIInsights, useGenerateAIInsights } from "@/hooks/use-finance"
import { formatCurrency, cn } from "@/lib/utils"

type Filter = "all" | "savings" | "actions" | "anomalies"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "savings", label: "Savings" },
  { key: "actions", label: "Actions" },
  { key: "anomalies", label: "Alerts" },
]

export function DashboardInsightsCard() {
  const { data: aiData } = useAIInsights()
  const generateInsights = useGenerateAIInsights()
  const [filter, setFilter] = useState<Filter>("all")

  const items = useMemo(() => {
    if (!aiData?.insights) return []

    const all: Array<{ type: "key" | "savings" | "action" | "anomaly"; node: React.ReactNode; key: string }> = []

    // Key insight always first
    all.push({
      type: "key",
      key: "key-insight",
      node: (
        <div className="px-5 py-4">
          <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">Key Insight</span>
          <p className="text-xs font-semibold text-foreground mt-1.5">{aiData.insights.keyInsight.title}</p>
          <p className="text-[11px] text-foreground-muted leading-relaxed mt-0.5">{aiData.insights.keyInsight.description}</p>
        </div>
      ),
    })

    for (const opp of aiData.insights.savingsOpportunities) {
      all.push({
        type: "savings",
        key: `savings-${opp.area}`,
        node: (
          <div className="px-5 py-4">
            <span className="text-[9px] font-bold bg-success/10 text-success px-1.5 py-0.5 rounded uppercase">Savings</span>
            <p className="text-xs font-semibold text-foreground mt-1.5">{opp.area}</p>
            <p className="text-[11px] text-foreground-muted leading-relaxed mt-0.5">{opp.description}</p>
            {opp.estimatedSavings > 0 && (
              <p className="text-[11px] font-semibold text-success mt-1">Est. savings: {formatCurrency(opp.estimatedSavings)}</p>
            )}
          </div>
        ),
      })
    }

    for (const [i, item] of aiData.insights.actionItems.entries()) {
      all.push({
        type: "action",
        key: `action-${i}`,
        node: (
          <div className="px-5 py-4">
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
              item.priority === "high" ? "bg-error/10 text-error" :
              item.priority === "medium" ? "bg-warning/10 text-warning" :
              "bg-info/10 text-info"
            )}>
              {item.priority}
            </span>
            <p className="text-[11px] text-foreground leading-relaxed mt-1.5">{item.action}</p>
          </div>
        ),
      })
    }

    for (const [i, a] of (aiData.insights.anomalyComments ?? []).entries()) {
      all.push({
        type: "anomaly",
        key: `anomaly-${i}`,
        node: (
          <div className="px-5 py-4">
            <span className="text-[9px] font-bold bg-warning/10 text-warning px-1.5 py-0.5 rounded uppercase">Anomaly</span>
            <p className="text-xs font-semibold text-foreground mt-1.5">{a.category}</p>
            <p className="text-[11px] text-foreground-muted leading-relaxed mt-0.5">{a.comment}</p>
          </div>
        ),
      })
    }

    if (filter === "all") return all
    if (filter === "savings") return all.filter((i) => i.type === "key" || i.type === "savings")
    if (filter === "actions") return all.filter((i) => i.type === "key" || i.type === "action")
    if (filter === "anomalies") return all.filter((i) => i.type === "key" || i.type === "anomaly")
    return all
  }, [aiData, filter])

  // Count badges
  const counts = useMemo(() => {
    if (!aiData?.insights) return { savings: 0, actions: 0, anomalies: 0 }
    return {
      savings: aiData.insights.savingsOpportunities.length,
      actions: aiData.insights.actionItems.length,
      anomalies: aiData.insights.anomalyComments?.length ?? 0,
    }
  }, [aiData])

  return (
    <div className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-card-border/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>auto_awesome</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">AI Insights</span>
          </div>
          <button
            onClick={() => generateInsights.mutate({ force: true })}
            disabled={generateInsights.isPending}
            className="p-1 rounded text-foreground-muted hover:text-foreground transition-colors"
            aria-label="Refresh insights"
          >
            <span className={cn("material-symbols-rounded", generateInsights.isPending && "animate-spin")} style={{ fontSize: 14 }}>
              {generateInsights.isPending ? "progress_activity" : "refresh"}
            </span>
          </button>
        </div>

        {/* Filter tabs */}
        {aiData?.insights && (
          <div className="flex items-center gap-1 overflow-x-auto">
            {FILTERS.map((f) => {
              const count = f.key === "all" ? null : counts[f.key]
              const hasItems = f.key === "all" || (count != null && count > 0)
              if (!hasItems) return null
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors whitespace-nowrap",
                    filter === f.key
                      ? "bg-primary text-white"
                      : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                  )}
                >
                  {f.label}
                  {count != null && count > 0 && (
                    <span className={cn("ml-1 tabular-nums", filter === f.key ? "text-white/70" : "text-foreground-muted/50")}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {aiData?.insights ? (
        <div className="max-h-[380px] overflow-y-auto">
          <div className="divide-y divide-card-border/30">
            {items.map((item) => (
              <div key={item.key}>{item.node}</div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 px-5">
          <span className="material-symbols-rounded text-foreground-muted/30 block mb-2" style={{ fontSize: 24 }}>auto_awesome</span>
          <p className="text-[11px] text-foreground-muted mb-3">Get AI-powered spending insights</p>
          <button
            onClick={() => generateInsights.mutate({})}
            disabled={generateInsights.isPending}
            className="px-4 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {generateInsights.isPending ? "Generating..." : "Generate"}
          </button>
        </div>
      )}
    </div>
  )
}
