export const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "trade", label: "Trades" },
]

export const STATUS_BADGE_STYLES: Record<string, string> = {
  ok: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  canceled: "bg-foreground-muted/10 text-foreground-muted",
  failed: "bg-error/10 text-error",
}

export const EXCHANGE_SYNC_STATUS_STYLES: Record<string, string> = {
  synced: "bg-success/10 text-success",
  syncing: "bg-info/10 text-info",
  error: "bg-error/10 text-error",
  unsupported: "bg-warning/10 text-warning",
  idle: "bg-foreground-muted/10 text-foreground-muted",
}

export function formatTimestamp(ms: number): string {
  const date = new Date(ms)
  if (isNaN(date.getTime())) return "--"
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}
