import { formatCurrency, cn } from "@/lib/utils"

export function WorkshopStatsCards({
  totalBudgeted,
  hasChanges,
  income,
  hasIncomeOverride,
  estimatedIncome,
  editingIncome,
  incomeInput,
  buffer,
  bufferPercent,
  onIncomeInputChange,
  onIncomeSave,
  onIncomeCancel,
  onIncomeEdit,
  onIncomeReset,
  onIncomeKeyDown,
}: {
  totalBudgeted: number
  hasChanges: boolean
  income: number
  hasIncomeOverride: boolean
  estimatedIncome: number
  editingIncome: boolean
  incomeInput: string
  buffer: number
  bufferPercent: number
  onIncomeInputChange: (value: string) => void
  onIncomeSave: () => void
  onIncomeCancel: () => void
  onIncomeEdit: () => void
  onIncomeReset: () => void
  onIncomeKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Budgeted */}
      <div className="bg-card border border-card-border p-6 rounded-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <span className="material-symbols-rounded" style={{ fontSize: 48 }}>payments</span>
        </div>
        <p className="text-foreground-muted text-sm font-medium mb-1">Total Budgeted</p>
        <p className="text-2xl font-bold font-data tabular-nums text-foreground">
          {formatCurrency(totalBudgeted)}
        </p>
        <div className="mt-3">
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            hasChanges ? "bg-primary/10 text-primary" : "bg-background-secondary text-foreground-muted"
          )}>
            {hasChanges ? "Modified" : "No changes"}
          </span>
        </div>
      </div>

      {/* Total Income */}
      <div className="bg-card border border-card-border p-6 rounded-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <span className="material-symbols-rounded" style={{ fontSize: 48 }}>trending_up</span>
        </div>
        <p className="text-foreground-muted text-sm font-medium mb-1">Total Income</p>

        {editingIncome ? (
          <div className="mt-1">
            <div className="flex items-center gap-2">
              <span className="text-foreground-muted text-lg">$</span>
              <input
                type="number"
                value={incomeInput}
                onChange={(e) => onIncomeInputChange(e.target.value)}
                placeholder={estimatedIncome.toFixed(0)}
                min="0"
                autoFocus
                className="w-full text-2xl font-bold font-data tabular-nums text-foreground bg-transparent border-b-2 border-primary outline-none py-0.5"
                onKeyDown={onIncomeKeyDown}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={onIncomeSave}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Save
              </button>
              <button
                onClick={onIncomeCancel}
                className="text-xs text-foreground-muted hover:text-foreground"
              >
                Cancel
              </button>
              {hasIncomeOverride && (
                <button
                  onClick={onIncomeReset}
                  className="text-xs text-foreground-muted hover:text-error ml-auto"
                >
                  Use estimated
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold font-data tabular-nums text-foreground">
              {formatCurrency(income)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                hasIncomeOverride
                  ? "bg-primary/10 text-primary"
                  : "bg-background-secondary text-foreground-muted"
              )}>
                {hasIncomeOverride ? "Manual" : "Estimated"}
              </span>
              <button
                onClick={onIncomeEdit}
                className="text-[10px] text-primary hover:underline font-medium"
              >
                Edit
              </button>
            </div>
          </>
        )}
      </div>

      {/* Safety Buffer */}
      <div className={cn(
        "p-6 rounded-2xl relative overflow-hidden group",
        buffer >= 0
          ? "bg-primary/5 border border-primary/20"
          : "bg-error/5 border border-error/20"
      )}>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
        <p className={cn(
          "text-sm font-semibold mb-1 uppercase tracking-wider",
          buffer >= 0 ? "text-primary" : "text-error"
        )}>
          Safety Buffer
        </p>
        <p className="text-2xl font-bold font-data tabular-nums text-foreground">
          {formatCurrency(Math.max(buffer, 0))}
        </p>
        <div className="mt-3 h-1.5 w-full bg-background-secondary rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", buffer >= 0 ? "bg-primary" : "bg-error")}
            style={{ width: `${Math.min(Math.max(bufferPercent, 0), 100)}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] text-foreground-muted font-semibold uppercase">
          {bufferPercent > 0 ? `${bufferPercent.toFixed(0)}% of income unallocated` : "Over-allocated"}
        </p>
      </div>
    </div>
  )
}
