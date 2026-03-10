export const EVENT_TYPES = [
  { value: "", label: "All Types" },
  { value: "send", label: "Send" },
  { value: "receive", label: "Receive" },
  { value: "trade", label: "Trade" },
  { value: "fee", label: "Fee" },
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "staking", label: "Staking" },
  { value: "airdrop", label: "Airdrop" },
] as const

export const SOURCE_TYPES = [
  { value: "all", label: "All Sources" },
  { value: "onchain", label: "On-Chain" },
  { value: "exchange", label: "Exchange" },
] as const

export const EVENT_BADGE_STYLES: Record<string, { className: string }> = {
  send: { className: "bg-error/10 text-error" },
  receive: { className: "bg-success/10 text-success" },
  trade: { className: "bg-info/10 text-info" },
  fee: { className: "bg-warning/10 text-warning" },
  gas: { className: "bg-warning/10 text-warning" },
  deposit: { className: "bg-success/10 text-success" },
  withdrawal: { className: "bg-error/10 text-error" },
  staking: { className: "bg-info/10 text-info" },
  airdrop: { className: "bg-success/10 text-success" },
}

export const PAGE_SIZE = 25
export const SPAM_BATCH = 5000

export const OUTGOING_TYPES = new Set(["send", "fee", "gas", "withdrawal"])

export type SourceType = "all" | "onchain" | "exchange"

export type AppliedFilters = {
  event_type?: string
  asset?: string
  search?: string
  from_timestamp?: number
  to_timestamp?: number
  source?: SourceType
  exchangeId?: string
  wallet_address?: string
}
