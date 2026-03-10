// TypeScript interfaces for the Wallet Tracker feature.

export type TrackerChain = "ETHEREUM" | "ARBITRUM" | "BASE" | "POLYGON" | "BSC" | "OPTIMISM" | "LINEA" | "SCROLL" | "ZKSYNC" | "SOLANA"

export type TransactionType = "BUY" | "SELL" | "TRANSFER_IN" | "TRANSFER_OUT" | "SWAP" | "APPROVE" | "BRIDGE" | "UNKNOWN"

export type AlertPriority = "normal" | "high" | "urgent"

export interface TrackerTransaction {
  id: string
  txHash: string
  type: TransactionType
  chain: TrackerChain
  blockTimestamp: string // ISO 8601
  walletId?: string
  walletAddress?: string
  walletLabel?: string
  // Populated from feed API join
  wallet?: { id: string; label?: string | null; emoji?: string | null; address?: string | null; chain?: string | null }

  // Token info
  tokenAddress?: string
  tokenSymbol?: string
  tokenName?: string
  tokenDecimals?: number

  // Amounts
  amountFormatted?: number
  valueUsd?: number

  // Swap specifics
  tokenInAddress?: string
  tokenInSymbol?: string
  tokenInAmount?: number
  tokenOutAddress?: string
  tokenOutSymbol?: string
  tokenOutAmount?: number

  // Market context
  priceUsd?: number
  marketCap?: number
  fdv?: number
  pairAddress?: string

  // Counterparty
  fromAddress?: string
  toAddress?: string
  dexName?: string

  // Position context — what this transaction means for the wallet's position
  positionContext?: "FRESH_BUY" | "ADDING" | "RE_ENTRY" | "PARTIAL_SELL" | "FULL_EXIT" | "TAKING_PROFIT" | "STOP_LOSS"

  // Both-side USD values for swaps
  tokenInValueUsd?: number
  tokenOutValueUsd?: number

  // Market depth context
  liquidityUsd?: number
  volume24h?: number

  // Token freshness
  tokenAge?: string

  // Holder count
  holders?: number

  // Alert priority — set when tx matches a high/urgent alert rule
  alertPriority?: AlertPriority
  matchedRuleLabel?: string

  // Token metadata from cache (logos, socials, etc.)
  tokenMeta?: {
    logoUrl?: string | null
    headerUrl?: string | null
    name?: string | null
    websiteUrl?: string | null
    twitterUrl?: string | null
    telegramUrl?: string | null
    description?: string | null
  } | null

  // Position stats (computed from transaction history)
  positionStats?: {
    totalBoughtAmount: number    // total tokens bought
    totalBoughtUsd: number       // total USD spent buying
    totalSoldAmount: number      // total tokens sold
    totalSoldUsd: number         // total USD received selling
    holdingAmount: number        // current tokens held (bought - sold)
    holdingValueUsd: number      // current value of holdings
    avgBuyPrice: number          // average buy price
    realizedPnl: number          // realized profit/loss in USD
    realizedPnlPct: number       // realized PnL as percentage
    unrealizedPnl: number        // unrealized PnL in USD
    unrealizedPnlPct: number     // unrealized PnL as percentage
    soldPct: number              // % of total bought that was sold (0-100)
    holdingPct: number | null    // % of token supply held (null if no supply data)
    buyCount: number             // number of buy transactions for this wallet+token
    sellCount: number            // number of sell transactions for this wallet+token
  } | null
}

export interface TrackerWalletData {
  id: string
  address: string
  label?: string
  emoji?: string
  chain: TrackerChain
  isActive: boolean
  lastScannedAt?: string
  createdAt: string
  // Summary stats
  txCount?: number
  lastTxAt?: string
  pnl24h?: number
  pnlTotal?: number
}

export interface TrackerAnalytics {
  totalPnl: number
  realizedPnl: number
  unrealizedPnl: number
  winRate: number // 0-100
  totalTrades: number
  winningTrades: number
  avgHoldTimeSeconds: number
  bestTrade?: TradeEntry
  worstTrade?: TradeEntry
  portfolioHistory: { time: number; value: number }[]
  tokenHoldings: TokenHolding[]
}

export interface TradeEntry {
  tokenSymbol: string
  tokenAddress: string
  chain: TrackerChain
  pnl: number
  pnlPercent: number
  date: string
}

export interface TokenHolding {
  tokenAddress: string
  tokenSymbol: string
  tokenName?: string
  chain: TrackerChain
  amount: number
  valueUsd: number
  pnl: number
  portfolioPercent: number
}

export interface TrackerApiKeyData {
  service: string
  label: string
  isConfigured: boolean
  isValid: boolean
  maskedKey?: string
  lastUsedAt?: string
}

export interface TelegramLinkStatus {
  isLinked: boolean
  username?: string
  firstName?: string
  linkedAt?: string
  isActive?: boolean
}

export interface AlertRule {
  id: string
  label?: string
  alertType: string
  walletAddress?: string
  chain?: string
  minValueUsd?: number
  enabled: boolean
  priority: AlertPriority
}

// Chain configuration
export interface ChainConfig {
  id: TrackerChain
  name: string
  shortName: string
  nativeToken: string
  nativeDecimals: number
  explorerUrl: string
  explorerApiUrl: string
  apiKeyService: string // Matches TrackerApiKey.service
  iconName: string // Material Symbols icon
  color: string
  /** If set, the explorer API works without a key at a slower rate */
  freeApiTier?: {
    ratePerSecond: number   // e.g. 0.2 = 1 req per 5 seconds
    signupUrl: string       // direct link to get a free API key
    signupLabel: string     // e.g. "BscScan"
  }
}

// Scanner types
export interface ScanResult {
  transactions: NewTransaction[]
  lastBlock?: bigint
  lastSignature?: string
}

export interface NewTransaction {
  txHash: string
  chain: TrackerChain
  type: TransactionType
  blockNumber?: bigint
  blockTimestamp: Date
  tokenAddress?: string
  tokenSymbol?: string
  tokenName?: string
  tokenDecimals?: number
  amountRaw?: string
  amountFormatted?: number
  valueUsd?: number
  tokenInAddress?: string
  tokenInSymbol?: string
  tokenInAmount?: number
  tokenOutAddress?: string
  tokenOutSymbol?: string
  tokenOutAmount?: number
  priceUsd?: number
  marketCap?: number
  fdv?: number
  pairAddress?: string
  fromAddress?: string
  toAddress?: string
  dexName?: string
}
