export interface ExchangeTransaction {
  id: string
  txid: string | null
  timestamp: number
  type: "deposit" | "withdrawal" | "trade"
  side?: "buy" | "sell" | null
  amount: number
  currency: string
  status: string
  address: string | null
  fee: number
  network: string | null
  exchange: string
  exchangeLabel: string
}

export interface ExchangeCapability {
  id: string
  label: string
  supportsDeposits: boolean
  supportsWithdrawals: boolean
  supportsTrades?: boolean
  error?: string
  syncStatus?: "idle" | "syncing" | "synced" | "error" | "unsupported"
  lastSyncedAt?: string | null
}
