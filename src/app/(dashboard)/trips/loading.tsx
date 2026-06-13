export default function TripsLoading() {
  return (
    <div className="py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-24 animate-shimmer rounded-lg" />
          <div className="h-3 w-64 animate-shimmer rounded mt-2" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-36 animate-shimmer rounded-lg" />
          <div className="h-9 w-28 animate-shimmer rounded-lg" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-20 animate-shimmer rounded-lg" />
        ))}
      </div>

      {/* Trip cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 animate-shimmer rounded" />
              <div className="h-5 w-12 animate-shimmer rounded-full" />
            </div>
            <div className="h-3 w-40 animate-shimmer rounded" />
            <div className="h-6 w-24 animate-shimmer rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
