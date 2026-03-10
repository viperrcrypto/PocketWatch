import Link from "next/link"

export function BudgetUncategorizedBanner({
  uncategorizedCount,
  isPending,
  catResult,
  onAutoCategorize,
}: {
  uncategorizedCount: number
  isPending: boolean
  catResult: { categorized: number; remaining: number } | null
  onAutoCategorize: () => void
}) {
  if (uncategorizedCount <= 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-rounded text-amber-600 dark:text-amber-500" style={{ fontSize: 20 }}>label_off</span>
          <span className="text-sm font-medium text-foreground">
            {uncategorizedCount} uncategorized transaction{uncategorizedCount > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAutoCategorize}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-50"
          >
            {isPending ? "Working..." : "Auto-categorize"}
          </button>
          <Link
            href="/finance/transactions"
            className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            Review
          </Link>
        </div>
      </div>
      {catResult && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 ml-8">
          {catResult.categorized > 0
            ? `Categorized ${catResult.categorized} transaction${catResult.categorized > 1 ? "s" : ""}. ${catResult.remaining > 0 ? `${catResult.remaining} remaining — review them manually.` : "All done!"}`
            : "No matches found with existing rules. Review transactions manually to categorize them."}
        </p>
      )}
    </div>
  )
}
