export default function NetWorthLoading() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-36 animate-shimmer rounded-lg" />
          <div className="h-3 w-52 animate-shimmer rounded mt-2" />
        </div>
        <div className="h-8 w-8 animate-shimmer rounded-lg" />
      </div>

      {/* Hero card */}
      <div className="mt-6 mb-8 bg-card border border-card-border rounded-xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="h-3 w-28 animate-shimmer rounded" />
        <div className="h-9 w-44 animate-shimmer rounded-lg" />
        <div className="h-[260px] animate-shimmer rounded-lg" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 animate-shimmer rounded" />
              <div className="h-4 w-20 animate-shimmer rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <div className="h-3 w-24 animate-shimmer rounded mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[68px] animate-shimmer rounded-xl" />
        ))}
      </div>

      {/* Source cards */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-card rounded-xl p-5 flex items-center gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="w-6 h-6 animate-shimmer rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 animate-shimmer rounded" />
              <div className="h-3 w-40 animate-shimmer rounded" />
            </div>
            <div className="h-5 w-20 animate-shimmer rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
