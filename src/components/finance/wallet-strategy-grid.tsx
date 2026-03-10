"use client"

import { cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface WalletStrategyItem {
  category: string
  cardName: string
  rewardRate: number
  rewardUnit: string
}

interface WalletStrategyGridProps {
  strategies: WalletStrategyItem[]
}

export function WalletStrategyGrid({ strategies }: WalletStrategyGridProps) {
  if (strategies.length === 0) {
    return <p className="text-sm text-foreground-muted text-center py-8">No card strategy data available</p>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {strategies.map((s) => {
        const meta = getCategoryMeta(s.category)
        return (
          <div
            key={s.category}
            className="bg-card border border-card-border rounded-xl p-4 hover:border-card-border-hover transition-all"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: `color-mix(in srgb, ${meta.hex} 15%, var(--background-secondary))` }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18, color: meta.hex }}>{meta.icon}</span>
            </div>
            <p className="text-sm font-semibold text-primary tabular-nums">
              {s.rewardRate}{s.rewardUnit === "percent" ? "%" : "x"} {s.rewardUnit === "percent" ? "Cash Back" : "Points"}
            </p>
            <p className="text-xs text-foreground mt-0.5">{s.category}</p>
            <p className="text-[10px] text-foreground-muted mt-1 truncate">{s.cardName}</p>
          </div>
        )
      })}
    </div>
  )
}
