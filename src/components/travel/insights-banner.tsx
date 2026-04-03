"use client"

import { useState } from "react"
import type { ValueInsight } from "@/types/travel"

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-blue-400",
}

function insightSnippet(insight: ValueInsight): string {
  if (insight.type === "sweet-spot-available") return insight.title.replace("Sweet Spot Found: ", "")
  if (insight.type === "route-tip") return insight.title.replace("Look for: ", "")
  if (insight.type === "cash-wins") return "Cash may beat awards here"
  if (insight.type === "book-now") return insight.title
  return insight.title
}

interface InsightsBannerProps {
  insights: ValueInsight[]
}

export function InsightsBanner({ insights }: InsightsBannerProps) {
  const [expanded, setExpanded] = useState(false)

  if (insights.length === 0) return null

  const topSnippet = insightSnippet(insights[0]!)

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full card px-4 py-2.5 text-left transition-colors duration-200 hover:shadow-sm"
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 16 }}>
          lightbulb
        </span>
        <span className="text-xs font-medium text-foreground flex-shrink-0">
          {insights.length} route insight{insights.length !== 1 ? "s" : ""}
        </span>
        {!expanded && (
          <>
            <span className="text-foreground-muted/40">·</span>
            <span className="text-[11px] text-foreground-muted truncate">{topSnippet}</span>
          </>
        )}
        <span className="material-symbols-rounded text-foreground-muted ml-auto flex-shrink-0" style={{ fontSize: 16 }}>
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </div>

      {/* Expanded list */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-card-border/50 space-y-1.5">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[insight.priority] || PRIORITY_DOT.low}`} />
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-foreground">{insight.title}</span>
                <span className="text-[11px] text-foreground-muted ml-1">{insight.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}
