import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"

export function InsightsSummaryCards({
  totalDataDriven,
  totalYourBudget,
  totalWithBudget,
  hasBudgets,
  displayScore,
  monthsAnalyzed,
}: {
  totalDataDriven: number
  totalYourBudget: number
  totalWithBudget: number
  hasBudgets: boolean
  displayScore: number
  monthsAnalyzed: number
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Data-Driven Total */}
      <div className="bg-card border border-card-border p-6 rounded-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <span className="material-symbols-rounded" style={{ fontSize: 48 }}>analytics</span>
        </div>
        <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-widest mb-1">Data-Driven Budget</p>
        <p className="text-2xl font-bold font-data tabular-nums text-foreground">{formatCurrency(totalDataDriven)}</p>
        <p className="text-xs text-foreground-muted mt-2">Based on {monthsAnalyzed} months of spending</p>
      </div>

      {/* Your Budget Total */}
      <div className="bg-card border border-card-border p-6 rounded-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <span className="material-symbols-rounded" style={{ fontSize: 48 }}>payments</span>
        </div>
        <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-widest mb-1">Your Budget</p>
        {hasBudgets ? (
          <>
            <p className="text-2xl font-bold font-data tabular-nums text-foreground">{formatCurrency(totalYourBudget)}</p>
            <p className="text-xs text-foreground-muted mt-2">{totalWithBudget} categories budgeted</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-foreground-muted">Not set</p>
            <Link href="/finance/budgets/workshop" className="text-xs text-primary font-semibold hover:underline mt-2 inline-block">Set up budgets</Link>
          </>
        )}
      </div>

      {/* Optimization Score */}
      <div className={cn(
        "p-6 rounded-2xl relative overflow-hidden group",
        displayScore >= 70 ? "bg-success/5 border border-success/20"
          : displayScore >= 40 ? "bg-warning/5 border border-warning/20"
          : "bg-error/5 border border-error/20"
      )}>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
        <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-widest mb-1">Optimization Score</p>
        <div className="flex items-baseline gap-1">
          <p className={cn(
            "text-3xl font-bold font-data tabular-nums",
            displayScore >= 70 ? "text-success" : displayScore >= 40 ? "text-warning" : "text-error"
          )}>
            {displayScore}
          </p>
          <span className="text-sm text-foreground-muted font-medium">/100</span>
        </div>
        <p className="text-xs text-foreground-muted mt-2">
          {displayScore >= 80 ? "Excellent alignment" :
           displayScore >= 60 ? "Good, room to improve" :
           displayScore >= 40 ? "Needs attention" :
           hasBudgets ? "Significant gaps" : "Set budgets to improve"}
        </p>
      </div>
    </div>
  )
}
