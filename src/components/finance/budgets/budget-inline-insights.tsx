"use client"

import { cn } from "@/lib/utils"
import type { BudgetInsight } from "./budget-helpers"

interface BudgetInlineInsightsProps {
  insights: BudgetInsight[]
  isGenerating: boolean
  onGenerate: () => void
}

export function BudgetInlineInsights({ insights, isGenerating, onGenerate }: BudgetInlineInsightsProps) {
  return (
    <div className="bg-card border border-card-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-rounded text-warning" style={{ fontSize: 16 }}>lightbulb</span>
        <h3 className="text-sm font-semibold text-foreground">Smart Insights</h3>
      </div>

      {insights.length > 0 ? (
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className={cn("material-symbols-rounded flex-shrink-0 mt-0.5", { "text-error": insight.type === "danger", "text-warning": insight.type === "warning", "text-success": insight.type === "success", "text-primary": insight.type === "info" })} style={{ fontSize: 14 }}>{insight.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-relaxed">{insight.message}</p>
                {insight.action && <button onClick={insight.action.onClick} className="text-[10px] text-primary font-medium mt-1 hover:text-primary-hover transition-colors">{insight.action.label}</button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-foreground-muted">No insights yet — generate an AI analysis.</p>
      )}

      <div className="mt-4 pt-3 border-t border-card-border">
        <button onClick={onGenerate} disabled={isGenerating} className="w-full py-2 rounded-xl text-xs font-semibold bg-foreground/5 text-foreground hover:bg-foreground/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{isGenerating ? "hourglass_empty" : "auto_awesome"}</span>
          {isGenerating ? "Analyzing..." : "Let AI optimize your budget"}
        </button>
      </div>
    </div>
  )
}
