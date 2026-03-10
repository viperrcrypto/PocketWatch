"use client"

import type { ViewTab } from "./airdrops-constants"

export function AirdropsViewTabs({
  activeView,
  onViewChange,
  vestingClaimCount,
}: {
  activeView: ViewTab
  onViewChange: (view: ViewTab) => void
  vestingClaimCount: number
}) {
  const tabs: { key: ViewTab; label: string; icon: string; badge?: number }[] = [
    { key: "airdrops", label: "Airdrops", icon: "redeem" },
    { key: "vesting", label: "Streams & Vesting", icon: "lock_clock", badge: vestingClaimCount || undefined },
    { key: "staking", label: "Staking", icon: "layers" },
  ]

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => {
        const isActive = activeView === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onViewChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 border transition-all rounded-xl text-sm ${
              isActive
                ? "bg-card border-primary/30 text-foreground font-semibold"
                : "bg-background-secondary border-card-border text-foreground-muted hover:border-card-border-hover hover:text-foreground-secondary"
            }`}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: 18, color: isActive ? "var(--primary)" : undefined }}
            >
              {tab.icon}
            </span>
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="bg-success/15 text-success px-1.5 py-0.5 rounded-sm font-data text-[9px] font-bold">
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
