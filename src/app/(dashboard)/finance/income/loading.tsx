import { FinanceCardSkeleton } from "@/components/finance/finance-loading"

export default function FinanceIncomeLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-40 animate-shimmer rounded-lg" />
          <div className="h-3 w-64 animate-shimmer rounded mt-2" />
        </div>
        <div className="h-8 w-8 animate-shimmer rounded-lg" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <FinanceCardSkeleton key={i} />
        ))}
      </div>

      {/* Recurring income table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-4 border-b border-card-border/50">
          <div className="h-4 w-32 animate-shimmer rounded" />
        </div>
        <div className="divide-y divide-card-border/30">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4">
              <div className="w-5 h-5 animate-shimmer rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-shimmer rounded" />
                <div className="h-3 w-44 animate-shimmer rounded" />
              </div>
              <div className="hidden sm:block h-8 w-20 animate-shimmer rounded" />
              <div className="h-8 w-16 animate-shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
