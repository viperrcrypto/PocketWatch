/**
 * Per-position sync logic — upserts position row + snapshot + builds metrics.
 * Extracted from sync-coordinator.ts for file size compliance.
 */

import { db } from "@/lib/db"
import {
  buildPositionKey,
  toEpochSeconds,
  isFutureMaturity,
  DUST_USD_THRESHOLD,
  isStableUnderlying,
} from "./constants"
import { pickFlow, isReceiptTokenPosition } from "./flow-reconstruction"
import {
  computeEconomic,
  computeNativeEconomic,
  computeNativeYieldForReceipt,
  confidenceFromFlow,
  resolveYieldMetricsState,
  clampYield,
} from "./economic-math"
import {
  isDustPosition,
  passesFreezeGate,
  shouldReopenFrozenPosition,
  hasPendingRewards,
} from "./freeze-gate"
import type {
  LifecyclePositionInput,
  LifecycleMetrics,
  TxContext,
  StakingDataConfidence,
  StakingPositionStatus,
  StakingCacheState,
  RewardLike,
} from "./types"

// ─── Prisma delegate type ───
type PrismaClient = typeof db & Record<string, any>

export async function applyPositionSync(
  prisma: PrismaClient,
  userId: string,
  position: LifecyclePositionInput,
  existingMap: Map<string, Record<string, unknown>>,
  txContext: TxContext,
  rewards: RewardLike[],
  now: Date,
  snapAt: Date,
  nowIso: string,
  metricsByKey: Map<string, LifecycleMetrics>,
): Promise<void> {
  const positionKey = position.positionKey ?? buildPositionKey(position)
  const existing = existingMap.get(positionKey)

  const flow = pickFlow(position, txContext)
  const hasFlowData = flow.depositedUsd > 0 || flow.withdrawnUsd > 0 || flow.reconstructedTxs > 0

  const effectiveWithdrawnUsd = flow.withdrawnUsd + (
    isDustPosition(position.quantity, position.value)
      ? Math.max(0, flow.rolloverOutUsd - flow.claimedUsd)
      : 0
  )

  const usdEconomic = computeEconomic(
    position.value, flow.depositedUsd, effectiveWithdrawnUsd, flow.claimedUsd,
  )
  let { principalUsd, yieldEarnedUsd, yieldEarnedPct } = usdEconomic

  const underlyingSymbol = position.underlying ?? position.symbol
  if (!isStableUnderlying(underlyingSymbol) && flow.depositedNative > 0) {
    if (isReceiptTokenPosition(position)) {
      const nativeResult = computeNativeYieldForReceipt(
        position.value, flow.depositedUsd, flow.depositedNative, flow.withdrawnNative,
      )
      if (nativeResult) {
        yieldEarnedUsd = nativeResult.yieldEarnedUsd
        yieldEarnedPct = nativeResult.yieldEarnedPct
      }
    } else {
      const nativeResult = computeNativeEconomic(
        position.quantity, flow.depositedNative, flow.withdrawnNative, position.price,
      )
      yieldEarnedUsd = nativeResult.yieldEarnedUsd
      yieldEarnedPct = nativeResult.yieldEarnedPct
    }
  }

  const clamped = clampYield(yieldEarnedUsd, yieldEarnedPct, flow.depositedUsd)
  if (clamped.wasClamped) {
    yieldEarnedUsd = clamped.yieldEarnedUsd
    yieldEarnedPct = clamped.yieldEarnedPct
  }

  const confidence = confidenceFromFlow(position.yieldSource, flow, hasFlowData)
  let yieldMetrics = resolveYieldMetricsState(position.value, flow, yieldEarnedUsd)
  const maturityOpen = isFutureMaturity(position.maturityDate)
  const pendingRewards = hasPendingRewards(position, rewards)

  const dust = isDustPosition(position.quantity, position.value)
  const prevDust = Number(existing?.dustStreak ?? 0)
  const dustStreak = dust ? prevDust + 1 : 0

  let closeCandidateAt: Date | null = (existing?.closeCandidateAt as Date | null) ?? null
  if (dust && !closeCandidateAt) closeCandidateAt = snapAt
  if (!dust) closeCandidateAt = null

  const existingFrozen = !!(existing?.isFrozen)
  let isFrozen = existingFrozen
  let status: StakingPositionStatus = dust ? "closed" : "active"
  let cacheState: StakingCacheState = existingFrozen ? "frozen" : "live"
  let closedAt: Date | null = (existing?.closedAt as Date | null) ?? null
  let frozenAt: Date | null = (existing?.frozenAt as Date | null) ?? null
  let freezeConfidence: StakingDataConfidence | null =
    (existing?.freezeConfidence as StakingDataConfidence | null) ?? null

  const reopenCursor = Number(existing?.reopenCheckCursor ?? 0)
  const canFreeze = passesFreezeGate({
    dust, dustStreak, pendingRewards, maturityOpen,
    confidence: confidence.confidence, latestInTs: flow.latestInTs,
    closeCandidateAt, principalUsd, yieldEarnedUsd,
  })
  const shouldReopen = shouldReopenFrozenPosition(existingFrozen, dust, flow.latestInTs, reopenCursor)

  if (shouldReopen) {
    isFrozen = false; status = "active"; cacheState = "live"
    closedAt = null; frozenAt = null; freezeConfidence = null; closeCandidateAt = null
  } else if (canFreeze) {
    isFrozen = true; status = "closed"; cacheState = "frozen"
    closedAt = flow.latestOutTs > 0
      ? new Date(flow.latestOutTs * 1000)
      : (closedAt ?? closeCandidateAt ?? snapAt)
    frozenAt = frozenAt ?? snapAt
    freezeConfidence = confidence.confidence
  }

  // Set closedAt from flow data for closed positions that don't have it yet
  if (status === "closed" && !closedAt && flow.latestOutTs > 0) {
    closedAt = new Date(flow.latestOutTs * 1000)
  }

  if (status === "closed" && flow.rolloverTxs > 0) {
    if (flow.rolloverInUsd > 0 && flow.rolloverOutUsd === 0) {
      // rolloverIn only — successor position
    } else if (flow.rolloverOutUsd <= DUST_USD_THRESHOLD) {
      yieldMetrics = { state: "recomputing", reason: "Position was rolled — exit value undetermined" }
    }
    // rolloverOutUsd > 0 → exit value is known, let range check below validate
  }

  if (
    status === "closed" && position.value <= DUST_USD_THRESHOLD
    && flow.depositedUsd > DUST_USD_THRESHOLD && flow.withdrawnUsd <= DUST_USD_THRESHOLD
    && flow.rolloverTxs === 0
  ) {
    yieldMetrics = { state: "recomputing", reason: "Closed position has missing exit flow (possible wrap/rollover)" }
  }

  if (
    status === "closed" && position.value <= DUST_USD_THRESHOLD
    && flow.depositedUsd > 50
  ) {
    const pct = flow.depositedUsd > 0 ? (yieldEarnedUsd / flow.depositedUsd) * 100 : 0
    const hasRollover = flow.rolloverInUsd > 0
    const lowerBound = hasRollover ? -5 : -10
    const upperBound = hasRollover ? 15 : 50
    if (pct < lowerBound || pct > upperBound) {
      yieldMetrics = {
        state: "recomputing",
        reason: `Yield ${pct > 0 ? "gain" : "loss"} of ${Math.abs(pct).toFixed(1)}% is outside expected range for staking; flow data likely incomplete`,
      }
    }
  }

  if (
    confidence.confidence === "modeled"
    && confidence.reason.toLowerCase().includes("unmatched reward inflows")
    && yieldMetrics.state === "valid"
    && Math.abs(yieldEarnedUsd) > 0
    && flow.claimedUsd === 0
  ) {
    yieldMetrics = { state: "recomputing", reason: "Reward-claim flow is ambiguous; waiting for reconciliation" }
  }

  const newReopenCursor = isFrozen && !existingFrozen
    ? Math.max(reopenCursor, flow.latestInTs) + 1
    : Math.max(reopenCursor, flow.latestInTs)

  const upsertCreate = {
    userId, positionKey,
    wallet: position.wallet.toLowerCase(),
    chain: position.chain,
    protocol: position.protocol,
    providerSlug: position.defiProject,
    symbol: position.symbol,
    name: position.name,
    contractAddress: position.contractAddress,
    underlying: position.underlying,
    maturityDate: position.maturityDate ? new Date(position.maturityDate) : null,
    openedAt: flow.earliestInTs > 0
      ? new Date(flow.earliestInTs * 1000)
      : (existing?.openedAt as Date | null) ?? now,
    closedAt, status,
    quantity: position.quantity,
    priceUsd: position.price,
    valueUsd: position.value,
    apy: position.apy ?? (existing?.apy as number | null) ?? null,
    apyBase: position.apyBase ?? (existing?.apyBase as number | null) ?? null,
    apyReward: position.apyReward ?? (existing?.apyReward as number | null) ?? null,
    dailyYield: position.dailyYield ?? (existing?.dailyYield as number | null) ?? null,
    annualYield: position.annualYield ?? (existing?.annualYield as number | null) ?? null,
    depositedUsd: flow.depositedUsd,
    withdrawnUsd: effectiveWithdrawnUsd,
    claimedUsd: flow.claimedUsd,
    principalUsd,
    yieldEarnedUsd,
    yieldEarnedPct,
    depositedNative: flow.depositedNative || null,
    withdrawnNative: flow.withdrawnNative || null,
    nativeSymbol: flow.nativeSymbol,
    dataConfidence: confidence.confidence,
    confidenceReason: confidence.reason,
    cacheState, isFrozen, frozenAt, freezeConfidence,
    dustStreak, closeCandidateAt,
    reopenCheckCursor: newReopenCursor,
    lastValidatedAt: now,
    metadata: {
      yieldSource: position.yieldSource,
      noNewInflowAfterCandidate:
        flow.latestInTs <= toEpochSeconds(closeCandidateAt) || toEpochSeconds(closeCandidateAt) === 0,
      pendingRewards, maturityOpen,
      reconstructedTxs: flow.reconstructedTxs,
      rolloverTxs: flow.rolloverTxs,
      rolloverInUsd: flow.rolloverInUsd,
      rolloverOutUsd: flow.rolloverOutUsd,
      rolloverSuccessorSymbol: flow.rolloverSuccessorSymbol,
      rawWithdrawnUsd: effectiveWithdrawnUsd !== flow.withdrawnUsd ? flow.withdrawnUsd : undefined,
      yieldMetricsState: yieldMetrics.state,
      yieldMetricsReason: yieldMetrics.reason,
    },
  }

  await prisma.stakingPosition.upsert({
    where: { userId_positionKey: { userId, positionKey } },
    create: upsertCreate,
    update: upsertCreate,
  })

  const justFroze = !existingFrozen && isFrozen
  const reopened = existingFrozen && !isFrozen
  const shouldSnapshot = !isFrozen || justFroze || reopened

  if (shouldSnapshot) {
    const snapshotData = {
      quantity: position.quantity,
      priceUsd: position.price,
      valueUsd: position.value,
      apyTotal: position.apy,
      apyBase: position.apyBase,
      apyReward: position.apyReward,
      depositedUsdCumulative: flow.depositedUsd,
      withdrawnUsdCumulative: effectiveWithdrawnUsd,
      claimedUsdCumulative: flow.claimedUsd,
      depositedNativeCumulative: flow.depositedNative || null,
      withdrawnNativeCumulative: flow.withdrawnNative || null,
      principalUsd,
      yieldEarnedUsd,
      dailyYieldUsd: position.dailyYield ?? 0,
      dataConfidence: confidence.confidence,
      confidenceReason: confidence.reason,
      sourceMeta: {
        yieldSource: position.yieldSource,
        cacheState,
        yieldMetricsState: yieldMetrics.state,
        ...(position.vaultRate ? { vaultRate: position.vaultRate } : {}),
      },
    }

    await prisma.stakingPositionSnapshot.upsert({
      where: { userId_positionKey_snapshotAt: { userId, positionKey, snapshotAt: snapAt } },
      create: { userId, positionKey, snapshotAt: snapAt, ...snapshotData },
      update: snapshotData,
    })
  }

  const openedAtDate = flow.earliestInTs > 0
    ? new Date(flow.earliestInTs * 1000)
    : (existing?.openedAt as Date | null) ?? now

  metricsByKey.set(positionKey, {
    positionKey, status,
    openedAt: openedAtDate ? new Date(openedAtDate).toISOString() : null,
    closedAt: closedAt ? new Date(closedAt).toISOString() : null,
    dataConfidence: confidence.confidence,
    confidenceReason: confidence.reason,
    depositedUsd: flow.depositedUsd,
    withdrawnUsd: effectiveWithdrawnUsd,
    claimedUsd: flow.claimedUsd,
    principalUsd, yieldEarnedUsd, yieldEarnedPct,
    cacheState, lastValidatedAt: nowIso,
    freezeConfidence, isFrozen,
    yieldMetricsState: yieldMetrics.state,
    yieldMetricsReason: yieldMetrics.reason,
    excludeFromYield: !!(existing?.excludeFromYield),
  })
}
