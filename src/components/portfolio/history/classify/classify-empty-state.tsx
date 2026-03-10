export function ClassifyEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="bg-card border border-card-border rounded-xl py-16 text-center">
      <span className="material-symbols-rounded text-5xl text-foreground-muted block mb-3">
        category
      </span>
      <p className="text-foreground text-base font-semibold mb-2">
        {hasFilters ? "No Matching Transactions" : "No Transactions to Classify"}
      </p>
      <p className="text-sm text-foreground-muted max-w-md mx-auto">
        {hasFilters
          ? "No transactions match the current filters. Try adjusting your search or clearing filters."
          : "Process your transaction history first from the Activity tab, then return here to classify transactions for tax reporting."}
      </p>
    </div>
  )
}
