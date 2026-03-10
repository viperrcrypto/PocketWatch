"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { FinanceStatCard } from "@/components/finance/stat-card"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"

interface InsightsHeroStatsProps {
  isLoading: boolean
  health: any
  spending: number
  income: number
  savingsRate: number
  velocity: any
  prevSpending: number
  spendingChange: number
}

export function InsightsHeroStats({
  isLoading,
  health,
  spending,
  income,
  savingsRate,
  velocity,
  prevSpending,
  spendingChange,
}: InsightsHeroStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <FinanceCardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {health && (
        <div className="bg-card border border-card-border rounded-xl p-5 flex flex-col items-center justify-center col-span-2 lg:col-span-1">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold font-data border-4"
            style={{
              borderColor: health.score >= 80 ? "var(--success)" : health.score >= 60 ? "var(--warning)" : "var(--error)",
              color: health.score >= 80 ? "var(--success)" : health.score >= 60 ? "var(--warning)" : "var(--error)",
            }}
          >
            {health.grade}
          </div>
          <span className="text-2xl font-data font-bold text-foreground mt-2 tabular-nums">{health.score}</span>
          <span className="text-[10px] text-foreground-muted uppercase tracking-wider">Health Score</span>
        </div>
      )}
      <FinanceStatCard
        label="Spending"
        value={formatCurrency(spending)}
        icon="shopping_cart"
        change={spendingChange !== 0 ? {
          value: `${Math.abs(spendingChange).toFixed(1)}% MoM`,
          positive: spendingChange < 0,
        } : undefined}
      />
      <FinanceStatCard
        label="Income"
        value={formatCurrency(income)}
        icon="payments"
        accentColor="var(--success)"
      />
      <FinanceStatCard
        label="Savings Rate"
        value={`${savingsRate.toFixed(1)}%`}
        icon="savings"
        accentColor={savingsRate >= 20 ? "var(--success)" : "var(--warning)"}
      />
      <FinanceStatCard
        label="Spending Velocity"
        value={`${formatCurrency(velocity?.dailyAvg ?? 0)}/day`}
        icon="speed"
        change={velocity ? {
          value: `${formatCurrency(velocity.projectedTotal)} projected`,
          positive: velocity.projectedTotal < prevSpending,
        } : undefined}
      />
    </div>
  )
}
