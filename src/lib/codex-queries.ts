/**
 * Codex SDK query functions — token prices, screener, pairs, holders, wallet data, etc.
 */

import type { Codex } from "@codex-data/sdk"
import type {
  GetPriceInput,
  GetTokenPricesQuery,
  TokenSparklinesQuery,
  FilterTokensQuery,
  FilterTokensQueryVariables,
  GetDetailedPairStatsQuery,
  GetDetailedPairStatsQueryVariables,
  GetTokenEventsQuery,
  GetTokenEventsQueryVariables,
  ListPairsWithMetadataForTokenQuery,
  ListPairsWithMetadataForTokenQueryVariables,
  HoldersQuery,
  HoldersQueryVariables,
  TokenSparklineInput,
  GetTokenBarsQuery,
  GetTokenBarsQueryVariables,
  TokenQuery,
  BalancesQuery,
  DetailedWalletStatsQuery,
  WalletChartQuery,
  GetTokenEventsForMakerQuery,
  GetNetworkStatsQuery,
  LiquidityLocksQuery,
  LiquidityLocksQueryVariables,
  LiquidityMetadataByTokenQuery,
  TokenLifecycleEventsQuery,
  TokenLifecycleEventsQueryVariables,
  TokenTopTradersQuery,
  TokenTopTradersQueryVariables,
  FilterTokenWalletsQuery,
  FilterTokenWalletsQueryVariables,
} from "@codex-data/sdk"
import { getCached, setCache } from "./cache"
import { getCodex } from "./codex-client"

// ─── Token Prices ───

export async function getTokenPrices(
  inputs: GetPriceInput[]
): Promise<NonNullable<GetTokenPricesQuery["getTokenPrices"]>> {
  if (inputs.length === 0) return []

  const cacheKey = `codex:prices:${inputs.map((i) => `${i.address}:${i.networkId}`).join(",")}`
  const cached = getCached<NonNullable<GetTokenPricesQuery["getTokenPrices"]>>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return []

  const result = await codex.queries.getTokenPrices({ inputs })
  const prices = result.getTokenPrices ?? []

  setCache(cacheKey, prices, 30_000) // 30s
  return prices
}

// ─── Token Sparklines ───

export async function getTokenSparklines(
  input: TokenSparklineInput
): Promise<TokenSparklinesQuery["tokenSparklines"]> {
  const cacheKey = `codex:sparklines:${input.ids?.join(",") ?? "none"}`
  const cached = getCached<TokenSparklinesQuery["tokenSparklines"]>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return []

  const result = await codex.queries.tokenSparklines({ input })
  const sparklines = result.tokenSparklines ?? []

  setCache(cacheKey, sparklines, 5 * 60_000) // 5min
  return sparklines
}

// ─── Filter Tokens (Screener) ───

export async function filterTokens(
  vars: FilterTokensQueryVariables
): Promise<FilterTokensQuery["filterTokens"]> {
  const cacheKey = `codex:filter:${JSON.stringify(vars)}`
  const cached = getCached<FilterTokensQuery["filterTokens"]>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return undefined as any

  const result = await codex.queries.filterTokens(vars)

  setCache(cacheKey, result.filterTokens, 2 * 60_000) // 2min
  return result.filterTokens
}

// ─── Pair Stats ───

export async function getDetailedPairStats(
  vars: GetDetailedPairStatsQueryVariables
): Promise<GetDetailedPairStatsQuery["getDetailedPairStats"]> {
  const cacheKey = `codex:pairstats:${vars.pairAddress}:${vars.networkId}`
  const cached = getCached<GetDetailedPairStatsQuery["getDetailedPairStats"]>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return undefined

  const result = await codex.queries.getDetailedPairStats(vars)

  setCache(cacheKey, result.getDetailedPairStats, 60_000) // 1min
  return result.getDetailedPairStats
}

// ─── Token Events (Trades) ───

export async function getTokenEvents(
  vars: GetTokenEventsQueryVariables
): Promise<GetTokenEventsQuery["getTokenEvents"] | undefined> {
  const codex = getCodex()
  if (!codex) return undefined

  const result = await codex.queries.getTokenEvents(vars)
  return result.getTokenEvents
}

// ─── Pairs for Token ───

export async function listPairsWithMetadataForToken(
  vars: ListPairsWithMetadataForTokenQueryVariables
): Promise<ListPairsWithMetadataForTokenQuery["listPairsWithMetadataForToken"] | null> {
  const cacheKey = `codex:pairs:${vars.tokenAddress}:${vars.networkId}`
  const cached = getCached<ListPairsWithMetadataForTokenQuery["listPairsWithMetadataForToken"]>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return null

  const result = await codex.queries.listPairsWithMetadataForToken(vars)

  setCache(cacheKey, result.listPairsWithMetadataForToken, 5 * 60_000) // 5min
  return result.listPairsWithMetadataForToken
}

