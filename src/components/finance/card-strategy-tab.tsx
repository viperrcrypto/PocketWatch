"use client"

import { cn, formatCurrency } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { WalletStrategyGrid } from "@/components/finance/wallet-strategy-grid"
import { PerksTracker } from "@/components/finance/perks-tracker"
import { PointsPortfolio } from "@/components/finance/points-portfolio"
import { StrategyCardChat } from "@/components/finance/cards/strategy-card-chat"
import { BonusTrackerSection } from "@/components/finance/bonus-tracker"

interface WalletStrategyItem {
  category: string
  cardName: string
  rewardRate: number
  rewardUnit: string
  monthlySpend?: number
  monthlyReward?: number
  actualReward?: number
  gap?: number
}

interface PointsProgramItem {
  programName: string
  balance: number
  centsPerPoint: number
  totalValue: number
  estimatedMonthlyReward: number
  rewardType: string
  cardNames: string[]
  cardImageUrls: string[]
}

interface CardPerkItem {
  id: string
  perkName: string
  perkValue: number | null
  perkType: "limited" | "unlimited"
  period: "monthly" | "quarterly" | "annual" | "one_time"
  maxValue: number
  usedValue: number
  daysRemaining: number | null
  percentUsed: number
  periodEnd: string | null
  periodLabel: string
  annualizedValue: number
  isUsed: boolean
}

interface CardPerksGroup {
  cardId: string
  cardName: string
  annualFee: number
  cardImageUrl?: string | null
  issuer?: string
  perks: CardPerkItem[]
}

interface Recommendation {
  category: string
  bestCard: string
  bestRate: number
  monthlySpend?: number
  monthlyReward?: number
}

interface CardStrategyTabProps {
  strategy: {
    totalOptimalRewards: number
    totalActualRewards: number
    gapAmount: number
  } | null
  walletStrategy: WalletStrategyItem[]
  cardPerksData: CardPerksGroup[]
  pointsPrograms: PointsProgramItem[]
  pointsTotalValue: number
  pointsMonthlyReward: number
  recommendations: Recommendation[]
  onTogglePerk: (cardId: string, perkId: string, data: { addAmount?: number; setUsedValue?: number; isUsed?: boolean }) => void
}

