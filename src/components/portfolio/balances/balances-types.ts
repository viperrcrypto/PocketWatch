export interface BalanceRow {
  asset: string
  displayName: string
  chain: string
  wallet: string      // full address
  walletLabel: string  // label if available, otherwise shortened address
  amount: number
  usd_value: number
  pctOfTotal: number
}

export interface AssetGroup {
  displayName: string
  asset: string       // representative asset id (for icon)
  chain: string       // representative chain (for icon)
  totalAmount: number
  totalValue: number
  pctOfTotal: number
  rows: BalanceRow[]  // child rows (per wallet/chain)
}
