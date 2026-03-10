import {
  FREEZE_DUST_STREAK,
  DUST_QTY_THRESHOLD,
  DUST_USD_THRESHOLD,
  CONFIDENCE_RANK,
  toEpochSeconds,
} from "./constants"
import type { StakingDataConfidence, LifecyclePositionInput, RewardLike } from "./types"

export function isDustPosition(quantity: number, value: number): boolean {
  // Negative values (debt positions) should never be treated as dust
  if (value < 0) return false
  return Math.abs(quantity) <= DUST_QTY_THRESHOLD || Math.abs(value) <= DUST_USD_THRESHOLD
}

export function passesFreezeGate(input: {
  dust: boolean
  dustStreak: number
  pendingRewards: boolean
  maturityOpen: boolean
  confidence: StakingDataConfidence
  latestInTs: number
  closeCandidateAt: Date | null
  principalUsd: number
  yieldEarnedUsd: number
}): boolean {
  const candidateTs = toEpochSeconds(input.closeCandidateAt)
  const noNewInflowAfterCandidate = input.latestInTs <= candidateTs || candidateTs === 0
  const reconciliationPassed = Number.isFinite(input.principalUsd) && Number.isFinite(input.yieldEarnedUsd)

  return input.dust
    && input.dustStreak >= FREEZE_DUST_STREAK
    && !input.pendingRewards
    && !input.maturityOpen
    && CONFIDENCE_RANK[input.confidence] >= CONFIDENCE_RANK.modeled
    && noNewInflowAfterCandidate
    && reconciliationPassed
}

export function shouldReopenFrozenPosition(
  existingFrozen: boolean,
  dust: boolean,
  latestInTs: number,
  reopenCursor: number,
): boolean {
  if (!existingFrozen) return false
  if (!dust) return true
  return latestInTs > reopenCursor
}

export function hasPendingRewards(
  position: LifecyclePositionInput,
  rewards: RewardLike[],
): boolean {
  if (rewards.length === 0) return false

  const wallet = position.wallet.toLowerCase()
  const symbolSet = new Set([
    position.symbol.toUpperCase(),
    (position.underlying ?? "").toUpperCase(),
  ].filter(Boolean))

  for (const reward of rewards) {
    const usd = reward.usdValue ?? 0
    if (usd <= 0) continue

    const rewardWallet = reward.wallet?.toLowerCase()
    if (rewardWallet && rewardWallet !== wallet) continue
    if (!rewardWallet) continue

    if (reward.symbol && symbolSet.has(reward.symbol.toUpperCase())) return true
    if (position.protocol?.toLowerCase().includes("aave") && reward.source?.includes("aave")) {
      return true
    }
  }

  return false
}
