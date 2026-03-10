export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-card border border-card-border" />
          <div className="h-4 w-72 bg-card border border-card-border mt-2" />
        </div>
        <div className="h-9 w-28 bg-card border border-card-border" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 bg-card border border-card-border rounded-xl">
            <div className="h-3 w-20 bg-card-border mb-3" />
            <div className="h-6 w-16 bg-card-border" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="p-6 bg-card border border-card-border rounded-xl space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-10 h-10 bg-card-border flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-card-border w-3/4" />
              <div className="h-3 bg-card-elevated w-1/2" />
            </div>
            <div className="h-4 w-16 bg-card-border" />
          </div>
        ))}
      </div>
    </div>
  )
}
