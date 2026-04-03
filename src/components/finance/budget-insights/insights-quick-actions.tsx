import Link from "next/link"

export function InsightsQuickActions({ hasBudgets }: { hasBudgets: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Link
        href="/finance/budgets/workshop"
        className="p-5 rounded-2xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-rounded text-primary flex-shrink-0" style={{ fontSize: 22 }}>tune</span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {hasBudgets ? "Adjust Budgets" : "Set Up Budgets"}
            </p>
            <p className="text-xs text-foreground-muted">
              {hasBudgets ? "Fine-tune your limits in the Workshop" : "Pre-filled with data-driven suggestions"}
            </p>
          </div>
        </div>
      </Link>

      <Link
        href="/finance/trends"
        className="p-5 rounded-2xl bg-card border border-card-border hover:border-card-border-hover transition-colors group"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 22 }}>trending_up</span>
          <div>
            <p className="text-sm font-semibold text-foreground">View Trends</p>
            <p className="text-xs text-foreground-muted">See how your spending has changed over time</p>
          </div>
        </div>
      </Link>
    </div>
  )
}
