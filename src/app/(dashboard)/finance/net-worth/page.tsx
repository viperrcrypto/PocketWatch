"use client"

import { useState } from "react"
import { useNetWorth, useFinanceAccounts } from "@/hooks/use-finance"
import { formatCurrency } from "@/lib/utils"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { FinanceHeroCard } from "@/components/finance/finance-hero-card"
import { FinanceChartWrapper } from "@/components/finance/finance-chart-wrapper"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { NetWorthChart } from "@/components/finance/net-worth-chart"

const RANGE_OPTIONS = ["1W", "1M", "3M", "6M", "1Y", "ALL"] as const
const RANGE_MAP: Record<string, string> = { "1W": "1w", "1M": "1m", "3M": "3m", "6M": "6m", "1Y": "1y", "ALL": "all" }

export default function FinanceNetWorthPage() {
  const [range, setRange] = useState<string>("1W")
  const apiRange = RANGE_MAP[range] ?? "1y"
  const { data, isLoading, isError } = useNetWorth(apiRange, true)
  const { data: accounts } = useFinanceAccounts()

  const latest = data?.[data.length - 1]
  const first = data?.[0]
  const change = latest && first ? latest.fiatNetWorth - first.fiatNetWorth : 0
  const changePercent = first?.fiatNetWorth ? (change / first.fiatNetWorth) * 100 : 0
  const hasAccounts = (accounts?.length ?? 0) > 0

  if (isError) {
    return (
      <div className="space-y-6">
        <FinancePageHeader title="Net Worth" />
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load net worth data.</p>
        </div>
      </div>
    )
  }

  if (!isLoading && !hasAccounts) {
    return (
      <div className="space-y-6">
        <FinancePageHeader title="Net Worth" />
        <FinanceEmpty
          icon="monitoring"
          title="Track your net worth"
          description="Connect bank accounts and sync to start tracking your net worth over time."
          linkTo={{ label: "Connect accounts", href: "/finance/accounts" }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FinancePageHeader title="Net Worth" />

      {/* Hero Card */}
      {isLoading ? (
        <div className="h-40 animate-shimmer rounded-xl" />
      ) : latest ? (
        <FinanceHeroCard
          label="Total Net Worth"
          value={formatCurrency(latest.fiatNetWorth)}
          change={changePercent !== 0 ? {
            value: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}% (${formatCurrency(Math.abs(change))})`,
            positive: change >= 0,
          } : undefined}
          footerStats={[
            { label: "Assets", value: formatCurrency(latest.fiatAssets), color: "success" },
            { label: "Debt", value: formatCurrency(latest.fiatDebt), color: "error" },
            { label: "Net Worth", value: formatCurrency(latest.fiatNetWorth) },
          ]}
        />
      ) : null}

      {/* Chart */}
      <FinanceChartWrapper
        title="Net Worth Over Time"
        timeframes={RANGE_OPTIONS}
        activeTimeframe={range}
        onTimeframeChange={setRange}
        isLoading={isLoading}
      >
        {data && data.length > 0 ? (
          <NetWorthChart data={data} range={apiRange as "1m" | "3m" | "6m" | "1y" | "all"} />
        ) : (
          <p className="text-sm text-foreground-muted text-center py-16">
            No net worth data yet. Sync your accounts to start tracking.
          </p>
        )}
      </FinanceChartWrapper>
    </div>
  )
}
