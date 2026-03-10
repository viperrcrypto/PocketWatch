"use client"

import { useState, useMemo, useCallback } from "react"
import { toast } from "sonner"
import dynamic from "next/dynamic"
import { TextMorph } from "torph/react"
import {
  useAnalyticsSummary,
  useComputeCostBasis,
  useRealizedGains,
  useCostBasisLots,
  useTrackedAccounts,
} from "@/hooks/use-portfolio-tracker"
import { PortfolioSubNav } from "@/components/portfolio/portfolio-sub-nav"
import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { PortfolioChartCard } from "@/components/portfolio/portfolio-chart-card"
import { formatFiatValue } from "@/lib/portfolio/utils"
import { HISTORY_SUB_TABS } from "@/lib/portfolio/nav"
import type { UTCTimestamp } from "lightweight-charts"

import { PERIODS } from "@/components/portfolio/history/pnl/pnl-constants"
import { PnlFilterBar } from "@/components/portfolio/history/pnl/pnl-filter-bar"
import { PnlSummaryCards } from "@/components/portfolio/history/pnl/pnl-summary-cards"
import { PnlTaxSummaryCard } from "@/components/portfolio/history/pnl/pnl-tax-summary"
import { PnlExportDropdown } from "@/components/portfolio/history/pnl/pnl-export-dropdown"
import { PnlMethodPicker } from "@/components/portfolio/history/pnl/pnl-method-picker"
import { PnlGainsTable } from "@/components/portfolio/history/pnl/pnl-gains-table"
import { PnlCapitalFlowsSummary } from "@/components/portfolio/history/pnl/pnl-capital-flows"
import { PnlOpenLotsPanel } from "@/components/portfolio/history/pnl/pnl-open-lots"
import { PnlHarvestingPanel } from "@/components/portfolio/history/pnl/pnl-harvesting-panel"

