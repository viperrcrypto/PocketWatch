"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import Link from "next/link"
import {
  useFinanceAccounts, useFinanceDeepInsights,
  useNetWorth,
  useFetchFullHistory, useSyncAll,
} from "@/hooks/use-finance"
import { formatCurrency, formatRelativeTime, cn } from "@/lib/utils"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { PrivacyToggle } from "@/components/portfolio/privacy-toggle"
import { FlexButton } from "@/components/finance/flex-button"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { FinanceHeroCard } from "@/components/finance/finance-hero-card"
import { FinanceStatCard } from "@/components/finance/stat-card"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { SpendingMonthCard } from "@/components/finance/spending-month-card"
import { MonthlyBillsCard } from "@/components/finance/dashboard/monthly-bills-card"
import { FadeIn } from "@/components/motion/fade-in"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"

const NetWorthChart = dynamic(
  () => import("@/components/finance/net-worth-chart").then((m) => m.NetWorthChart),
  { ssr: false, loading: () => <div className="h-[200px] animate-shimmer rounded-xl" /> }
)

const NW_RANGES = ["1W", "1M", "3M", "6M", "1Y", "ALL"] as const
const RANGE_MAP: Record<string, "1w" | "1m" | "3m" | "6m" | "1y" | "all"> = {
  "1W": "1w", "1M": "1m", "3M": "3m", "6M": "6m", "1Y": "1y", "ALL": "all",
}

