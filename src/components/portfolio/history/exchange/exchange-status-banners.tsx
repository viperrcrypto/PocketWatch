import type { ExchangeCapability } from "./exchange-types"
import { ExchangeSyncBadge } from "./exchange-badges"

export function UnsupportedExchangeBanners({ exchanges }: { exchanges: ExchangeCapability[] }) {
  if (exchanges.length === 0) return null
  return (
    <>
      {exchanges.map((c) => (
        <div key={c.id} className="bg-card border border-info/25 px-4 py-3 mb-3 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-info text-sm">info</span>
            <span className="text-info text-xs">
              {c.label} does not support deposits, withdrawals, or trades via API
            </span>
          </div>
        </div>
      ))}
    </>
  )
}

export function ErroredExchangeBanners({ exchanges }: { exchanges: ExchangeCapability[] }) {
  if (exchanges.length === 0) return null
  return (
    <>
      {exchanges.map((c) => (
        <div key={c.id} className="bg-card border border-error/25 px-4 py-3 mb-3 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-error text-sm">warning</span>
            <span className="text-error text-xs">
              {c.label}: {c.error}
            </span>
          </div>
        </div>
      ))}
    </>
  )
}

export function ExchangeSyncStatusBar({ capabilities }: { capabilities: ExchangeCapability[] }) {
  if (capabilities.length === 0) return null
  return (
    <div className="bg-card border border-card-border px-4 py-3 mb-4 rounded-xl">
      <p className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2">EXCHANGE SYNC STATUS</p>
      <div className="flex flex-wrap gap-2">
        {capabilities.map((cap) => (
          <div key={cap.id} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-background border border-card-border">
            <span className="text-xs text-foreground">{cap.label}</span>
            <ExchangeSyncBadge status={cap.syncStatus} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ExchangeErrorBanner({ error }: { error: Error | null }) {
  if (!error) return null
  return (
    <div className="bg-card border border-error/30 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl">
      <span className="material-symbols-rounded text-error text-lg">error</span>
      <p className="text-sm text-error">
        {error.message ?? "Failed to load exchange history"}
      </p>
    </div>
  )
}

export function ExchangeRefreshBanner({
  isSuccess,
  isError,
  error,
  transactionCount,
}: {
  isSuccess: boolean
  isError: boolean
  error: Error | null
  transactionCount: number
}) {
  return (
    <>
      {isSuccess && (
        <div className="bg-card border border-success/30 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl">
          <span className="material-symbols-rounded text-success text-lg">check_circle</span>
          <p className="text-sm text-success">
            Exchange history refreshed ({transactionCount} transaction{transactionCount !== 1 ? "s" : ""})
          </p>
        </div>
      )}
      {isError && error && (
        <div className="bg-card border border-error/30 px-4 py-3 mb-4 flex items-center gap-3 rounded-xl">
          <span className="material-symbols-rounded text-error text-lg">warning</span>
          <p className="text-sm text-error">
            Failed to refresh exchange history: {error.message ?? "Unknown refresh error"}
          </p>
        </div>
      )}
    </>
  )
}
