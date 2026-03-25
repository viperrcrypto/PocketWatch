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

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Categorize</h1>
          <p className="text-sm text-foreground-muted mt-0.5">
            {mode === "review"
              ? reviewCount > 0
                ? `${reviewCount} need review`
                : uncategorizedCount > 0
                  ? `${uncategorizedCount} uncategorized — try AI Rebuild`
                  : "All caught up"
              : `${uncategorizedCount} uncategorized`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModeButton
            active={mode === "review"}
            icon="swipe"
            label="Pattern Review"
            badge={reviewCount}
            onClick={() => router.push("/finance/categorize")}
          />
          <ModeButton
            active={mode === "rebuild"}
            icon="auto_awesome"
            label="AI Rebuild"
            badge={uncategorizedCount}
            onClick={() => router.push("/finance/categorize?mode=rebuild")}
          />
          <Link
            href="/finance/transactions"
            className="px-3 py-2 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            Back
          </Link>
        </div>
      </div>

      {/* Mode content */}
      {mode === "review" && <PatternReviewFlow />}
      {mode === "rebuild" && <AIRebuildPanel uncategorizedCount={uncategorizedCount} />}
    </div>
  )
}

function ModeButton({ active, icon, label, badge, onClick }: {
  active: boolean; icon: string; label: string; badge?: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors",
        active
          ? "bg-foreground text-background"
          : "border border-card-border hover:bg-background-secondary"
      )}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{icon}</span>
      {label}
      {badge != null && badge > 0 && !active && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-error text-white text-[9px] font-bold flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  )
}
