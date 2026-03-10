import type { StakingPosition } from "./staking-types"

// ─── APY source indicator ───

export function ApySourceBadge({ source }: { source: string | null }) {
  if (source === "on-chain" || source === "pendle-api") {
    return (
      <span className="text-[9px] font-medium text-success bg-success/10 px-1 py-0.5 rounded">
        Live
      </span>
    )
  }
  if (source === "defillama") {
    return (
      <span className="text-[9px] font-medium text-foreground-muted bg-background-secondary px-1 py-0.5 rounded">
        Est
      </span>
    )
  }
  return null
}

export function ConfidenceBadge({ confidence }: { confidence: StakingPosition["dataConfidence"] }) {
  if (!confidence) return null
  if (confidence === "exact") {
    return (
      <span className="text-[9px] font-medium text-success bg-success/10 px-1 py-0.5 rounded">
        Exact
      </span>
    )
  }
  if (confidence === "modeled") {
    return (
      <span className="text-[9px] font-medium text-info bg-info/10 px-1 py-0.5 rounded">
        Modeled
      </span>
    )
  }
  return (
    <span className="text-[9px] font-medium text-warning bg-warning/10 px-1 py-0.5 rounded">
      Estimated
    </span>
  )
}

export function MaturityBadge({ date }: { date: string }) {
  const expiry = new Date(date)
  const now = new Date()
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) {
    return (
      <span className="text-[9px] font-medium text-error bg-error/10 px-1 py-0.5 rounded">
        Expired
      </span>
    )
  }

  return (
    <span className="text-[9px] font-medium text-foreground-muted bg-background-secondary px-1 py-0.5 rounded">
      {daysLeft}d left
    </span>
  )
}

export function FreshnessIndicator({ fetchedAt }: { fetchedAt: string | null }) {
  if (!fetchedAt) return null

  const seconds = Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 1000)

  let label: string
  if (seconds < 60) {
    label = `${seconds}s ago`
  } else if (seconds < 3600) {
    label = `${Math.floor(seconds / 60)}m ago`
  } else {
    label = `${Math.floor(seconds / 3600)}h ago`
  }

  return (
    <span className="text-[10px] text-foreground-muted font-data tabular-nums">
      Updated {label}
    </span>
  )
}

// ─── Helpers ───

export function getSortableValue(position: StakingPosition, key: string): number {
  switch (key) {
    case "value": return position.value
    case "quantity": return position.quantity
    case "price": return position.price
    case "apy": return position.apy ?? 0
    case "dailyYield": return position.dailyYield ?? 0
    case "annualYield": return position.annualYield ?? 0
    case "yieldEarnedUsd": return position.yieldEarnedUsd ?? 0
    case "pnl": return position.pnl ?? 0
    case "principalUsd": return position.principalUsd ?? 0
    case "depositedUsd": return position.depositedUsd ?? 0
    default: return 0
  }
}

export function metricStatusLabel(position: Pick<StakingPosition, "yieldMetricsState" | "yieldMetricsReason">): string {
  if (!position.yieldMetricsState || position.yieldMetricsState === "valid") return ""
  const reason = (position.yieldMetricsReason ?? "").toLowerCase()
  if (reason.includes("rolled into another receipt token")) return "Rolled"
  if (position.yieldMetricsState === "insufficient_history") return "Syncing"
  if (reason.includes("rebuild")) return "Syncing"
  return "Unavailable"
}

export function isApproximateEarned(
  position: Pick<StakingPosition, "yieldMetricsState" | "yieldEarnedUsd" | "depositedUsd">,
): boolean {
  if (
    !position.yieldMetricsState
    || position.yieldMetricsState === "valid"
    || position.yieldMetricsState === "clamped"
  ) return false
  return (
    position.yieldEarnedUsd !== undefined
    && position.yieldEarnedUsd !== null
    && Number.isFinite(position.yieldEarnedUsd)
    && position.yieldEarnedUsd !== 0
    && (position.depositedUsd ?? 0) > 0
  )
}

export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return "\u2014"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
