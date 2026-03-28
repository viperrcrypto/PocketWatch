"use client"

import { useAIInsights, useGenerateAIInsights } from "@/hooks/use-finance"
import { formatCurrency, cn } from "@/lib/utils"

export function DashboardInsightsCard() {
  const { data: aiData } = useAIInsights()
  const generateInsights = useGenerateAIInsights()

  return (
    <div className="bg-card rounded-xl overflow-hidden flex flex-col" style={{ boxShadow: "var(--shadow-sm)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-card-border/30 flex-shrink-0">
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

      {aiData?.insights ? (
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-card-border/30">
            {/* Key Insight */}
            <div className="px-5 py-4">
              <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">Key Insight</span>
              <p className="text-xs font-semibold text-foreground mt-1.5">{aiData.insights.keyInsight.title}</p>
              <p className="text-[11px] text-foreground-muted leading-relaxed mt-0.5">{aiData.insights.keyInsight.description}</p>
            </div>

            {/* All savings opportunities */}
            {aiData.insights.savingsOpportunities.map((opp) => (
              <div key={opp.area} className="px-5 py-4">
                <span className="text-[9px] font-bold bg-success/10 text-success px-1.5 py-0.5 rounded uppercase">Savings</span>
                <p className="text-xs font-semibold text-foreground mt-1.5">{opp.area}</p>
                <p className="text-[11px] text-foreground-muted leading-relaxed mt-0.5">{opp.description}</p>
                {opp.estimatedSavings > 0 && (
                  <p className="text-[11px] font-semibold text-success mt-1">
                    Est. savings: {formatCurrency(opp.estimatedSavings)}
                  </p>
                )}
              </div>
            ))}

            {/* All action items */}
            {aiData.insights.actionItems.map((item, i) => (
              <div key={`${item.priority}-${i}`} className="px-5 py-4">
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
            ))}

            {/* Anomaly comments */}
            {aiData.insights.anomalyComments?.map((a, i) => (
              <div key={`anomaly-${i}`} className="px-5 py-4">
                <span className="text-[9px] font-bold bg-warning/10 text-warning px-1.5 py-0.5 rounded uppercase">Anomaly</span>
                <p className="text-xs font-semibold text-foreground mt-1.5">{a.category}</p>
                <p className="text-[11px] text-foreground-muted leading-relaxed mt-0.5">{a.comment}</p>
              </div>
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
