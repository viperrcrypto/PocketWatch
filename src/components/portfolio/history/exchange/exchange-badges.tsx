import { STATUS_BADGE_STYLES, EXCHANGE_SYNC_STATUS_STYLES } from "./exchange-constants"

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const className = STATUS_BADGE_STYLES[normalized] ?? "bg-foreground-muted/10 text-foreground-muted"
  return (
    <span className={`inline-block px-2 py-0.5 rounded font-data text-[10px] font-semibold tracking-wide uppercase ${className}`}>
      {normalized}
    </span>
  )
}

export function TypeBadge({ type, side }: { type: "deposit" | "withdrawal" | "trade"; side?: "buy" | "sell" | null }) {
  if (type === "trade") {
    return (
      <span className="inline-block px-2 py-0.5 rounded font-data text-[10px] font-semibold tracking-wide uppercase bg-info/10 text-info">
        {side ? `trade ${side}` : "trade"}
      </span>
    )
  }
  const isDeposit = type === "deposit"
  return (
    <span className={`inline-block px-2 py-0.5 rounded font-data text-[10px] font-semibold tracking-wide uppercase ${
      isDeposit ? "bg-success/10 text-success" : "bg-error/10 text-error"
    }`}>
      {type}
    </span>
  )
}

export function ExchangeSyncBadge({ status }: { status?: string }) {
  const normalized = (status ?? "idle").toLowerCase()
  const className = EXCHANGE_SYNC_STATUS_STYLES[normalized] ?? EXCHANGE_SYNC_STATUS_STYLES.idle
  return (
    <span className={`inline-block px-2 py-0.5 rounded font-data text-[10px] font-semibold tracking-wide uppercase ${className}`}>
      {normalized}
    </span>
  )
}
