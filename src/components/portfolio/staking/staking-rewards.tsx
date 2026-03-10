"use client"

import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { CollapsibleSection } from "@/components/ui/collapsible-section"
import { formatFiatValue, formatCryptoAmount } from "@/lib/portfolio/utils"
import type { StakingPosition, OnChainReward } from "./staking-types"

export function ZerionRewardsSection({ rewards }: { rewards: readonly StakingPosition[] }) {
  if (rewards.length === 0) return null

  return (
    <CollapsibleSection
      title="Claimable Rewards"
      icon="redeem"
      badge={rewards.length}
      className="rounded-xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
        {rewards.map((reward) => (
          <div
            key={reward.id}
            className="flex items-center gap-3 p-3 bg-background-secondary rounded-lg"
          >
            <PortfolioAssetIcon
              asset={reward.symbol}
              chain={reward.chain}
              iconUrl={reward.iconUrl}
              size={28}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {reward.symbol}
              </p>
              <p className="text-xs text-foreground-muted">
                {formatCryptoAmount(reward.quantity)}
              </p>
            </div>
            <span className="text-sm font-data text-foreground tabular-nums">
              {formatFiatValue(reward.value)}
            </span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
}

export function AaveRewardsSection({ rewards }: { rewards: readonly OnChainReward[] }) {
  if (rewards.length === 0) return null

  return (
    <CollapsibleSection
      title="Aave Incentive Rewards"
      icon="stars"
      badge={rewards.length}
      className="rounded-xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
        {rewards.map((reward, i) => (
          <div
            key={`${reward.rewardToken}-${i}`}
            className="flex items-center gap-3 p-3 bg-background-secondary rounded-lg"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <span className="material-symbols-rounded text-sm text-purple-400" style={{ fontSize: 14 }}>
                toll
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {reward.symbol}
              </p>
              <p className="text-xs text-foreground-muted">
                {reward.amount.toFixed(4)} tokens
              </p>
            </div>
            <span className="text-sm font-data text-foreground tabular-nums">
              {reward.usdValue !== null ? formatFiatValue(reward.usdValue) : "\u2014"}
            </span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
}
