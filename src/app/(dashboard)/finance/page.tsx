"use client"

import { useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import {
  useFinanceAccounts, useFinanceDeepInsights,
  useAutoCategorize, useNetWorth, useFinanceSubscriptions,
  useFetchFullHistory,
} from "@/hooks/use-finance"
import { formatCurrency, cn } from "@/lib/utils"
import { useFinanceTrends, useRecurringStreams, useInvestmentHoldings } from "@/hooks/use-finance"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { PrivacyToggle } from "@/components/portfolio/privacy-toggle"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { FinanceHeroCard } from "@/components/finance/finance-hero-card"
import { FinanceStatCard } from "@/components/finance/stat-card"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { NetWorthChart } from "@/components/finance/net-worth-chart"
import { SpendingMonthCard } from "@/components/finance/spending-month-card"
import { MerchantIcon } from "@/components/finance/merchant-icon"
import { MonthlySubscriptionsCard } from "@/components/finance/dashboard/monthly-subscriptions-card"
import { MonthlyBillsCard } from "@/components/finance/dashboard/monthly-bills-card"
import { InsightsSection } from "@/components/finance/dashboard/insights-section"

const NW_RANGES = ["1W", "1M", "3M", "6M", "1Y", "ALL"] as const
const RANGE_MAP: Record<string, "1w" | "1m" | "3m" | "6m" | "1y" | "all"> = {
  "1W": "1w", "1M": "1m", "3M": "3m", "6M": "6m", "1Y": "1y", "ALL": "all",
}

export default function FinanceDashboardPage() {
  const [nwRange, setNwRange] = useState<string>("1W")
  const [includeInvestments, setIncludeInvestments] = useState(true)
  const { isHidden, togglePrivacy } = usePrivacyMode()

  const { data: accounts, isLoading: accountsLoading, isError: accountsError } = useFinanceAccounts()
  const { data: deep, isLoading: insightsLoading, isError: insightsError } = useFinanceDeepInsights()
  const { data: netWorthData, isLoading: nwLoading } = useNetWorth(RANGE_MAP[nwRange] ?? "1y", includeInvestments)
  const { data: subs } = useFinanceSubscriptions()
  const autoCategorize = useAutoCategorize()
  const fetchHistory = useFetchFullHistory()
  const { data: trends } = useFinanceTrends(6)
  const { data: recurringData } = useRecurringStreams()
  const { data: holdingsData } = useInvestmentHoldings()
  const [showInsights, setShowInsights] = useState(false)

  // Account aggregation
  const allAccounts = accounts?.flatMap((inst) =>
    inst.accounts.map((acct) => ({ ...acct, provider: inst.provider }))
  ) ?? []
  const canonical = allAccounts.filter(
    (a) => !(a.provider === "simplefin" && a.linkedExternalId)
  )

  const totalCash = canonical
    .filter((a) => a.type === "checking" || a.type === "savings")
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0)
  const totalCredit = canonical
    .filter((a) => a.type === "credit" || a.type === "business_credit")
    .reduce((sum, a) => sum + Math.abs(a.currentBalance ?? 0), 0)
  const totalInvestments = canonical
    .filter((a) => a.type === "investment" || a.type === "brokerage")
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0)
  // Net worth — always compute from live account balances
  const netWorth = totalCash
    + (includeInvestments ? totalInvestments : 0)
    - totalCredit
  const firstNW = netWorthData?.[0]
  const nwDelta = firstNW ? netWorth - firstNW.fiatNetWorth : 0
  const nwPercent = firstNW && firstNW.fiatNetWorth !== 0
    ? ((nwDelta) / Math.abs(firstNW.fiatNetWorth)) * 100
    : 0

  // Subscriptions summary
  const allSubs = subs?.subscriptions ?? []
  const activeSubs = allSubs.filter((s: { status: string }) => s.status === "active")

  const isLoading = accountsLoading || insightsLoading
  const hasData = (accounts?.length ?? 0) > 0

  if ((accountsError || insightsError) && !hasData) {
    return (
      <div className="space-y-6">
        <FinancePageHeader title="Financial Overview" />
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load finance data. Please try again.</p>
        </div>
      </div>
    )
  }

  if (!isLoading && !hasData) {
    return (
      <div className="space-y-6">
        <FinancePageHeader title="Financial Overview" />
        <FinanceEmpty
          icon="account_balance"
          title="Welcome to Finance"
          description="Connect your bank accounts to start tracking spending, budgets, and net worth."
          helpSteps={[
            { icon: "settings", text: "Go to Settings and add your Plaid or SimpleFIN credentials" },
            { icon: "link", text: "Connect your bank accounts" },
            { icon: "sync", text: "Sync to import transactions automatically" },
          ]}
          linkTo={{ label: "Go to Settings", href: "/finance/settings" }}
        />
      </div>
    )
  }

  return (
    <div>
      <FinancePageHeader
        title="Financial Overview"
        actions={<PrivacyToggle isHidden={isHidden} onToggle={togglePrivacy} />}
      />

      {/* Net Worth Hero Card */}
      <div className="animate-fade-up mt-6 mb-8">
        <FinanceHeroCard
          label="Net Worth"
          value={formatCurrency(netWorth)}
          isLoading={isLoading}
          isHidden={isHidden}
          change={nwDelta !== 0 ? {
            value: `${nwPercent >= 0 ? "+" : ""}${nwPercent.toFixed(1)}% (${formatCurrency(Math.abs(nwDelta))})`,
            positive: nwDelta >= 0,
          } : undefined}
          footerStats={[
            { label: "Cash", value: formatCurrency(totalCash) },
            { label: "Investments", value: formatCurrency(totalInvestments), color: totalInvestments > 0 ? "success" : undefined },
            { label: "Debt", value: formatCurrency(-totalCredit), color: totalCredit > 0 ? "error" : undefined },
          ]}
        >
          {/* Toggle switches */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIncludeInvestments(!includeInvestments)}
                className="admin-toggle"
                data-state={includeInvestments ? "on" : "off"}
              >
                <span className="admin-toggle-thumb" />
              </button>
              <span className="text-xs text-foreground-muted">Investments</span>
            </div>
            <button
                onClick={() => fetchHistory.mutate(undefined, {
                  onSuccess: (result) => toast.success(`Fetched ${result.inserted} historical transactions`),
                  onError: (err) => toast.error(err.message),
                })}
                disabled={fetchHistory.isPending}
                className="px-2.5 py-1 rounded-full text-[10px] font-medium text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors disabled:opacity-50 flex items-center gap-1"
                title="Fetch full transaction history from your bank"
              >
                <span className={cn("material-symbols-rounded", fetchHistory.isPending && "animate-spin")} style={{ fontSize: 12 }}>
                  {fetchHistory.isPending ? "progress_activity" : "history"}
                </span>
                {fetchHistory.isPending ? "Fetching..." : "Refresh History"}
              </button>
            <div className="ml-auto">
              <div className="inline-flex rounded-lg p-0.5" style={{ backgroundColor: "color-mix(in srgb, var(--background-secondary) 80%, transparent)" }}>
                {NW_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setNwRange(r)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all",
                      nwRange === r
                        ? "bg-primary text-white shadow-sm"
                        : "text-foreground-muted hover:text-foreground"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Net Worth Chart */}
          {nwLoading ? (
            <div className="h-[260px] animate-shimmer rounded-lg" />
          ) : netWorthData && netWorthData.length >= 1 ? (
            <NetWorthChart data={netWorthData} range={RANGE_MAP[nwRange] ?? "1y"} height={260} />
          ) : (
            <p className="text-sm text-foreground-muted text-center py-12">Not enough data for chart</p>
          )}
        </FinanceHeroCard>
      </div>

      {/* At a Glance — Stat Cards */}
      <div className="animate-fade-up delay-2 mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground-muted mb-3">At a Glance</p>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <FinanceCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <FinanceStatCard
              label="Cash on Hand"
              value={formatCurrency(totalCash)}
              icon="account_balance"
              accentColor="#10B981"
              isHidden={isHidden}
            />
            <FinanceStatCard
              label="Credit Card Debt"
              value={formatCurrency(totalCredit)}
              icon="credit_card"
              accentColor="#f97316"
              isHidden={isHidden}
            />
            <FinanceStatCard
              label="Investments"
              value={formatCurrency(totalInvestments)}
              icon="trending_up"
              accentColor="#8B5CF6"
              isHidden={isHidden}
            />
            {(deep?.budgetHealth?.length ?? 0) > 0 ? (
              <FinanceStatCard
                label="Safe to Spend / Day"
                value={deep?.cashFlowForecast?.safeDailySpend != null
                  ? formatCurrency(deep.cashFlowForecast.safeDailySpend)
                  : "--"}
                icon="savings"
                accentColor="#3b82f6"
                isHidden={isHidden}
                change={deep?.cashFlowForecast?.daysRemaining != null
                  ? { value: `${deep.cashFlowForecast.daysRemaining}d left this month`, positive: true }
                  : undefined}
              />
            ) : (
              <Link
                href="/finance/budgets"
                className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 border border-transparent card-hover-lift transition-colors group"
                style={{
                  boxShadow: "var(--shadow-sm)",
                  background: "var(--card)",
                }}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <span className="material-symbols-rounded text-blue-500" style={{ fontSize: 20 }}>savings</span>
                </div>
                <p className="text-xs font-semibold text-foreground">Safe to Spend</p>
                <p className="text-[10px] text-foreground-muted text-center leading-tight">
                  Create a budget to see your daily safe spending limit
                </p>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium">Set up a budget</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Middle Section: Uncategorized + Bills */}
      <div className="animate-fade-up delay-4 grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Uncategorized Review */}
        {deep && deep.uncategorizedCount > 0 ? (
          <div className="bg-card rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-rounded text-warning" style={{ fontSize: 20 }}>label_off</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Uncategorized</p>
                    <span className="bg-warning/10 text-warning text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums">
                      {deep.uncategorizedCount}
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href="/finance/categorize"
                className="text-xs text-primary hover:text-primary-hover font-medium transition-colors"
              >
                Review all
              </Link>
            </div>
            {deep.uncategorizedPreview && deep.uncategorizedPreview.length > 0 && (
              <div className="space-y-0 mb-3">
                {deep.uncategorizedPreview.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-card-border/50 last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MerchantIcon logoUrl={tx.logoUrl} size="sm" />
                      <span className="text-xs text-foreground truncate">{tx.name}</span>
                    </div>
                    <span className="text-xs font-medium tabular-nums text-foreground-muted flex-shrink-0 ml-2">
                      <BlurredValue isHidden={isHidden}>{formatCurrency(tx.amount)}</BlurredValue>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => autoCategorize.mutate(undefined, {
                onSuccess: (result) => {
                  if (result.categorized > 0) {
                    const parts = []
                    if (result.aiCategorized > 0) {
                      parts.push(`${result.aiCategorized} by AI`)
                    }
                    const ruleCount = result.categorized - (result.aiCategorized ?? 0)
                    if (ruleCount > 0) {
                      parts.push(`${ruleCount} by rules`)
                    }
                    const detail = parts.length > 0 ? ` (${parts.join(", ")})` : ""
                    toast.success(`Categorized ${result.categorized} transaction${result.categorized > 1 ? "s" : ""}${detail}${result.remaining > 0 ? ` — ${result.remaining} remaining` : ""}`)
                  } else {
                    toast.info("No transactions could be auto-categorized. Review them manually.")
                  }
                },
                onError: (err) => toast.error(err.message),
              })}
              disabled={autoCategorize.isPending}
              className="w-full px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50"
            >
              {autoCategorize.isPending ? "Categorizing with AI..." : "Auto-categorize"}
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <span className="material-symbols-rounded text-success" style={{ fontSize: 20 }}>check_circle</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">All Categorized</p>
                <p className="text-xs text-foreground-muted">Your transactions are fully categorized</p>
              </div>
            </div>
          </div>
        )}

        {/* Bills — grouped by type, month-aware */}
        <MonthlyBillsCard isHidden={isHidden} />
      </div>

      {/* Bottom Section: Monthly Subscriptions + Spending Donut */}
      <div className="animate-fade-up delay-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlySubscriptionsCard subscriptions={activeSubs} isHidden={isHidden} />
        <SpendingMonthCard />
      </div>

      {/* Insights Section */}
      {hasData && (
        <div className="mt-10">
          <button
            onClick={() => setShowInsights(!showInsights)}
            className="flex items-center gap-2 mb-4 group"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground-muted">
              Insights & Analytics
            </p>
            <span className="material-symbols-rounded text-foreground-muted group-hover:text-foreground transition-colors" style={{ fontSize: 16 }}>
              {showInsights ? "expand_less" : "expand_more"}
            </span>
          </button>

          {showInsights && deep && (
            <InsightsSection deep={deep} trends={trends} recurringData={recurringData} holdingsData={holdingsData} />
          )}
        </div>
      )}
    </div>
  )
}
