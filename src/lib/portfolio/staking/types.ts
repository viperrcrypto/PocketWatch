import type { YieldSource } from "../yields"

// ─── Enums / Brands ───

export type StakingDataConfidence = "exact" | "modeled" | "estimated"
export type StakingPositionStatus = "active" | "closed"
export type StakingCacheState = "live" | "frozen"
export type YieldMetricsState = "valid" | "recomputing" | "insufficient_history" | "clamped"

// ─── Position input (what the API route passes in) ───

export interface LifecyclePositionInput {
  positionKey?: string
  wallet: string
  chain: string
  symbol: string
  name: string
  protocol: string | null
  defiProject: string | null
  underlying: string | null
  contractAddress: string | null
  quantity: number
  price: number
  value: number
  apy: number | null
  apyBase: number | null
  apyReward: number | null
  annualYield: number | null
  dailyYield: number | null
  maturityDate: string | null
  yieldSource: YieldSource | null
  /** ERC-4626 vault rate for EtherFi snapshot tracking */
  vaultRate?: number | null
}

// ─── Reward descriptor ───

export interface RewardLike {
  wallet?: string | null
  symbol?: string | null
  usdValue?: number | null
  source?: string | null
}

// ─── Lifecycle output ───

export interface LifecycleMetrics {
  positionKey: string
  status: StakingPositionStatus
  openedAt: string | null
  closedAt: string | null
  dataConfidence: StakingDataConfidence
  confidenceReason: string
  depositedUsd: number
  withdrawnUsd: number
  claimedUsd: number
  principalUsd: number
  yieldEarnedUsd: number
  yieldEarnedPct: number | null
  cacheState: StakingCacheState
  lastValidatedAt: string
  freezeConfidence: StakingDataConfidence | null
  isFrozen: boolean
  yieldMetricsState: YieldMetricsState
  yieldMetricsReason: string | null
  excludeFromYield: boolean
}

export interface LifecyclePositionRecord extends LifecycleMetrics {
  wallet: string
  chain: string
  symbol: string
  name: string
  protocol: string | null
  providerSlug: string | null
  contractAddress: string | null
  underlying: string | null
  quantity: number
  price: number
  value: number
  apy: number | null
  apyBase: number | null
  apyReward: number | null
  dailyYield: number | null
  annualYield: number | null
}

export interface LifecycleSyncSummary {
  yieldEarnedAllTimeUsd: number
  yieldEarnedYtdUsd: number
  yearlyYield: Array<{ year: number; earnedUsd: number }>
  coverage: {
    exactPct: number
    modeledPct: number
    estimatedPct: number
  }
  counts: {
    exact: number
    modeled: number
    estimated: number
    total: number
  }
}

export interface LifecycleSyncResult {
  metricsByKey: Map<string, LifecycleMetrics>
  closedRows: LifecyclePositionRecord[]
  summary: LifecycleSyncSummary
}

export interface StakingHistoryOptions {
  year?: number
  range?: "ytd" | "year" | "all"
  positionKey?: string
  protocol?: string
}

// ─── Transaction context types ───

export interface TxAggregate {
  readonly inUsd: number
  readonly outUsd: number
  readonly latestInTs: number
  readonly latestOutTs: number
}

export interface TxContext {
  byTx: Map<string, TxLedgerEntry>
  byWalletChain: Map<string, TxLedgerEntry[]>
  byAsset: Map<string, TxAggregate>
  bySymbol: Map<string, TxAggregate>
  ownWallets: Set<string>
}

export interface TxLeg {
  asset: string | null
  symbol: string | null
  direction: "in" | "out"
  usd: number
  quantity: number
  blockTimestamp: number
  from: string | null
  to: string | null
  category: string | null
}

export interface TxLedgerEntry {
  wallet: string
  chain: string
  txHash: string
  legs: TxLeg[]
}

export interface FlowTotals {
  depositedUsd: number
  withdrawnUsd: number
  claimedUsd: number
  depositedNative: number
  withdrawnNative: number
  nativeSymbol: string | null
  earliestInTs: number
  latestInTs: number
  latestOutTs: number
  confidence: StakingDataConfidence
  confidenceReason: string
  reconstructedTxs: number
  rolloverTxs: number
  rolloverInUsd: number
  rolloverOutUsd: number
  rolloverSuccessorSymbol: string | null
  rolloverInTransfers?: RolloverTransfer[]
  rolloverOutTransfers?: RolloverTransfer[]
}

export interface RolloverTransfer {
  txHash: string
  blockTimestamp: number
  usd: number
  asset: string | null
  symbol: string | null
}

export interface FlowLedgerLegInput {
  asset?: string | null
  symbol?: string | null
  direction: "in" | "out"
  usd: number
  quantity?: number
  blockTimestamp?: number
  from?: string | null
  to?: string | null
  category?: string | null
}

export interface FlowLedgerEntryInput {
  wallet: string
  chain: string
  txHash: string
  legs: FlowLedgerLegInput[]
}
