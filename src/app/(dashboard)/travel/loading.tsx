export default function TravelLoading() {
  return (
    <div className="py-6 space-y-6">
      {/* Flight search form */}
      <div className="card p-5 space-y-4">
        <div className="h-5 w-40 animate-shimmer rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 animate-shimmer rounded" />
              <div className="h-10 w-full animate-shimmer rounded-lg" />
            </div>
          ))}
        </div>
        <div className="h-10 w-32 animate-shimmer rounded-lg" />
      </div>

      {/* Empty-state placeholder */}
      <div className="card p-12 flex flex-col items-center gap-3">
        <div className="w-12 h-12 animate-shimmer rounded-full" />
        <div className="h-4 w-80 max-w-full animate-shimmer rounded" />
        <div className="h-3 w-56 max-w-full animate-shimmer rounded" />
      </div>

      {/* Saved routes panel */}
      <div className="max-w-md mx-auto card p-4 space-y-3">
        <div className="h-4 w-32 animate-shimmer rounded" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 w-full animate-shimmer rounded-lg" />
        ))}
      </div>
    </div>
  )
}
