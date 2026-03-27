import Link from "next/link"
import { BudgetCategoryRow } from "@/components/finance/budget-category-row"
import { formatCurrency } from "@/lib/utils"
import type { FinanceTransaction } from "@/hooks/finance/use-transactions"

interface BudgetItem {
  id: string
  category: string
  monthlyLimit: number
  spent: number
  percentUsed: number
  remaining: number
}

export function BudgetCategoryBreakdown({
  budgets,
  txByCategory,
  onEditBudget,
  onDeleteBudget,
  onCategoryChange,
  onAddBudget,
}: {
  budgets: BudgetItem[]
  txByCategory: Record<string, FinanceTransaction[]>
  onEditBudget: (id: string, limit: number) => void
  onDeleteBudget: (id: string) => void
  onCategoryChange: (txId: string, category: string, createRule?: boolean) => void
  onAddBudget: () => void
}) {
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0)
  const totalLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0)
  const overBudgetCount = budgets.filter((b) => b.percentUsed >= 100).length

  return (
    <section id="category-breakdown">
      <div className="bg-card border border-card-border rounded-2xl overflow-hidden h-full flex flex-col" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3.5 border-b border-card-border/50 bg-foreground/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-rounded text-primary" style={{ fontSize: 16 }}>category</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Category Breakdown</h3>
              <p className="text-[10px] text-foreground-muted">
                {formatCurrency(totalSpent, "USD", 0)} of {formatCurrency(totalLimit, "USD", 0)} spent
                {overBudgetCount > 0 && (
                  <span className="text-error font-semibold"> · {overBudgetCount} over budget</span>
                )}
              </p>
            </div>
          </div>
          <Link
            href="/finance/budgets/workshop"
            className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>tune</span>
            Edit All
          </Link>
        </div>
        {[...budgets].sort((a, b) => b.percentUsed - a.percentUsed).map((b) => (
          <BudgetCategoryRow
            key={b.id}
            budget={b}
            transactions={txByCategory[b.category] ?? []}
            onEditBudget={onEditBudget}
            onDeleteBudget={onDeleteBudget}
            onCategoryChange={onCategoryChange}
          />
        ))}
        <div className="px-5 py-3 border-t border-card-border/50">
          <button
            onClick={onAddBudget}
            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add_circle</span>
            Add category budget
          </button>
        </div>
      </div>
    </section>
  )
}