// ─── Holders ───

export async function getHolders(
  vars: HoldersQueryVariables
): Promise<HoldersQuery["holders"] | null> {
  const cacheKey = `codex:holders:${JSON.stringify(vars)}`
  const cached = getCached<HoldersQuery["holders"]>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return null

  const result = await codex.queries.holders(vars)

  setCache(cacheKey, result.holders, 5 * 60_000) // 5min
  return result.holders
}

// ─── Top 10 Holders Percent ───

export async function getTop10HoldersPercent(
  tokenId: string
): Promise<number | null> {
  const cacheKey = `codex:top10:${tokenId}`
  const cached = getCached<number | null>(cacheKey)
  if (cached !== null) return cached

  const codex = getCodex()
  if (!codex) return null

  const result = await codex.queries.top10HoldersPercent({ tokenId })
  const pct = result.top10HoldersPercent ?? null

  setCache(cacheKey, pct, 5 * 60_000) // 5min
  return pct
}

// ─── Token Bars (OHLCV Chart Data) ───

export async function getTokenBars(
  vars: GetTokenBarsQueryVariables,
  codexOverride?: Codex | null
): Promise<GetTokenBarsQuery["getTokenBars"]> {
  const cacheKey = `codex:bars:${vars.symbol}:${vars.resolution}:${vars.from}:${vars.to}`
  const cached = getCached<GetTokenBarsQuery["getTokenBars"]>(cacheKey)
  if (cached) return cached

  const codex = codexOverride ?? getCodex()
  if (!codex) return undefined

  const result = await codex.queries.getTokenBars(vars)

  // Cache TTL based on resolution: shorter for smaller timeframes
  const ttl = vars.resolution === "1" || vars.resolution === "5" ? 15_000
    : vars.resolution === "15" || vars.resolution === "60" ? 30_000
    : 5 * 60_000
  setCache(cacheKey, result.getTokenBars, ttl)

  return result.getTokenBars
}

// ─── Token Metadata (single token) ───

export async function getCodexToken(
  address: string,
  networkId: number,
  codexOverride?: Codex | null
): Promise<TokenQuery["token"] | null> {
  const cacheKey = `codex:token:${address}:${networkId}`
  const cached = getCached<TokenQuery["token"]>(cacheKey)
  if (cached) return cached

  const codex = codexOverride ?? getCodex()
  if (!codex) return null

  const result = await codex.queries.token({ input: { address, networkId } })
  if (result.token) {
    setCache(cacheKey, result.token, 5 * 60_000) // 5min
  }
  return result.token ?? null
}

// ─── Wallet Balances ───

export async function getCodexBalances(
  walletAddress: string,
  networks?: number[],
  codexOverride?: Codex | null
): Promise<BalancesQuery["balances"] | null> {
  const cacheKey = `codex:balances:${walletAddress}:${networks?.join(",") ?? "all"}`
  const cached = getCached<BalancesQuery["balances"]>(cacheKey)
  if (cached) return cached

  const codex = codexOverride ?? getCodex()
  if (!codex) return null

  const result = await codex.queries.balances({
    input: {
      walletAddress,
      networks,
      includeNative: true,
      removeScams: true,
    },
  })

  setCache(cacheKey, result.balances, 60_000) // 1min
  return result.balances
}

// ─── Detailed Wallet Stats ───

export async function getCodexWalletStats(
  walletAddress: string,
  networkId?: number,
  codexOverride?: Codex | null
): Promise<DetailedWalletStatsQuery["detailedWalletStats"] | null> {
  const cacheKey = `codex:walletstats:${walletAddress}:${networkId ?? "all"}`
  const cached = getCached<DetailedWalletStatsQuery["detailedWalletStats"]>(cacheKey)
  if (cached) return cached

  const codex = codexOverride ?? getCodex()
  if (!codex) return null

  const result = await codex.queries.detailedWalletStats({
    input: {
      walletAddress,
      networkId,
      includeNetworkBreakdown: true,
    },
  })

  if (result.detailedWalletStats) {
    setCache(cacheKey, result.detailedWalletStats, 2 * 60_000) // 2min
  }
  return result.detailedWalletStats ?? null
}

// ─── Wallet Chart (portfolio value over time) ───

export async function getCodexWalletChart(
  walletAddress: string,
  resolution: string,
  range: { start: number; end: number },
  networkId?: number,
  codexOverride?: Codex | null
): Promise<WalletChartQuery["walletChart"] | null> {
  const cacheKey = `codex:walletchart:${walletAddress}:${resolution}:${range.start}:${range.end}`
  const cached = getCached<WalletChartQuery["walletChart"]>(cacheKey)
  if (cached) return cached

  const codex = codexOverride ?? getCodex()
  if (!codex) return null

  const result = await codex.queries.walletChart({
    input: {
      walletAddress,
      resolution,
      range: { start: range.start, end: range.end },
      networkId,
    },
  })

  if (result.walletChart) {
    setCache(cacheKey, result.walletChart, 2 * 60_000) // 2min
  }
  return result.walletChart ?? null
}

