"use client"

import type { Recommendation } from "@/types/travel"
import { cn } from "@/lib/utils"

interface RecommendationsPanelProps {
  recommendations: Recommendation[]
}

const badgeColorMap: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
  accent: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30",
  gold: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
}

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  if (recommendations.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">Top Picks</h3>
      {recommendations.map((rec) => (
        <a
          key={rec.rank}
          href={rec.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block card p-4 hover:translate-y-[-1px] hover:shadow-md transition-colors duration-200"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <span
                className={cn(
                  "inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border mb-1.5",
                  badgeColorMap[rec.badgeColor] || badgeColorMap.emerald
                )}
              >
                {rec.badgeText}
              </span>
              <p className="text-sm font-bold text-foreground truncate">{rec.title}</p>
              <p className="text-xs text-foreground-muted">{rec.subtitle}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-foreground">{rec.totalCost}</p>
              {rec.cppValue && (
                <p className="text-xs text-primary font-medium">{rec.cppValue}</p>
              )}
            </div>
          </div>
          <div className="space-y-0.5">
            {rec.details.map((detail, i) => (
              <p key={i} className="text-[11px] text-foreground-muted leading-relaxed">
                {detail}
              </p>
            ))}
          </div>
        </a>
      ))}
    </div>
  )
}
