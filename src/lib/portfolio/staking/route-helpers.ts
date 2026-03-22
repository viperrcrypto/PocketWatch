/**
 * Business logic for the staking API route.
 * Builds the full staking response (positions, yields, lifecycle, rewards).
 * Heavy sub-helpers live in route-enrichment.ts.
 */

import { db } from "@/lib/db"
import { type ZerionPosition } from "@/lib/portfolio/zerion-client"
import { getCachedMultiProviderPositions } from "@/lib/portfolio/multi-balance-cache"
import { DEFI_PROTOCOLS, getUnderlyingSymbol } from "@/lib/portfolio/defi-yields"
import { saveStakingSnapshot, getPastPositions } from "@/lib/portfolio/staking-snapshots"
import { getEtherFiVaultBalances } from "@/lib/portfolio/yields/etherfi-vaults"
import { buildPositionKey, getFrozenPositionKeys } from "@/lib/portfolio/staking-lifecycle"
import type { YieldSource } from "@/lib/portfolio/yields"
import { resolvePendleValuations } from "@/lib/portfolio/yields"
import { getHiddenTokenSymbols } from "@/lib/portfolio/hidden-tokens"
import {
  mergeVaultPositions,
  enrichWithYields,
  applyDbApyFallback,
  applyPriceFallback,
  applyPendleValuations,
  runLifecycleSync,
  applyLifecycleMetrics,
  buildCachedClosed,
  splitActiveInactive,
} from "./route-enrichment"

// ─── Types ───

interface DefiMatch {
  protocol: string
  project: string
  type: "deposit" | "staked"
}

export interface EnrichedPosition extends ZerionPosition {
  positionKey: string
  wallet: string
  protocol: string | null
  defiProject: string | null
  underlying: string | null
  apy: number | null
  apyBase: number | null
  apyReward: number | null
  dailyYield: number | null
  annualYield: number | null
  yieldSource: YieldSource | null
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
  vaultRate?: number | null
  pendleMarketAddress?: string | null
  excludeFromYield?: boolean
}

// ─── DeFi token detection ───

function detectDefiToken(symbol: string): DefiMatch | null {
  for (const def of DEFI_PROTOCOLS) {
    if (def.pattern.test(symbol)) {
      return { protocol: def.protocol, project: def.project, type: def.type }
    }
  }
  return null
}

// ─── Empty response factory ───

function emptyResponse(rebuildInProgress: boolean, error?: { code: string; message: string }) {
  return {
    ...(error ? { error: error.code, message: error.message } : {}),
    positions: [], inactivePositions: [], closedPositions: [],
    totalStaked: 0, activePositions: 0,
    totalDailyYield: 0, totalAnnualYield: 0,
    yieldEarnedAllTimeUsd: 0, yieldEarnedYtdUsd: 0, yearlyYield: [],
    confidenceCoverage: { exactPct: 0, modeledPct: 0, estimatedPct: 0 },
    confidenceCounts: { exact: 0, modeled: 0, estimated: 0, total: 0 },
    rewards: [], totalRewardsValue: 0,
    lifecycleStatus: rebuildInProgress ? "recomputing" : "ready",
    rebuildInProgress,
  }
}

// ─── Main response builder ───

