import Link from "next/link"
import { cn } from "@/lib/utils"
import { VERDICT_STYLES, IMPACT_STYLES } from "./insights-constants"
import type { VerdictKey, ImpactKey } from "./insights-constants"

interface AIAnalysis {
  overallScore: number
  overallVerdict: string
  categoryAnalysis: Array<{ category: string; verdict: string; priority: string; comment: string }>
  recommendations: Array<{ action: string; impact: string }>
  missingBudgets: Array<{ category: string; reason: string }>
}

export function InsightsAIAnalysis({
  aiAvailable,
  aiData,
  hasProvider,
  loadingAI,
  generatePending,
  generatedAt,
  onGenerate,
}: {
  aiAvailable: boolean
  aiData: { analysis?: AIAnalysis; providerLabel?: string | null } | null | undefined
  hasProvider: boolean
  loadingAI: boolean
  generatePending: boolean
  generatedAt: string | null
  onGenerate: (force: boolean) => void
}) {
  return (
    <div className="bg-card rounded-2xl border border-card-border overflow-hidden">
      {/* AI Header */}
      <div className="p-6 border-b border-card-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            aiAvailable ? "bg-primary/10 text-primary" : "bg-background-secondary text-foreground-muted"
          )}>
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>psychology</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">AI Budget Analysis</h3>
            <p className="text-[10px] text-foreground-muted">
              {aiAvailable && generatedAt
                ? `Generated ${generatedAt}${aiData?.providerLabel ? ` via ${aiData.providerLabel}` : ""}`
                : hasProvider ? "AI-powered budget optimization" : "Connect an AI provider for smart analysis"}
            </p>
          </div>
        </div>
        {hasProvider && (
          <button
            onClick={() => onGenerate(aiAvailable)}
            disabled={generatePending}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50",
              aiAvailable ? "text-primary hover:text-primary/80" : "bg-primary text-white hover:bg-primary-hover"
            )}
          >
            {generatePending ? (
              <><span className="material-symbols-rounded animate-spin" style={{ fontSize: 14 }}>progress_activity</span>Analyzing...</>
            ) : aiAvailable ? (
              <><span className="material-symbols-rounded" style={{ fontSize: 14 }}>refresh</span>Refresh</>
            ) : (
              <><span className="material-symbols-rounded" style={{ fontSize: 14 }}>auto_awesome</span>Analyze My Budgets</>
            )}
          </button>
        )}
      </div>

      {/* AI Loading State */}
      {generatePending && (
        <div className="p-6">
          <div className="space-y-3 animate-pulse">
            <div className="h-3 bg-card-border/30 rounded w-3/4" />
            <div className="h-3 bg-card-border/30 rounded w-1/2" />
            <div className="h-3 bg-card-border/30 rounded w-2/3" />
            <div className="h-3 bg-card-border/30 rounded w-1/3" />
          </div>
        </div>
      )}

      {/* AI Results */}
      {aiAvailable && aiData?.analysis && !generatePending && (
        <div className="p-6 space-y-6">
          {/* Overall Verdict */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/10">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "text-sm font-bold font-data tabular-nums",
                aiData.analysis.overallScore >= 70 ? "text-success" :
                aiData.analysis.overallScore >= 40 ? "text-warning" : "text-error"
              )}>
                Score: {aiData.analysis.overallScore}/100
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{aiData.analysis.overallVerdict}</p>
          </div>

          {/* Category Verdicts */}
          {aiData.analysis.categoryAnalysis.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-3">Category Verdicts</p>
              <div className="space-y-2">
                {aiData.analysis.categoryAnalysis.map((cat) => {
                  const verdictStyle = VERDICT_STYLES[cat.verdict as VerdictKey] ?? VERDICT_STYLES["missing"]
                  const priorityStyle = IMPACT_STYLES[cat.priority as ImpactKey]
                  return (
                    <div key={`${cat.category}-${cat.verdict}`} className="flex items-start gap-3 py-2">
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0 mt-0.5", priorityStyle)}>{cat.priority}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{cat.category}</span>
                          <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full", verdictStyle.bg, verdictStyle.text)}>{verdictStyle.label}</span>
                        </div>
                        <p className="text-[11px] text-foreground-muted mt-0.5">{cat.comment}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {aiData.analysis.recommendations.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-3">Recommendations</p>
              <div className="space-y-2">
                {aiData.analysis.recommendations.map((rec) => (
                  <div key={`${rec.action.slice(0, 40)}-${rec.impact}`} className="flex items-center gap-2">
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0", IMPACT_STYLES[rec.impact as ImpactKey])}>{rec.impact}</span>
                    <span className="text-xs text-foreground">{rec.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Budgets */}
          {aiData.analysis.missingBudgets.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-3">Untracked Spending</p>
              <div className="space-y-2">
                {aiData.analysis.missingBudgets.map((m) => (
                  <div key={m.category} className="flex items-start gap-2">
                    <span className="material-symbols-rounded text-warning flex-shrink-0 mt-0.5" style={{ fontSize: 14 }}>add_circle</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{m.category}</p>
                      <p className="text-[11px] text-foreground-muted">{m.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Provider CTA */}
      {!hasProvider && !loadingAI && (
        <div className="p-6">
          <p className="text-xs text-foreground-muted mb-4 leading-relaxed">
            Connect an AI provider to get personalized budget optimization analysis.
            The AI compares your spending patterns with your budget limits and identifies gaps.
          </p>
          <Link
            href="/finance/settings#ai"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>settings</span>
            Enable AI Intelligence
          </Link>
        </div>
      )}

      {/* Provider ready but no analysis yet */}
      {hasProvider && !aiAvailable && !generatePending && (
        <div className="p-6 text-center">
          <p className="text-xs text-foreground-muted mb-1">
            Click &quot;Analyze My Budgets&quot; to get AI-powered optimization insights
          </p>
        </div>
      )}

      {/* Footer */}
      {hasProvider && (
        <div className="px-6 py-3 border-t border-card-border/50 bg-background-secondary/30">
          <p className="text-[10px] text-foreground-muted">
            Only aggregated spending totals are sent to the AI provider. No account details or personal identifiers are shared.
          </p>
        </div>
      )}
    </div>
  )
}
