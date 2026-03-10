"use client"

import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"

interface BudgetInsight {
  type: "info" | "warning" | "success" | "danger"
  icon: string
  title: string
  description: string
}

interface AIInsights {
  keyInsight: { title: string; description: string }
  savingsOpportunities: Array<{ area: string; estimatedSavings: number; description: string }>
  budgetRecommendations: Array<{ category: string; suggestedLimit: number; reason: string }>
  subscriptionReview: Array<{ name: string; verdict: "keep" | "review" | "cancel"; reason: string }>
  anomalyComments: Array<{ category: string; comment: string }>
  actionItems: Array<{ action: string; priority: "high" | "medium" | "low" }>
}

const DOT_COLORS: Record<string, string> = {
  danger: "bg-error",
  warning: "bg-warning",
  info: "bg-primary",
  success: "bg-success",
}

const VERDICT_COLORS = {
  keep: "text-success",
  review: "text-warning",
  cancel: "text-error",
} as const

export function BudgetSmartInsights({
  insights,
  aiInsights,
  hasProvider,
  isGenerating,
  onGenerate,
}: {
  insights: BudgetInsight[]
  aiInsights: AIInsights | undefined
  hasProvider: boolean
  isGenerating: boolean
  onGenerate: (force?: boolean) => void
}) {
  // Filter static insights to only danger/warning
  const warnings = insights.filter((i) => i.type === "danger" || i.type === "warning")

  return (
    <div className="space-y-4">
      {/* AI key insight — clean pull-quote */}
      {aiInsights && (
        <div className="border-l-2 border-primary pl-4">
          <p className="text-xs font-semibold text-primary">{aiInsights.keyInsight.title}</p>
          <p className="text-sm text-foreground mt-0.5 leading-relaxed">
            {aiInsights.keyInsight.description}
          </p>
        </div>
      )}

      {/* Savings opportunities */}
      {aiInsights && aiInsights.savingsOpportunities.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Savings Opportunities
          </p>
          {aiInsights.savingsOpportunities.map((opp, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{opp.area}</p>
                <p className="text-[11px] text-foreground-muted truncate">{opp.description}</p>
              </div>
              <span className="text-xs font-semibold font-data tabular-nums text-success flex-shrink-0">
                {formatCurrency(opp.estimatedSavings)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Budget recommendations */}
      {aiInsights && aiInsights.budgetRecommendations.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Recommendations
          </p>
          {aiInsights.budgetRecommendations.map((rec, i) => (
            <p key={i} className="text-xs text-foreground">
              <span className="font-medium">{rec.category}</span>
              {" → "}
              <span className="font-semibold font-data tabular-nums">
                {formatCurrency(rec.suggestedLimit)}
              </span>
              <span className="text-foreground-muted ml-1">— {rec.reason}</span>
            </p>
          ))}
        </div>
      )}

      {/* Subscription review */}
      {aiInsights && aiInsights.subscriptionReview.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Subscription Review
          </p>
          {aiInsights.subscriptionReview.map((sub, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={cn("font-semibold uppercase text-[9px]", VERDICT_COLORS[sub.verdict])}>
                  {sub.verdict}
                </span>
                <span className="text-foreground">{sub.name}</span>
              </div>
              <span className="text-foreground-muted text-[11px]">{sub.reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action items */}
      {aiInsights && aiInsights.actionItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Action Items
          </p>
          {aiInsights.actionItems.map((item, i) => (
            <p key={i} className="text-xs text-foreground">
              <span className={cn(
                "font-semibold uppercase text-[9px] mr-1.5",
                item.priority === "high" ? "text-error" : item.priority === "medium" ? "text-warning" : "text-primary"
              )}>
                {item.priority}
              </span>
              {item.action}
            </p>
          ))}
        </div>
      )}

      {/* Static warning insights — compact rows with colored dot */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((insight, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", DOT_COLORS[insight.type])} />
              <p className="text-xs text-foreground">
                <span className="font-medium">{insight.title}</span>
                <span className="text-foreground-muted ml-1">— {insight.description}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Action footer */}
      {hasProvider ? (
        <button
          onClick={() => onGenerate(!!aiInsights)}
          disabled={isGenerating}
          className="text-xs text-primary font-medium hover:text-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {isGenerating ? (
            <>
              <span className="material-symbols-rounded animate-spin" style={{ fontSize: 12 }}>progress_activity</span>
              Analyzing…
            </>
          ) : (
            aiInsights ? "Refresh analysis" : "Analyze spending"
          )}
        </button>
      ) : (
        <Link
          href="/finance/settings#ai"
          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          Enable AI for smarter insights →
        </Link>
      )}
    </div>
  )
}
