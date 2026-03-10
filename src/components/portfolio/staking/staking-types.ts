// ─── Staking Types ───

export interface StakingPosition {
  id: string
  positionKey: string
  symbol: string
  name: string
  chain: string
  quantity: number
  price: number
  value: number
  iconUrl: string | null
  positionType: string
  contractAddress: string | null
  wallet: string
  protocol: string | null
  defiProject: string | null
  underlying: string | null
  apy: number | null
  apyBase: number | null
  apyReward: number | null
  dailyYield: number | null
  annualYield: number | null
  yieldSource: "on-chain" | "pendle-api" | "defillama" | null
  pnl: number | null
  pnlPercent: number | null
  maturityDate: string | null
  status?: "active" | "closed"
  openedAt?: string | null
  closedAt?: string | null
  dataConfidence?: "exact" | "modeled" | "estimated"
  confidenceReason?: string
  depositedUsd?: number
  withdrawnUsd?: number
  claimedUsd?: number
  principalUsd?: number
  yieldEarnedUsd?: number
  yieldEarnedPct?: number | null
  cacheState?: "live" | "frozen"
  lastValidatedAt?: string
  freezeConfidence?: "exact" | "modeled" | "estimated" | null
  isFrozen?: boolean
  yieldMetricsState?: "valid" | "recomputing" | "insufficient_history" | "clamped"
  yieldMetricsReason?: string | null
  excludeFromYield?: boolean
}

export interface OnChainReward {
  wallet?: string | null
  chainId: number
  rewardToken: string
  symbol: string
  decimals: number
  amount: number
  amountRaw: string
  usdValue: number | null
  source: string
}
