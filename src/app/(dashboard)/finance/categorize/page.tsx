"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useUncategorizedTransactions, useReviewCount } from "@/hooks/use-finance"
import { PatternReviewFlow } from "@/components/finance/categorize/pattern-review-flow"
import { AIRebuildPanel } from "@/components/finance/categorize/ai-rebuild-panel"
import { cn } from "@/lib/utils"

type PageMode = "review" | "rebuild"

export default function CategorizePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawMode = searchParams.get("mode")
  const mode: PageMode = rawMode === "rebuild" ? "rebuild" : "review"

  const { data: uncatData } = useUncategorizedTransactions()
  const { data: reviewData } = useReviewCount()

  const uncategorizedCount = uncatData?.total ?? 0
  const reviewCount = reviewData?.count ?? 0
  const activeCount = mode === "review" ? reviewCount : uncategorizedCount

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/finance/transactions"
          className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>arrow_back</span>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Categorize</h1>
          {activeCount > 0 && (
            <p className="text-xs text-foreground-muted">
              {activeCount} {mode === "review" ? "to review" : "uncategorized"}
            </p>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-background-secondary border border-card-border p-1 rounded-xl">
        <button
          onClick={() => router.push("/finance/categorize")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
            mode === "review"
              ? "bg-card text-foreground shadow-sm"
              : "text-foreground-muted hover:text-foreground"
          )}
        >
          Review
          <span className={cn(
            "px-1.5 py-0.5 text-[10px] font-semibold rounded-full tabular-nums",
            !reviewCount && "invisible",
            mode === "review" ? "bg-orange-500/10 text-orange-500" : "bg-foreground-muted/10 text-foreground-muted"
          )}>
            {reviewCount || 0}
          </span>
        </button>
        <button
          onClick={() => router.push("/finance/categorize?mode=rebuild")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
            mode === "rebuild"
              ? "bg-card text-foreground shadow-sm"
              : "text-foreground-muted hover:text-foreground"
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 15 }}>auto_awesome</span>
          AI Rebuild
          <span className={cn(
            "px-1.5 py-0.5 text-[10px] font-semibold rounded-full tabular-nums",
            !uncategorizedCount && "invisible",
            mode === "rebuild" ? "bg-primary/10 text-primary" : "bg-foreground-muted/10 text-foreground-muted"
          )}>
            {uncategorizedCount || 0}
          </span>
        </button>
      </div>

      {/* Content */}
      {mode === "review" && <PatternReviewFlow />}
      {mode === "rebuild" && <AIRebuildPanel uncategorizedCount={uncategorizedCount} />}
    </div>
  )
}
