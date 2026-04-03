import { formatCurrency } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface SpendingCategory {
  category: string
  avgMonthly: number
  lastMonth: number
  suggested: number
  monthsOfData: number
}

export function BudgetSpendingTable({
  categories,
  monthsAnalyzed,
  totalAvgSpending,
}: {
  categories: SpendingCategory[]
  monthsAnalyzed: number
  totalAvgSpending: number
}) {
  if (categories.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-8 text-center">
        <span className="material-symbols-rounded text-foreground-muted mb-2 block" style={{ fontSize: 32 }}>receipt_long</span>
        <p className="text-sm text-foreground-muted">No spending data yet. Connect accounts to see your profile.</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-card-border/50 bg-foreground/[0.02] flex justify-between items-center">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>receipt_long</span>
          Spending Analysis
        </h3>
        <span className="text-[10px] font-bold text-foreground-muted bg-background-secondary px-2.5 py-1 rounded-full uppercase tracking-wider">
          {monthsAnalyzed}-mo avg
        </span>
      </div>
      <div className="overflow-y-auto max-h-[500px]">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-card border-b border-card-border/30 z-10">
            <tr>
              <th className="px-5 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Category</th>
              <th className="px-5 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest text-right">Avg Monthly</th>
              <th className="px-5 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest text-right">Suggested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/20">
            {categories.map((cat) => {
              const meta = getCategoryMeta(cat.category)
              return (
                <tr key={cat.category} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 18, color: meta.hex }}>{meta.icon}</span>
                      <div>
                        <div className="text-xs font-semibold text-foreground">{cat.category}</div>
                        <div className="text-[10px] text-foreground-muted">
                          {totalAvgSpending > 0 ? `${Math.round((cat.avgMonthly / totalAvgSpending) * 100)}% of spending` : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs font-black font-data tabular-nums text-foreground">
                      {formatCurrency(cat.avgMonthly, "USD", 0)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs font-bold font-data tabular-nums text-primary">
                      {formatCurrency(cat.suggested, "USD", 0)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