export default function FinanceDashboardPage() {
  const [nwRange, setNwRange] = useState<string>("1W")
  const [includeInvestments, setIncludeInvestments] = useState(true)
  const { isHidden, togglePrivacy } = usePrivacyMode()

  const { data: accounts, isLoading: accountsLoading, isError: accountsError } = useFinanceAccounts()
  const { data: deep } = useFinanceDeepInsights()
  const { data: netWorthData, isLoading: nwLoading } = useNetWorth(RANGE_MAP[nwRange] ?? "1y", includeInvestments)

  // autoCategorize removed — replaced by review flow
  const fetchHistory = useFetchFullHistory()
  const syncAll = useSyncAll()

  // Derive last synced time from most recent institution sync
  const lastSyncedAt = accounts?.reduce<string | null>((latest, inst) => {
    if (!inst.lastSyncedAt) return latest
    if (!latest) return inst.lastSyncedAt
    return new Date(inst.lastSyncedAt) > new Date(latest) ? inst.lastSyncedAt : latest
  }, null) ?? null

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
    ? (nwDelta / firstNW.fiatNetWorth) * 100
    : 0

  const isLoading = accountsLoading
  const hasData = (accounts?.length ?? 0) > 0

  if (accountsError && !hasData) {
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
        actions={
          <>
            {lastSyncedAt && (
              <span className="text-[10px] text-foreground-muted tabular-nums hidden sm:inline">
                Synced {formatRelativeTime(lastSyncedAt)}
              </span>
            )}
            <button
              onClick={() => syncAll.mutate(undefined, {
                onSuccess: () => toast.success("All accounts refreshed"),
                onError: (err) => toast.error(err.message),
              })}
              disabled={syncAll.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors disabled:opacity-50"
            >
              <span className={cn("material-symbols-rounded", syncAll.isPending && "animate-spin")} style={{ fontSize: 14 }}>
                sync
              </span>
              {syncAll.isPending ? "Syncing..." : "Refresh"}
            </button>
            {deep && <FlexButton deep={deep} />}
            <PrivacyToggle isHidden={isHidden} onToggle={togglePrivacy} />
          </>
        }
      />

      {/* Net Worth Hero Card */}
      <FadeIn className="mt-6 mb-8">
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
      </FadeIn>

      {/* At a Glance — Stat Cards */}
      <FadeIn delay={0.1} className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground-muted mb-3">At a Glance</p>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <FinanceCardSkeleton key={i} />)}
          </div>
        ) : (
          <StaggerChildren className="grid grid-cols-2 lg:grid-cols-4 gap-4" staggerMs={60}>
            <StaggerItem>
              <FinanceStatCard
                label="Cash on Hand"
                value={formatCurrency(totalCash)}
                icon="account_balance"
                accentColor="#10B981"
                isHidden={isHidden}
              />
            </StaggerItem>
            <StaggerItem>
              <FinanceStatCard
                label="Credit Card Debt"
                value={formatCurrency(totalCredit)}
                icon="credit_card"
                accentColor="#f97316"
                isHidden={isHidden}
              />
            </StaggerItem>
            <StaggerItem>
              <FinanceStatCard
                label="Investments"
                value={formatCurrency(totalInvestments)}
                icon="trending_up"
                accentColor="#8B5CF6"
                isHidden={isHidden}
              />
            </StaggerItem>
            <StaggerItem>
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
                  className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 border border-transparent card-hover-lift transition-colors group h-full"
                  style={{
                    boxShadow: "var(--shadow-sm)",
                    background: "var(--card)",
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #3b82f6, color-mix(in srgb, #3b82f6 80%, #000))" }}>
                    <span className="material-symbols-rounded text-white drop-shadow-sm" style={{ fontSize: 20 }}>savings</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">Safe to Spend</p>
                  <p className="text-[10px] text-foreground-muted text-center leading-tight">
                    Create a budget to see your daily safe spending limit
                  </p>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium">Set up a budget</span>
                </Link>
              )}
            </StaggerItem>
          </StaggerChildren>
        )}
      </FadeIn>

      {/* Categorization Status */}
      <FadeIn delay={0.2} className="mb-6">
        {deep && (deep.uncategorizedCount > 0) ? (
          <Link
            href="/finance/categorize"
            className="flex items-center gap-3 bg-card border border-amber-500/20 rounded-xl px-4 py-3 hover:border-amber-500/40 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-rounded text-amber-500" style={{ fontSize: 16 }}>rate_review</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">
                {deep.uncategorizedCount} transaction{deep.uncategorizedCount !== 1 ? "s" : ""} need review
              </p>
            </div>
            <span className="material-symbols-rounded text-foreground-muted group-hover:text-foreground text-sm transition-colors">arrow_forward</span>
          </Link>
        ) : (
          <div className="bg-success/5 border border-success/20 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-rounded text-success" style={{ fontSize: 18 }}>check_circle</span>
            <p className="text-xs font-medium text-foreground">All Categorized</p>
          </div>
        )}
      </FadeIn>

      {/* Main Cards: Spending Donut + Bills */}
      <FadeIn delay={0.25} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SpendingMonthCard />
        <MonthlyBillsCard isHidden={isHidden} />
      </FadeIn>

      {/* Cash Flow Summary */}
      {deep && (
        <FadeIn delay={0.3} className="mb-8">
          <div className="bg-card rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>account_balance_wallet</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Cash Flow This Month</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-foreground-muted mb-1">Income</p>
                <p className="text-lg font-bold text-success tabular-nums">
                  <BlurredValue isHidden={isHidden}>{formatCurrency(deep.totalIncome)}</BlurredValue>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-foreground-muted mb-1">Spending</p>
                <p className="text-lg font-bold text-error tabular-nums">
                  <BlurredValue isHidden={isHidden}>{formatCurrency(deep.totalSpending)}</BlurredValue>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-foreground-muted mb-1">Net</p>
                <p className={cn(
                  "text-lg font-bold tabular-nums",
                  (deep.totalIncome - deep.totalSpending) >= 0 ? "text-success" : "text-error"
                )}>
                  <BlurredValue isHidden={isHidden}>
                    {(deep.totalIncome - deep.totalSpending) >= 0 ? "+" : ""}{formatCurrency(deep.totalIncome - deep.totalSpending)}
                  </BlurredValue>
                </p>
              </div>
            </div>
            {deep.savingsRate != null && (
              <div className="mt-3 pt-3 border-t border-card-border/30 flex items-center justify-between">
                <span className="text-[10px] text-foreground-muted">Savings rate</span>
                <span className={cn(
                  "text-xs font-semibold",
                  deep.savingsRate >= 20 ? "text-success" : deep.savingsRate >= 0 ? "text-warning" : "text-error"
                )}>
                  {Math.round(deep.savingsRate)}%
                </span>
              </div>
            )}
          </div>
        </FadeIn>
      )}
    </div>
  )
}
