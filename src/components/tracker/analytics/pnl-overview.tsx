"use client"

import type { TrackerAnalytics } from "@/lib/tracker/types"
import { formatUsd } from "@/lib/tracker/classifier"

interface PnlOverviewProps {
  analytics: TrackerAnalytics | null | undefined
  isLoading?: boolean
}

interface StatCardData {
  label: string
  value: string
  color: string
  icon: string
  subValue?: string
}

function StatSkeleton() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 bg-card-border" />
        <div className="h-3 w-20 bg-card-border" />
      </div>
      <div className="h-7 w-28 bg-card-border" />
      <div className="h-3 w-16 bg-card-border" />
    </div>
  )
}

function getPnlColor(value: number): string {
  if (value > 0) return "var(--success)"
  if (value < 0) return "var(--error)"
  return "var(--foreground-muted)"
}

export default function PnlOverview({ analytics, isLoading }: PnlOverviewProps) {
  if (isLoading || !analytics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
    )
  }

  const totalPnl = analytics.realizedPnl + analytics.unrealizedPnl

  const stats: StatCardData[] = [
    {
      label: "Total PnL",
      value: formatUsd(totalPnl),
      color: getPnlColor(totalPnl),
      icon: "account_balance",
      subValue: `${analytics.totalTrades} trades`,
    },
    {
      label: "Realized PnL",
      value: formatUsd(analytics.realizedPnl),
      color: getPnlColor(analytics.realizedPnl),
      icon: "payments",
      subValue: `${analytics.winningTrades} winning`,
    },
    {
      label: "Unrealized PnL",
      value: formatUsd(analytics.unrealizedPnl),
      color: getPnlColor(analytics.unrealizedPnl),
      icon: "trending_up",
      subValue: `${analytics.tokenHoldings?.length || 0} positions`,
    },
    {
      label: "Win Rate",
      value: analytics.winRate != null ? `${analytics.winRate.toFixed(1)}%` : "--",
      color: analytics.winRate != null
        ? (analytics.winRate >= 50 ? "var(--success)" : analytics.winRate >= 30 ? "var(--warning)" : "var(--error)")
        : "var(--foreground-muted)",
      icon: "trophy",
      subValue: `${analytics.winningTrades}/${analytics.totalTrades}`,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="card p-5 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-rounded"
              style={{ fontSize: 16, color: stat.color }}
            >
              {stat.icon}
            </span>
            <span className="section-label">{stat.label}</span>
          </div>
          <p
            className="text-2xl font-semibold font-mono tabular-nums"
            style={{ color: stat.color }}
          >
            {stat.value}
          </p>
          {stat.subValue && (
            <p className="text-xs text-foreground-muted font-mono">
              {stat.subValue}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
