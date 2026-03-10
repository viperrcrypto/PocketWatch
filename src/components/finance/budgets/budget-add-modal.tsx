import { cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface BudgetItem {
  id: string
  category: string
}

export function BudgetAddModal({
  budgetableCategories,
  existingBudgets,
  newCategory,
  newAmount,
  formError,
  isPending,
  onCategoryChange,
  onAmountChange,
  onCreate,
  onClose,
}: {
  budgetableCategories: string[]
  existingBudgets: BudgetItem[] | undefined
  newCategory: string
  newAmount: string
  formError: string
  isPending: boolean
  onCategoryChange: (cat: string) => void
  onAmountChange: (val: string) => void
  onCreate: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">Add Budget</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-2">Category</label>
            <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
              {budgetableCategories.map((cat) => {
                const meta = getCategoryMeta(cat)
                const isSelected = newCategory === cat
                const isAlreadyBudgeted = existingBudgets?.some((b) => b.category === cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    disabled={isAlreadyBudgeted}
                    onClick={() => onCategoryChange(cat)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all text-left",
                      isSelected
                        ? "ring-2 ring-primary bg-blue-50 dark:bg-primary/10 text-foreground"
                        : isAlreadyBudgeted
                        ? "bg-gray-100 dark:bg-background-secondary text-foreground-muted/40 cursor-not-allowed"
                        : "bg-gray-100 dark:bg-background-secondary text-foreground-muted hover:bg-gray-200 dark:hover:bg-background-secondary/80 hover:text-foreground"
                    )}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.hex }} />
                    <span className="truncate">{cat}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1.5">Monthly Limit</label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="$500"
              min="1"
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-background-secondary border border-card-border text-sm text-foreground"
            />
          </div>
          {formError && <p className="text-xs text-error">{formError}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors rounded-lg">Cancel</button>
          <button
            onClick={onCreate}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create Budget"}
          </button>
        </div>
      </div>
    </div>
  )
}