// ─── Wallet Events (trades by maker) ───

export async function getCodexWalletEvents(
  maker: string,
  opts?: {
    networkId?: number
    cursor?: string
    limit?: number
    tokenAddress?: string
  },
  codexOverride?: Codex | null
): Promise<GetTokenEventsForMakerQuery["getTokenEventsForMaker"] | null> {
  const codex = codexOverride ?? getCodex()
  if (!codex) return null

  const result = await codex.queries.getTokenEventsForMaker({
    query: {
      maker,
      networkId: opts?.networkId,
      tokenAddress: opts?.tokenAddress,
    },
    cursor: opts?.cursor,
    limit: opts?.limit ?? 50,
  })

  return result.getTokenEventsForMaker ?? null
}

// ─── Liquidity Locks ───

export async function getLiquidityLocks(
  vars: LiquidityLocksQueryVariables
): Promise<LiquidityLocksQuery["liquidityLocks"] | null> {
  const cacheKey = `codex:liqlocks:${vars.tokenAddress ?? vars.pairAddress}:${vars.networkId}`
  const cached = getCached<LiquidityLocksQuery["liquidityLocks"]>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return null

  const result = await codex.queries.liquidityLocks(vars)
  if (result.liquidityLocks) {
    setCache(cacheKey, result.liquidityLocks, 5 * 60_000) // 5min
  }
  return result.liquidityLocks ?? null
}

// ─── Liquidity Metadata by Token ───

export async function getLiquidityMetadataByToken(
  networkId: number,
  tokenAddress: string
): Promise<LiquidityMetadataByTokenQuery["liquidityMetadataByToken"] | null> {
  const cacheKey = `codex:liqmeta:${tokenAddress}:${networkId}`
  const cached = getCached<LiquidityMetadataByTokenQuery["liquidityMetadataByToken"]>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return null

  const result = await codex.queries.liquidityMetadataByToken({ networkId, tokenAddress })
  if (result.liquidityMetadataByToken) {
    setCache(cacheKey, result.liquidityMetadataByToken, 5 * 60_000)
  }
  return result.liquidityMetadataByToken ?? null
}

// ─── Token Lifecycle Events ───

export async function getTokenLifecycleEvents(
  vars: TokenLifecycleEventsQueryVariables
): Promise<TokenLifecycleEventsQuery["tokenLifecycleEvents"] | null> {
  const codex = getCodex()
  if (!codex) return null

  const result = await codex.queries.tokenLifecycleEvents(vars)
  return result.tokenLifecycleEvents ?? null
}

// ─── Token Top Traders ───

export async function getTokenTopTraders(
  vars: TokenTopTradersQueryVariables
): Promise<TokenTopTradersQuery["tokenTopTraders"] | null> {
  const cacheKey = `codex:toptraders:${vars.input.tokenAddress}:${vars.input.networkId}:${vars.input.tradingPeriod}`
  const cached = getCached<TokenTopTradersQuery["tokenTopTraders"]>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return null

  const result = await codex.queries.tokenTopTraders(vars)
  if (result.tokenTopTraders) {
    setCache(cacheKey, result.tokenTopTraders, 5 * 60_000)
  }
  return result.tokenTopTraders ?? null
}

// ─── Filter Token Wallets (Holder Analysis) ───

export async function getFilterTokenWallets(
  vars: FilterTokenWalletsQueryVariables
): Promise<FilterTokenWalletsQuery["filterTokenWallets"] | null> {
  const cacheKey = `codex:filtwallets:${vars.input.tokenId}:${vars.input.networkId}:${vars.input.limit}`
  const cached = getCached<FilterTokenWalletsQuery["filterTokenWallets"]>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return null

  const result = await codex.queries.filterTokenWallets(vars)
  if (result.filterTokenWallets) {
    setCache(cacheKey, result.filterTokenWallets, 5 * 60_000)
  }
  return result.filterTokenWallets ?? null
}

// ─── Network Stats ───

export async function getNetworkStats(
  networkId: number
): Promise<GetNetworkStatsQuery["getNetworkStats"] | null> {
  const cacheKey = `codex:netstats:${networkId}`
  const cached = getCached<GetNetworkStatsQuery["getNetworkStats"]>(cacheKey)
  if (cached) return cached

  const codex = getCodex()
  if (!codex) return null

  const result = await codex.queries.getNetworkStats({ networkId })
  if (result.getNetworkStats) {
    setCache(cacheKey, result.getNetworkStats, 60_000) // 1min
  }
  return result.getNetworkStats ?? null
}
