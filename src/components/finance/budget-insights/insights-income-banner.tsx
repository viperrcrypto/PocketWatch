import { formatCurrency, cn } from "@/lib/utils"

export function InsightsIncomeBanner({
  income,
  totalDataDriven,
  totalYourBudget,
  hasBudgets,
}: {
  income: number
  totalDataDriven: number
  totalYourBudget: number
  hasBudgets: boolean
}) {
  if (income <= 0) return null

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 flex flex-wrap items-center gap-x-8 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>account_balance</span>
        <span className="text-xs text-foreground-muted">Monthly Income:</span>
        <span className="text-xs font-bold font-data tabular-nums text-foreground">{formatCurrency(income)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground-muted">Data-Driven:</span>
        <span className={cn(
          "text-xs font-bold font-data tabular-nums",
          totalDataDriven <= income ? "text-success" : "text-error"
        )}>
          {income > 0 ? `${Math.round((totalDataDriven / income) * 100)}%` : "\u2014"} of income
        </span>
      </div>
      {hasBudgets && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted">Your Budget:</span>
          <span className={cn(
            "text-xs font-bold font-data tabular-nums",
            totalYourBudget <= income ? "text-success" : "text-error"
          )}>
            {income > 0 ? `${Math.round((totalYourBudget / income) * 100)}%` : "\u2014"} of income
          </span>
        </div>
      )}
    </div>
  )
}