export function CardStrategyTab({
  strategy, walletStrategy, cardPerksData,
  pointsPrograms, pointsTotalValue, pointsMonthlyReward,
  recommendations, onTogglePerk,
}: CardStrategyTabProps) {
  return (
    <>
      {/* Strategy Summary Stats */}
      {strategy && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Optimal Rewards</p>
            <p className="font-data text-xl font-bold text-foreground tabular-nums mt-1">
              {formatCurrency(strategy.totalOptimalRewards)}<span className="text-xs font-normal text-foreground-muted">/mo</span>
            </p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Current Rewards</p>
            <p className="font-data text-xl font-bold text-foreground tabular-nums mt-1">
              {formatCurrency(strategy.totalActualRewards)}<span className="text-xs font-normal text-foreground-muted">/mo</span>
            </p>
          </div>
          <div className={cn(
            "border rounded-xl p-4",
            strategy.gapAmount > 0
              ? "bg-warning/5 border-warning/20"
              : "bg-card border-card-border"
          )}>
            <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Missed Rewards</p>
            <p className={cn(
              "font-data text-xl font-bold tabular-nums mt-1",
              strategy.gapAmount > 0 ? "text-warning" : "text-success"
            )}>
              {strategy.gapAmount > 0 ? `-${formatCurrency(strategy.gapAmount)}` : formatCurrency(0)}<span className="text-xs font-normal text-foreground-muted">/mo</span>
            </p>
          </div>
        </div>
      )}

      {/* Missed Rewards Breakdown */}
      <MissedRewardsBreakdown items={walletStrategy} />

      {/* Wallet Strategy */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 20 }}>credit_score</span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Wallet Strategy</h3>
            <p className="text-[10px] text-foreground-muted">Best card to use per spending category</p>
          </div>
        </div>
        <WalletStrategyGrid strategies={walletStrategy} />
      </div>

      {/* Two-Column: Perks Tracker + Points Portfolio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-card-border/50 flex items-center gap-2">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>card_giftcard</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              Perks Tracker
            </span>
          </div>
          <PerksTracker cards={cardPerksData} onTogglePerk={onTogglePerk} />
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>account_balance_wallet</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              Points Portfolio
            </span>
          </div>
          <PointsPortfolio
            programs={pointsPrograms}
            totalValue={pointsTotalValue}
            totalMonthlyReward={pointsMonthlyReward}
          />
        </div>
      </div>

      {/* Sign-Up Bonus Tracker */}
      <BonusTrackerSection />

      {/* Ask About Your Cards */}
      {cardPerksData.length > 0 && (
        <StrategyCardChat
          cards={cardPerksData.map((c) => ({
            id: c.cardId,
            name: c.cardName,
            imageUrl: c.cardImageUrl,
          }))}
        />
      )}

      {/* Category Comparison */}
      {recommendations.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-card-border/50 flex items-center gap-2">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>compare</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              Card Comparison by Category
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border/50 bg-background-secondary/30">
                  <th className="text-left px-5 py-2.5 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Category</th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Best Card</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Rate</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Monthly Spend</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Rewards</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border/30">
                {recommendations.map((r) => {
                  const meta = getCategoryMeta(r.category)
                  return (
                    <tr key={r.category} className="hover:bg-background-secondary/20 transition-colors">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-rounded" style={{ fontSize: 16, color: meta.hex }}>{meta.icon}</span>
                          <span className="font-medium text-foreground">{r.category}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-foreground-muted">{r.bestCard}</td>
                      <td className="px-5 py-2.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-data tabular-nums bg-primary/10 text-primary">
                          {r.bestRate}x
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right font-data text-foreground-muted tabular-nums">
                        {r.monthlySpend != null ? formatCurrency(r.monthlySpend) : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right font-data font-semibold text-success tabular-nums">
                        {r.monthlyReward != null ? `+${formatCurrency(r.monthlyReward)}` : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function MissedRewardsBreakdown({ items }: { items: WalletStrategyItem[] }) {
  const gaps = items
    .filter((s) => s.gap != null && s.gap > 0)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))

  if (gaps.length === 0) return null

  const totalGap = gaps.reduce((s, g) => s + (g.gap ?? 0), 0)

  return (
    <div className="bg-card border border-warning/20 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-card-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-warning" style={{ fontSize: 16 }}>trending_down</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Where You{"'"}re Leaving Money
          </span>
        </div>
        <span className="text-[10px] font-data font-semibold text-warning tabular-nums">
          {formatCurrency(totalGap)}/mo recoverable
        </span>
      </div>
      <div className="px-5 py-2.5 bg-background-secondary/30 border-b border-card-border/30">
        <p className="text-[10px] text-foreground-muted">
          Using a flat 1x card everywhere? Switch to the right card per category to earn more.
        </p>
      </div>
      <div className="divide-y divide-card-border/30">
        {gaps.map((item) => {
          const meta = getCategoryMeta(item.category)
          const gap = item.gap ?? 0
          const actual = item.actualReward ?? 0
          const optimal = item.monthlyReward ?? 0
          const spend = item.monthlySpend ?? 0
          const unit = item.rewardUnit === "percent" ? "%" : "x"

          return (
            <div key={item.category} className="px-5 py-3 group/row hover:bg-background-secondary/20 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 18, color: meta.hex }}>{meta.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.category}</p>
                    <p className="text-[10px] text-foreground-muted">
                      {formatCurrency(spend)}/mo spend
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-data font-semibold text-warning tabular-nums">
                    +{formatCurrency(gap)}/mo
                  </span>
                </div>
              </div>
              <div className="mt-2 ml-[42px] flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-background-secondary/50 rounded text-[10px]">
                  <span className="text-foreground-muted">Now:</span>
                  <span className="font-data text-foreground-muted tabular-nums">1x = {formatCurrency(actual)}</span>
                </div>
                <span className="material-symbols-rounded text-foreground-muted/40" style={{ fontSize: 14 }}>arrow_forward</span>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-success/8 border border-success/15 rounded text-[10px]">
                  <span className="font-medium text-foreground">{item.cardName}</span>
                  <span className="font-data font-semibold text-success tabular-nums whitespace-nowrap">{item.rewardRate}{unit} = {formatCurrency(optimal)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
