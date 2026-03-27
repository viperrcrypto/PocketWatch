"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"

interface BudgetStatStripProps {
  dailyAvg: number
  projectedTotal: number
  totalBudgeted: number
  worstCategory: { category: string; overAmount: number } | null
  onTrackCount: number
  totalCount: number
}

export function BudgetStatStrip({ dailyAvg, projectedTotal, totalBudgeted, worstCategory, onTrackCount, totalCount }: BudgetStatStripProps) {
  const projectedOver = projectedTotal > totalBudgeted
  const projectedDiff = Math.abs(projectedTotal - totalBudgeted)

  return (
    <StaggerChildren className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-card-border rounded-xl overflow-hidden" staggerMs={60}>
      <StaggerItem>
        <StatCard icon="speed" iconColor="text-primary" label="Pace Check">
          <span className="font-data font-bold tabular-nums">{formatCurrency(dailyAvg, "USD", 0)}/day</span>
          <span className="mx-1">&middot;</span>
          <span className={cn("font-semibold tabular-nums", projectedOver ? "text-error" : "text-success")}>
            {formatCurrency(projectedDiff, "USD", 0)} {projectedOver ? "over" : "under"}
          </span>
        </StatCard>
      </StaggerItem>
      <StaggerItem>
        <StatCard icon={projectedOver ? "trending_up" : "trending_down"} iconColor={projectedOver ? "text-error" : "text-success"} label="Projected">
          <span className={cn("font-data font-bold tabular-nums", projectedOver ? "text-error" : "text-success")}>{formatCurrency(projectedTotal, "USD", 0)}</span>
          <span className="text-foreground-muted ml-1">vs {formatCurrency(totalBudgeted, "USD", 0)}</span>
        </StatCard>
      </StaggerItem>
      <StaggerItem>
        <StatCard icon="warning" iconColor="text-error" label="Biggest Overspend">
          {worstCategory ? (
            <><span className="font-semibold">{worstCategory.category}</span> <span className="text-error font-semibold tabular-nums">{formatCurrency(worstCategory.overAmount, "USD", 0)} over</span></>
          ) : (
            <span className="text-success font-medium">All within budget</span>
          )}
        </StatCard>
      </StaggerItem>
      <StaggerItem>
        <StatCard icon="check_circle" iconColor="text-success" label="On Track">
          <span className="text-success font-semibold">{onTrackCount}</span>
          <span className="text-foreground-muted"> of {totalCount} categories</span>
        </StatCard>
      </StaggerItem>
    </StaggerChildren>
  )
}

function StatCard({ icon, iconColor, label, children }: { icon: string; iconColor: string; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn("material-symbols-rounded", iconColor)} style={{ fontSize: 14 }}>{icon}</span>
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
      </div>
      <p className="text-[11px] text-foreground leading-snug">{children}</p>
    </div>
  )
}
