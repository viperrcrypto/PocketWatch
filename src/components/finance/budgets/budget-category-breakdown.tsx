import Link from "next/link"
import { BudgetCategoryRow } from "@/components/finance/budget-category-row"

interface BudgetItem {
  id: string
  category: string
  monthlyLimit: number
  spent: number
  percentUsed: number
  remaining: number
}

interface TransactionItem {
  id: string
  date: string
  merchantName: string | null
  name: string
  amount: number
  category: string | null
  account?: { name: string; mask: string | null } | null
  isPending?: boolean
  [key: string]: unknown
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
  txByCategory: Record<string, TransactionItem[]>
  onEditBudget: (id: string, limit: number) => void
  onDeleteBudget: (id: string) => void
  onCategoryChange: (txId: string, category: string, createRule?: boolean) => void
  onAddBudget: () => void
}) {
  return (
    <section id="category-breakdown">
      <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-card-border/50 bg-foreground/[0.02] flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>category</span>
            Category Breakdown
          </h3>
          <Link
            href="/finance/budgets/workshop"
            className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>tune</span>
            Edit All
          </Link>
        </div>
        {budgets.map((b) => (
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
            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
            Add category budget
          </button>
        </div>
      </div>
    </section>
  )
}
