"use client"

import { useCombinedNetWorth } from "@/hooks/use-combined-net-worth"
import { formatCurrency, cn } from "@/lib/utils"
import { FadeIn } from "@/components/motion/fade-in"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { PrivacyToggle } from "@/components/portfolio/privacy-toggle"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { FinanceHeroCard } from "@/components/finance/finance-hero-card"
import { NetWorthBreakdown } from "@/components/net-worth/net-worth-breakdown"
import dynamic from "next/dynamic"
const NetWorthHistoryChart = dynamic(
  () => import("@/components/net-worth/net-worth-history-chart").then((m) => m.NetWorthHistoryChart),
  { ssr: false, loading: () => <div className="h-[260px] animate-shimmer rounded-xl" /> }
)

export default function NetWorthPage() {
  const { data, isLoading, isError } = useCombinedNetWorth()
  const { isHidden, togglePrivacy } = usePrivacyMode()

  const totalNetWorth = data?.totalNetWorth ?? 0
  const fiat = data?.fiat ?? { cash: 0, investments: 0, debt: 0, netWorth: 0 }
  const crypto = data?.crypto ?? { value: 0, snapshotAt: null }
  const history = data?.history ?? []

  // Period change from history
  const firstTotal = history.length > 0 ? history[0].total : 0
  const delta = totalNetWorth - firstTotal
  const deltaPct = firstTotal !== 0 ? (delta / firstTotal) * 100 : 0

  if (isError) {
    return (
      <div className="space-y-6">
        <Header isHidden={isHidden} togglePrivacy={togglePrivacy} />
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load net worth data. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header isHidden={isHidden} togglePrivacy={togglePrivacy} />

      {/* Hero Card */}
      <FadeIn className="mt-6 mb-8">
        <FinanceHeroCard
          label="Total Net Worth"
          value={formatCurrency(totalNetWorth)}
          isLoading={isLoading}
          isHidden={isHidden}
          change={delta !== 0 && history.length > 1 ? {
            value: `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}% (${formatCurrency(Math.abs(delta))})`,
            positive: delta >= 0,
          } : undefined}
          footerStats={[
            { label: "Finance", value: formatCurrency(fiat.netWorth) },
            { label: "Digital Assets", value: formatCurrency(crypto.value), color: crypto.value > 0 ? "success" : undefined },
            { label: "Debt", value: formatCurrency(-fiat.debt), color: fiat.debt > 0 ? "error" : undefined },
          ]}
        >
          {/* Chart */}
          {isLoading ? (
            <div className="h-[260px] animate-shimmer rounded-lg" />
          ) : (
            <NetWorthHistoryChart data={history} height={260} />
          )}
        </FinanceHeroCard>
      </FadeIn>

      {/* Breakdown */}
      <FadeIn delay={0.1}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground-muted mb-3">
          Breakdown
        </p>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[68px] animate-shimmer rounded-xl" />
            ))}
          </div>
        ) : (
          <NetWorthBreakdown
            fiatCash={fiat.cash}
            fiatInvestments={fiat.investments}
            fiatDebt={fiat.debt}
            cryptoValue={crypto.value}
            totalNetWorth={totalNetWorth}
            isHidden={isHidden}
          />
        )}
      </FadeIn>

      {/* Source cards */}
      <StaggerChildren className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4" staggerMs={80}>
        <StaggerItem>
          <SourceCard
            title="Finance"
            subtitle="Bank accounts, investments, credit cards"
            value={fiat.netWorth}
            icon="account_balance"
            href="/finance"
            isHidden={isHidden}
            isLoading={isLoading}
          />
        </StaggerItem>
        <StaggerItem>
          <SourceCard
            title="Digital Assets"
            subtitle="Wallets, exchanges, staking"
            value={crypto.value}
            icon="currency_bitcoin"
            href="/portfolio"
            isHidden={isHidden}
            isLoading={isLoading}
          />
        </StaggerItem>
      </StaggerChildren>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function Header({ isHidden, togglePrivacy }: { isHidden: boolean; togglePrivacy: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl text-foreground font-semibold">Net Worth</h1>
        <p className="text-xs text-foreground-muted mt-0.5">Combined view across all accounts</p>
      </div>
      <PrivacyToggle isHidden={isHidden} onToggle={togglePrivacy} />
    </div>
  )
}

function SourceCard({
  title,
  subtitle,
  value,
  icon,
  href,
  isHidden,
  isLoading,
}: {
  title: string
  subtitle: string
  value: number
  icon: string
  href: string
  isHidden: boolean
  isLoading: boolean
}) {
  return (
    <a
      href={href}
      className="bg-card rounded-xl p-5 flex items-center gap-4 group card-hover-lift transition-all"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-foreground-muted">{subtitle}</p>
      </div>
      <div className="text-right">
        {isLoading ? (
          <div className="h-5 w-20 animate-shimmer rounded" />
        ) : (
          <p className={cn("text-sm font-semibold tabular-nums", value < 0 ? "text-error" : "text-foreground")}>
            <BlurredValue isHidden={isHidden}>{formatCurrency(value)}</BlurredValue>
          </p>
        )}
      </div>
      <span className="material-symbols-rounded text-foreground-muted group-hover:text-foreground transition-colors" style={{ fontSize: 18 }}>
        chevron_right
      </span>
    </a>
  )
}
