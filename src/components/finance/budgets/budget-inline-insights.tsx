"use client"

import { useEffect, useRef, useState } from "react"
import { SuccessCheck } from "@/components/ui/success-check"
import { cn } from "@/lib/utils"
import type { BudgetInsight } from "./budget-types"

const ACCENT_COLORS: Record<string, string> = {
  danger: "var(--error)",
  warning: "var(--warning)",
  success: "var(--success)",
  info: "var(--primary)",
}

interface BudgetInlineInsightsProps {
  insights: BudgetInsight[]
  isGenerating: boolean
  onGenerate: () => void
}

export function BudgetInlineInsights({ insights, isGenerating, onGenerate }: BudgetInlineInsightsProps) {
  // Briefly show a success check on the falling edge of `isGenerating`.
  const [showSaved, setShowSaved] = useState(false)
  const wasGenerating = useRef(false)
  useEffect(() => {
    const justFinished = wasGenerating.current && !isGenerating
    wasGenerating.current = isGenerating
    if (justFinished) {
      setShowSaved(true)
      const t = setTimeout(() => setShowSaved(false), 1800)
      return () => clearTimeout(t)
    }
  }, [isGenerating])

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-rounded text-warning" style={{ fontSize: 16 }}>lightbulb</span>
        <h3 className="text-sm font-semibold text-foreground">Smart Insights</h3>
        {showSaved && <SuccessCheck show size={18} className="ml-auto" />}
      </div>

      {insights.length > 0 ? (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-foreground/[0.03] border border-card-border/50">
              <div className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: ACCENT_COLORS[insight.type] ?? "var(--primary)" }} />
              <span className={cn("material-symbols-rounded flex-shrink-0 mt-0.5", { "text-error": insight.type === "danger", "text-warning": insight.type === "warning", "text-success": insight.type === "success", "text-primary": insight.type === "info" })} style={{ fontSize: 14 }}>{insight.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground leading-relaxed">{insight.message}</p>
                {insight.action && <button onClick={insight.action.onClick} className="text-[10px] text-primary font-medium mt-1 hover:text-primary-hover transition-colors">{insight.action.label}</button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <span className="material-symbols-rounded text-foreground-muted/40 block mb-2" style={{ fontSize: 24 }}>lightbulb</span>
          <p className="text-sm text-foreground-muted">No insights yet — generate an AI analysis.</p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-card-border">
        <button onClick={onGenerate} disabled={isGenerating} className="w-full py-2.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{isGenerating ? "hourglass_empty" : "auto_awesome"}</span>
          {isGenerating ? "Analyzing..." : "Let AI optimize your budget"}
        </button>
      </div>
    </div>
  )
}