const PortfolioLineChart = dynamic(
  () => import("@/components/portfolio/portfolio-line-chart").then((m) => ({ default: m.PortfolioLineChart })),
  { ssr: false, loading: () => <div className="h-[240px] bg-card-border/30 animate-pulse rounded-xl" /> }
)

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("all")
  const [taxYear, setTaxYear] = useState<string | null>(null)
  const [selectedWallets, setSelectedWallets] = useState<string[]>([])
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])

  const walletFilters = selectedWallets.length > 0 ? selectedWallets : undefined
  const assetFilters = selectedAssets.length > 0 ? selectedAssets : undefined

  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary(
    walletFilters, assetFilters, taxYear ? undefined : period, taxYear ?? undefined,
  )
  const { data: gains } = useRealizedGains(walletFilters, assetFilters, undefined, taxYear ?? undefined)
  const { data: lots } = useCostBasisLots(walletFilters, assetFilters)
  const { data: trackedAccountsData } = useTrackedAccounts()
  const computeCostBasis = useComputeCostBasis()

  const costBasisMethod = summary?.costBasisMethod ?? "FIFO"
  const availableYears = summary?.availableYears ?? []

  const handleMethodChange = useCallback(async (method: string) => {
    try {
      const res = await fetch("/api/portfolio/settings", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costBasisMethod: method }),
      })
      if (!res.ok) throw new Error("Failed to update method")
      computeCostBasis.mutate()
    } catch {
      toast.error("Failed to update cost basis method")
    }
  }, [computeCostBasis])

  const walletList = useMemo(() => {
    if (!trackedAccountsData || typeof trackedAccountsData !== "object") return []
    const seen = new Map<string, { address: string; label?: string | null }>()
    for (const chainAccounts of Object.values(trackedAccountsData)) {
      if (!Array.isArray(chainAccounts)) continue
      for (const acct of chainAccounts) {
        if (acct.address) {
          const key = acct.address.toLowerCase()
          if (!seen.has(key)) seen.set(key, { address: acct.address, label: acct.label ?? acct.name })
        }
      }
    }
    return [...seen.values()]
  }, [trackedAccountsData])

  const availableAssets = useMemo(() => summary?.filters?.assets ?? [], [summary])

  const chartData = useMemo(() => {
    if (!gains?.cumulativeSeries?.length) return null
    const sorted = [...gains.cumulativeSeries].sort((a: { time: number }, b: { time: number }) => a.time - b.time)
    const deduped = new Map<number, number>()
    for (const p of sorted) deduped.set(p.time, p.value)
    return Array.from(deduped.entries()).map(([time, value]) => ({ time: time as UTCTimestamp, value }))
  }, [gains])

  const chartPositive = chartData && chartData.length > 0 ? chartData[chartData.length - 1].value >= 0 : true
  const hasData = summary?.hasData === true
  const activeTaxYear = taxYear ?? new Date().getUTCFullYear().toString()

  // ─── No data state ───
  if (!summaryLoading && !hasData) {
    return (
      <div className="space-y-0">
        <PortfolioSubNav tabs={HISTORY_SUB_TABS} />
        <PortfolioPageHeader title="Analytics" subtitle="Cost-basis tracking and realized gains" />

        {computeCostBasis.isSuccess && (() => {
          const d = computeCostBasis.data as any
          const cLots = d?.lotsCreated ?? 0
          const disposals = d?.gainsRealized ?? 0
          const txCount = d?.transactionsProcessed ?? 0
          const pricesResolved = d?.pricesResolved ?? 0
          return (
            <div className={`bg-card border ${cLots > 0 ? "border-success/30" : "border-warning/30"} px-4 py-3 mt-4 flex items-center gap-3 rounded-xl`}>
              <span className={`material-symbols-rounded text-lg ${cLots > 0 ? "text-success" : "text-warning"}`}>
                {cLots > 0 ? "check_circle" : "info"}
              </span>
              <div className="text-sm">
                {cLots > 0 ? (
                  <p className="text-success">
                    Cost basis computed: {cLots} lots, {disposals} disposals from {txCount} transactions.
                    {pricesResolved > 0 && ` Resolved ${pricesResolved} missing prices.`}
                  </p>
                ) : txCount === 0 ? (
                  <p className="text-warning">
                    No transactions found. Sync your transaction history first — go to <strong>Activity → Events</strong> and wait for the sync to complete.
                  </p>
                ) : (
                  <p className="text-warning">
                    Processed {txCount} transactions but no acquisition lots were created. This can happen if all transactions are outgoing or if USD prices couldn&apos;t be resolved.
                    {pricesResolved > 0 && ` (${pricesResolved} prices were resolved)`}
                  </p>
                )}
              </div>
            </div>
          )
        })()}

        {computeCostBasis.isError && (
          <div className="bg-card border border-error/30 px-4 py-3 mt-4 flex items-center gap-3 rounded-xl">
            <span className="material-symbols-rounded text-error text-lg">error</span>
            <p className="text-sm text-error">
              {(computeCostBasis.error as Error)?.message ?? "Failed to compute cost basis"}
            </p>
          </div>
        )}

        <div className="bg-card border border-card-border flex flex-col items-center justify-center py-16 gap-4 mt-4 rounded-xl">
          <span className="material-symbols-rounded text-4xl text-foreground-muted">analytics</span>
          <p className="text-foreground text-base font-semibold">No Cost-Basis Data</p>
          <p className="text-foreground-muted text-center max-w-md text-sm">
            Compute your cost basis to see realized gains, unrealized positions, and capital flows.
            This processes all your cached transactions using FIFO lot matching.
          </p>
          <button
            onClick={() => computeCostBasis.mutate()}
            disabled={computeCostBasis.isPending}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl disabled:opacity-50 text-xs font-semibold tracking-wide"
          >
            <span className={`material-symbols-rounded text-sm ${computeCostBasis.isPending ? "animate-spin" : ""}`}>
              {computeCostBasis.isPending ? "progress_activity" : "calculate"}
            </span>
            {computeCostBasis.isPending ? "Computing..." : "Compute Cost Basis"}
          </button>
        </div>
      </div>
    )
  }

  // ─── Main content ───
  return (
    <div className="space-y-0">
      <PortfolioSubNav tabs={HISTORY_SUB_TABS} />
      <PortfolioPageHeader
        title="Analytics"
        subtitle="Cost-basis tracking and realized gains"
        actions={
          <div className="flex items-center gap-2">
            <PnlMethodPicker activeMethod={costBasisMethod} onMethodChange={handleMethodChange} isPending={computeCostBasis.isPending} />
            <button
              onClick={() => computeCostBasis.mutate()}
              disabled={computeCostBasis.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors disabled:opacity-50 rounded-xl text-xs font-medium tracking-wide"
            >
              <span className={`material-symbols-rounded text-sm ${computeCostBasis.isPending ? "animate-spin" : ""}`}>
                {computeCostBasis.isPending ? "progress_activity" : "refresh"}
              </span>
              {computeCostBasis.isPending ? "Recomputing..." : "Recompute"}
            </button>
            <PnlExportDropdown taxYear={activeTaxYear} wallets={walletFilters} assets={assetFilters} />
          </div>
        }
      />

      {/* Recompute banners */}
      {computeCostBasis.isPending && (
        <div className="bg-card border border-info/30 px-4 py-3 mt-2 mb-2 flex items-center gap-3 rounded-xl">
          <span className="material-symbols-rounded text-info text-lg animate-spin">progress_activity</span>
          <div>
            <p className="text-sm text-info font-semibold">Recomputing cost basis...</p>
            <p className="text-xs text-foreground-muted mt-0.5">Reclassifying transactions, resolving prices, and matching lots. Data below is stale.</p>
          </div>
        </div>
      )}
      {computeCostBasis.isSuccess && (
        <div className="bg-card border border-success/30 px-4 py-3 mt-2 mb-2 flex items-center gap-3 rounded-xl">
          <span className="material-symbols-rounded text-success text-lg">check_circle</span>
          <p className="text-sm text-success">
            Recomputed: {(computeCostBasis.data as any)?.lotsCreated ?? 0} lots, {(computeCostBasis.data as any)?.gainsRealized ?? 0} disposals, {formatFiatValue((computeCostBasis.data as any)?.totalRealizedGain ?? 0)} realized gain.
          </p>
        </div>
      )}
      {computeCostBasis.isError && (
        <div className="bg-card border border-error/30 px-4 py-3 mt-2 mb-2 flex items-center gap-3 rounded-xl">
          <span className="material-symbols-rounded text-error text-lg">error</span>
          <p className="text-sm text-error">{(computeCostBasis.error as Error)?.message ?? "Failed to recompute cost basis"}</p>
        </div>
      )}

      {/* Data sections */}
      <div className={`transition-opacity duration-300 ${computeCostBasis.isPending ? "opacity-40 pointer-events-none select-none" : ""}`}>
        <PnlFilterBar wallets={walletList} assets={availableAssets} selectedWallets={selectedWallets} selectedAssets={selectedAssets} onWalletsChange={setSelectedWallets} onAssetsChange={setSelectedAssets} />

        {/* Tax Year + Period selectors */}
        <div className="flex items-center gap-4 mb-4">
          {availableYears.length > 0 && (
            <div className="flex gap-1.5">
              {availableYears.map((y: number) => (
                <button key={y} onClick={() => setTaxYear(taxYear === String(y) ? null : String(y))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${taxYear === String(y) ? "bg-foreground text-background" : "text-foreground-muted hover:text-foreground hover:bg-card-border/30"}`}>
                  {y}
                </button>
              ))}
            </div>
          )}
          {availableYears.length > 0 && <div className="h-5 w-px bg-card-border" />}
          <div className="flex gap-1.5">
            {PERIODS.map((p) => (
              <button key={p.value} onClick={() => { setTaxYear(null); setPeriod(p.value) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!taxYear && period === p.value ? "bg-foreground text-background" : "text-foreground-muted hover:text-foreground hover:bg-card-border/30"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {summary && <PnlSummaryCards data={summary} />}
        {summary && <PnlTaxSummaryCard data={summary} costBasisMethod={costBasisMethod} taxYear={taxYear} />}

        {chartData && chartData.length > 1 && (
          <PortfolioChartCard title="CUMULATIVE REALIZED GAIN" isLoading={summaryLoading}>
            <div className="mb-1 px-6">
              {summary && (
                <>
                  <TextMorph
                    className={`font-data ${chartPositive ? "text-success" : "text-error"}`}
                    style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}
                    duration={600} ease="cubic-bezier(0.19, 1, 0.22, 1)"
                  >
                    {`${chartPositive ? "+" : ""}${formatFiatValue(summary.realized.totalGain)}`}
                  </TextMorph>
                  <p className="text-foreground-muted text-xs mt-1">{summary.realized.count} disposals</p>
                </>
              )}
            </div>
            <PortfolioLineChart data={chartData} height={240} color={chartPositive ? "positive" : "negative"} />
          </PortfolioChartCard>
        )}

        {summary && (summary.capitalFlows.depositCount > 0 || summary.capitalFlows.withdrawalCount > 0) && (
          <div className="mt-4"><PnlCapitalFlowsSummary data={summary} /></div>
        )}

        <PnlHarvestingPanel />
        <PnlGainsTable gains={gains} />
        <PnlOpenLotsPanel lots={lots} />
      </div>
    </div>
  )
}
