export default function SettingsLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="h-5 w-24 animate-shimmer rounded-lg" />
        <div className="h-4 w-72 animate-shimmer rounded mt-2" />
      </div>

      {/* Search */}
      <div className="h-10 w-full animate-shimmer rounded-xl" />

      {/* Tab bar */}
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-28 animate-shimmer rounded-lg" />
        ))}
      </div>

      {/* Tab content sections */}
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-card border border-card-border rounded-xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="h-4 w-40 animate-shimmer rounded" />
            <div className="h-3 w-full animate-shimmer rounded" />
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 animate-shimmer rounded" />
              <div className="h-7 w-12 animate-shimmer rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
