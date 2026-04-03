"use client"

import { cn, formatCurrency } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface WalletStrategyItem {
  category: string
  cardName: string
  rewardRate: number
  rewardUnit: string
  monthlySpend?: number
  monthlyReward?: number
}

interface WalletStrategyGridProps {
  strategies: WalletStrategyItem[]
}

export function WalletStrategyGrid({ strategies }: WalletStrategyGridProps) {
  if (strategies.length === 0) {
    return <p className="text-sm text-foreground-muted text-center py-8">No card strategy data available</p>
  }

  const topRate = Math.max(...strategies.map((s) => s.rewardRate))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {strategies.map((s) => {
        const meta = getCategoryMeta(s.category)
        const isTop = s.rewardRate === topRate && topRate > 0
        const rateLabel = s.rewardUnit === "percent"
          ? `${s.rewardRate}% Cash Back`
          : `${s.rewardRate}x Points`

        return (
          <div
            key={s.category}
            className={cn(
              "relative bg-card border rounded-xl p-4 transition-colors group",
              isTop ? "border-primary/40 bg-primary-subtle" : "border-card-border hover:border-card-border-hover"
            )}
          >
            {isTop && (
              <span className="absolute -top-2 right-3 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest bg-primary text-white rounded-full">
                Best
              </span>
            )}

            <div className="flex items-start gap-3">
              <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 20, color: meta.hex }}>
                {meta.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{s.category}</p>
                <p className="text-[10px] text-foreground-muted truncate mt-0.5">{s.cardName}</p>
              </div>
              <span className={cn(
                "font-data text-sm font-bold tabular-nums flex-shrink-0",
                isTop ? "text-primary" : "text-foreground"
              )}>
                {s.rewardRate}{s.rewardUnit === "percent" ? "%" : "x"}
              </span>
            </div>

            {/* Rate bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-foreground-muted">{rateLabel}</span>
                {s.monthlySpend != null && s.monthlySpend > 0 && (
                  <span className="text-[9px] text-foreground-muted tabular-nums">
                    {formatCurrency(s.monthlySpend)}/mo
                  </span>
                )}
              </div>
              <div className="h-1 rounded-full bg-background-secondary overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    isTop ? "bg-primary" : "bg-foreground-muted/30"
                  )}
                  style={{ width: `${topRate > 0 ? Math.max((s.rewardRate / topRate) * 100, 8) : 0}%` }}
                />
              </div>
            </div>

            {s.monthlyReward != null && s.monthlyReward > 0 && (
              <p className="mt-2 text-[10px] font-medium text-success">
                +{formatCurrency(s.monthlyReward)}/mo earned
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