export async function buildStakingResponse(userId: string): Promise<object> {
  const startTime = Date.now()

  const [wallets, stakingSyncState] = await Promise.all([
    db.trackedWallet.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { address: true, chains: true },
    }),
    db.stakingSyncState.findUnique({ where: { userId }, select: { status: true } }).catch(() => null),
  ])
  const rebuildInProgress = stakingSyncState?.status === "rebuild_running"

  if (wallets.length === 0) return emptyResponse(rebuildInProgress)

  const walletAddresses = wallets.map((w) => w.address)

  const [{ wallets: walletData }, vaultPositions, pendleValuations] = await Promise.all([
    getCachedMultiProviderPositions(
      userId,
      wallets.map((w) => ({ address: w.address, chains: w.chains })),
    ),
    getEtherFiVaultBalances(walletAddresses),
    resolvePendleValuations(walletAddresses),
  ])

  // Filter hidden tokens before processing
  const hiddenSymbols = await getHiddenTokenSymbols(userId)

  // Collect all positions, reclassifying DeFi wallet-type tokens
  const allPositions: EnrichedPosition[] = []
  for (const w of walletData) {
    for (const p of w.positions) {
      if (hiddenSymbols.has(p.symbol)) continue
      const defi = detectDefiToken(p.symbol)
      if (p.positionType === "wallet" && !defi) continue

      allPositions.push({
        ...p,
        positionKey: buildPositionKey({
          wallet: w.address, chain: p.chain, protocol: defi?.protocol ?? null,
          symbol: p.symbol, contractAddress: p.contractAddress,
        }),
        positionType: defi ? defi.type : p.positionType,
        wallet: w.address,
        protocol: defi?.protocol ?? null,
        defiProject: defi?.project ?? null,
        underlying: getUnderlyingSymbol(p.symbol),
        apy: null, apyBase: null, apyReward: null,
        dailyYield: null, annualYield: null, yieldSource: null,
        pnl: null, pnlPercent: null, maturityDate: null,
      })
    }
  }

  mergeVaultPositions(allPositions, vaultPositions)

  const zerionRewards = allPositions.filter((p) => p.positionType === "reward")
  const stakingPositions = allPositions.filter((p) => p.positionType !== "reward")
  const frozenPositionKeys = await getFrozenPositionKeys(userId)

  const enrichedPositions = await enrichWithYields(stakingPositions, frozenPositionKeys, userId)
  const withDbFallback = await applyDbApyFallback(enrichedPositions, userId)
  const pendleCorrected = applyPendleValuations(withDbFallback, pendleValuations)
  const priceCorrected = await applyPriceFallback(pendleCorrected, userId)

  // Note: stakingPositions (5th arg) is the raw list — only used for Aave chain detection.
  // Lifecycle inputs are built from priceCorrected (post-Pendle values) inside runLifecycleSync.
  const { lifecycle, onChainRewards } = await runLifecycleSync(
    userId, priceCorrected, zerionRewards, frozenPositionKeys,
    stakingPositions, walletAddresses,
  )

  const withLifecycle = applyLifecycleMetrics(priceCorrected, lifecycle, rebuildInProgress)
  const currentPositionKeys = new Set(withLifecycle.map((p) => p.positionKey))
  const cachedClosed = buildCachedClosed(lifecycle.closedRows, currentPositionKeys, rebuildInProgress)
  const { sortedActive, sortedInactive } = splitActiveInactive(withLifecycle, cachedClosed)

  const lifecycleScope = sortedActive.length > 0 ? sortedActive : sortedInactive
  const lifecycleStatus: "ready" | "recomputing" = rebuildInProgress
    || lifecycleScope.some((p) => !!p.yieldMetricsState && p.yieldMetricsState !== "valid" && p.yieldMetricsState !== "clamped")
    ? "recomputing" : "ready"

  const totalStaked = sortedActive.reduce((sum, p) => sum + p.value, 0)
  const yieldActive = sortedActive.filter((p) => !p.excludeFromYield)
  const yieldStaked = yieldActive.reduce((sum, p) => sum + p.value, 0)
  const totalDailyYield = yieldActive.reduce((sum, p) => sum + (p.dailyYield ?? 0), 0)
  const totalAnnualYield = yieldActive.reduce((sum, p) => sum + (p.annualYield ?? 0), 0)

  const zerionRewardValue = zerionRewards.reduce((sum, p) => sum + p.value, 0)
  const onChainRewardValue = onChainRewards.reduce((sum, r) => sum + (r.usdValue ?? 0), 0)
  const totalRewardsValue = zerionRewardValue + onChainRewardValue

  const protocolValues: Record<string, number> = {}
  for (const p of sortedActive) {
    const key = p.protocol ?? p.name.split(" ")[0] ?? "Other"
    protocolValues[key] = (protocolValues[key] || 0) + p.value
  }
  const topProtocol = Object.entries(protocolValues).sort((a, b) => b[1] - a[1])[0]

  const currentKeys = new Set(withLifecycle.map((p) => `${p.symbol}:${p.wallet}`))
  let pastPositions: unknown[] = []
  try { pastPositions = await getPastPositions(userId, currentKeys) }
  catch (err) { console.warn("[staking] Past positions lookup failed:", err) }

  const responseData = {
    positions: sortedActive,
    inactivePositions: sortedInactive,
    closedPositions: sortedInactive.filter((p) => p.status === "closed" || p.cacheState === "frozen"),
    totalStaked,
    activePositions: sortedActive.length,
    topProtocol: topProtocol ? { name: topProtocol[0], value: topProtocol[1] } : null,
    protocolBreakdown: protocolValues,
    totalDailyYield, totalAnnualYield,
    avgApy: yieldStaked > 0 ? (totalAnnualYield / yieldStaked) * 100 : 0,
    yieldEarnedAllTimeUsd: lifecycle.summary.yieldEarnedAllTimeUsd,
    yieldEarnedYtdUsd: lifecycle.summary.yieldEarnedYtdUsd,
    yearlyYield: lifecycle.summary.yearlyYield,
    confidenceCoverage: lifecycle.summary.coverage,
    confidenceCounts: lifecycle.summary.counts,
    rewards: zerionRewards,
    onChainRewards,
    totalRewardsValue,
    pastPositions,
    walletsTotal: walletAddresses.length,
    walletsFetched: walletData.length,
    fetchedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startTime,
    lifecycleStatus,
    rebuildInProgress,
  }

  saveStakingSnapshot(userId, {
    totalStaked, totalDailyYield, totalAnnualYield,
    avgApy: yieldStaked > 0 ? (totalAnnualYield / yieldStaked) * 100 : 0,
    totalRewards: totalRewardsValue,
    positions: sortedActive,
    rewards: [...zerionRewards, ...onChainRewards],
  }).catch((err) => console.warn("[staking] Snapshot save failed:", err))

  return responseData
}
