"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { useQueryClient } from "@tanstack/react-query"
import {
  usePortfolioOverview,
  useBlockchainBalances,
  useNetValueHistory,
  useRefreshBalances,
  useTaskStatus,
  useAssetMappings,
  useLatestPrices,
  useTrackedAccounts,
  useSyncProgress,
} from "@/hooks/use-portfolio-tracker"
import { formatFiatValue } from "@/lib/portfolio/utils"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { ChainAllocationBar } from "@/components/portfolio/chain-allocation-bar"
import { ApiKeysBanner } from "@/components/portfolio/api-keys-banner"
import { OverviewStatCard } from "@/components/portfolio/overview-stat-card"
import { SyncButton } from "@/components/portfolio/sync-button"
import { QuickActionsGrid } from "@/components/portfolio/quick-actions-grid"
import { ChartPointDetail } from "@/components/portfolio/chart-point-detail"

const ExpandableAssetTable = dynamic(
  () => import("@/components/portfolio/expandable-asset-table").then((m) => m.ExpandableAssetTable),
  { ssr: false }
)
const ChartHeroSection = dynamic(
  () => import("@/components/portfolio/chart-hero-section").then((m) => m.ChartHeroSection),
  { ssr: false }
)
import {
  TIMEFRAMES,
  CHART_SCOPES,
  parseSnapshotMeta,
  type Timeframe,
  type ChartScope,
} from "@/lib/portfolio/overview-helpers"
import {
  useTotalValue,
  useOnchainValue,
  useAssetData,
  useBlockchainAssets,
  useMergedAssets,
  useIconMap,
  usePricesMap,
  useLocationData,
} from "@/hooks/use-portfolio-dashboard"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"
import { FadeIn } from "@/components/motion/fade-in"
import {
  useChartData,
  usePeriodChange,
  useChartStats,
  useHoverDelta,
  useChange24h,
  useHistoryWarning,
} from "@/hooks/use-portfolio-chart-data"
import { useSyncStatus, useWalletInfoList } from "@/hooks/use-portfolio-sync-status"

export function PortfolioDashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>("ALL")
  const chartScope: ChartScope = "total"
  const {
    data: overview,
    isLoading: balancesLoading,
    isError: balancesError,
    error: overviewError,
    dataUpdatedAt,
  } = usePortfolioOverview()
  const {
    data: blockchainData,
    isLoading: blockchainLoading,
    isError: blockchainError,
  } = useBlockchainBalances()
  const { data: netValue, isLoading: netValueLoading } = useNetValueHistory(timeframe, chartScope)
  const { data: netValue1D } = useNetValueHistory("1D", chartScope)
  const { data: syncProgress } = useSyncProgress({ advance: true, reconstruct: true, autoStart: true })
  const { data: pricesData } = useLatestPrices()
  const { data: trackedAccounts } = useTrackedAccounts()
  const refresh = useRefreshBalances()
  const [refreshTaskId, setRefreshTaskId] = useState<string | null>(null)
  const { data: taskStatus } = useTaskStatus(refreshTaskId)
  const { isHidden, togglePrivacy } = usePrivacyMode()
  const [hoveredPoint, setHoveredPoint] = useState<{ time: number; value: number } | null>(null)
  const [clickedPoint, setClickedPoint] = useState<{ time: number; value: number } | null>(null)
  const isRefreshing = refresh.isPending || (refreshTaskId && taskStatus?.status === "pending")
  const [refreshCooldown, setRefreshCooldown] = useState(false)
  const queryClient = useQueryClient()

  // When a refresh task completes, re-fetch all data
  const prevTaskStatus = useRef<string | undefined>(undefined)
  useEffect(() => {
    const status = taskStatus?.status
    if (prevTaskStatus.current === "pending" && status && status !== "pending") {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] })
      setRefreshTaskId(null)
    }
    prevTaskStatus.current = status
  }, [taskStatus?.status, queryClient])

  // When sync job transitions to completed, refetch chart data
  const prevSyncStatus = useRef<string | undefined>(undefined)
  useEffect(() => {
    const jobStatus = syncProgress?.job?.status
    const wasRunning = prevSyncStatus.current === "running" || prevSyncStatus.current === "queued"
    const nowDone = jobStatus === "completed" || jobStatus === "partial"
    if (wasRunning && nowDone) {
      queryClient.invalidateQueries({ queryKey: ["portfolio", "history", "snapshots"] })
    }
    // Also refetch chart when allComplete flips to true
    if (syncProgress?.allComplete && prevSyncStatus.current) {
      queryClient.invalidateQueries({ queryKey: ["portfolio", "history", "snapshots"] })
    }
    prevSyncStatus.current = jobStatus
  }, [syncProgress?.job?.status, syncProgress?.allComplete, queryClient])

  // ─── Derived state via hooks ───
  const { totalValue, balancesSettled, bothSourcesLoading } = useTotalValue(overview, balancesLoading, blockchainLoading)
  const isLoading = bothSourcesLoading && netValueLoading && totalValue === 0
  const headlineLoading = !balancesSettled && totalValue === 0
  const hasError = balancesError && blockchainError && totalValue === 0

  const onchainValue = useOnchainValue(overview, totalValue)
  const { aggregatedAssets, overviewAssets } = useAssetData(overview)
  const blockchainAssets = useBlockchainAssets(blockchainData)
  const topAssets = useMergedAssets(overviewAssets, blockchainAssets)
  const assetsTotal = useMemo(() => topAssets.reduce((sum, a) => sum + a.usd_value, 0), [topAssets])

  const effectiveTotalValue = totalValue > 0 ? totalValue : assetsTotal > 0 ? assetsTotal : 0
  const iconMap = useIconMap(overview, blockchainData)
  const pricesMap = usePricesMap(pricesData)
  const locationData = useLocationData(overview, topAssets)
  const activeChains = Object.keys(locationData).length

  // ─── Chart ───
  const chartMeta = useMemo(() => parseSnapshotMeta(netValue), [netValue])
  const chartData = useChartData(netValue, chartScope, effectiveTotalValue, onchainValue)
  const chartLatestValue = useMemo(
    () => (chartData.length === 0 ? 0 : chartData[chartData.length - 1].value),
    [chartData],
  )
  const periodChange = usePeriodChange(chartData)
  const chartStats = useChartStats(chartData)
  const hoverDelta = useHoverDelta(hoveredPoint, chartData)
  const change24h = useChange24h(netValue1D, effectiveTotalValue, (overview as any)?.isPartialFetch)

  useEffect(() => { setHoveredPoint(null); setClickedPoint(null) }, [timeframe, chartScope, chartLatestValue])

  // Find the previous chart point value for the clicked point (used in detail panel)
  const clickedPreviousValue = useMemo(() => {
    if (!clickedPoint || chartData.length < 2) return null
    const idx = chartData.findIndex((p) => (p.time as number) === clickedPoint.time)
    if (idx > 0) return chartData[idx - 1].value
    return null
  }, [clickedPoint, chartData])

  const chartColor: "neutral" | "positive" | "negative" = periodChange
    ? (periodChange.positive ? "positive" : "negative")
    : "neutral"

  const chartDisplayValue = effectiveTotalValue > 0
    ? effectiveTotalValue
    : (balancesSettled && chartLatestValue > 0 ? chartLatestValue : 0)

  const historyWarning = useHistoryWarning(chartMeta, chartScope)

  // ─── Asset resolution ───
  const assetIds = useMemo(() => topAssets.map((a) => a.asset), [topAssets])
  const hasCaipIds = assetIds.some((id) => id.includes("/"))
  const { data: assetMappings, isLoading: mappingsLoading } = useAssetMappings(assetIds)
  const isResolvingNames = hasCaipIds && mappingsLoading

  // ─── Sync status ───
  const syncStatus = useSyncStatus(overview, syncProgress)

  // ─── Refresh handler ───
  const tokenRefreshTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    return () => { for (const t of tokenRefreshTimers.current) clearTimeout(t) }
  }, [])

  const handleRefresh = useCallback(() => {
    if (refreshCooldown) return
    setRefreshCooldown(true)
    setTimeout(() => setRefreshCooldown(false), 5000)

    refresh.mutate(undefined, {
      onSuccess: (data: { task_id?: string; _tokenDetectionTriggered?: boolean }) => {
        if (data?.task_id) setRefreshTaskId(String(data.task_id))
        if (data?._tokenDetectionTriggered) {
          for (const t of tokenRefreshTimers.current) clearTimeout(t)
          tokenRefreshTimers.current = []
          tokenRefreshTimers.current.push(
            setTimeout(() => { queryClient.invalidateQueries({ queryKey: ["portfolio"] }) }, 15_000),
          )
          tokenRefreshTimers.current.push(
            setTimeout(() => { queryClient.invalidateQueries({ queryKey: ["portfolio"] }) }, 40_000),
          )
        }
      },
    })
  }, [refresh, refreshCooldown, queryClient])

  const walletInfoList = useWalletInfoList(overview, trackedAccounts)

  return (
    <div className="space-y-5">
      <ApiKeysBanner />

      {hasError && !isLoading && (
        <div className="bg-card border border-warning/25 px-5 py-3 flex items-center gap-3 rounded-xl" style={{ borderLeft: "2px solid var(--warning)" }}>
          <span className="material-symbols-rounded text-warning text-lg">key</span>
          <p className="text-sm text-foreground-muted">
            Add your <strong className="text-foreground">Zerion API key</strong> in Settings to load wallet balances, portfolio history, and staking data.
          </p>
          <a href="/portfolio/settings" className="ml-auto flex-shrink-0 btn-primary text-xs" style={{ height: 32, padding: "0 14px" }}>Add API Key</a>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-foreground font-semibold">Portfolio Dashboard</h1>
          {dataUpdatedAt > 0 && (
            <p className="text-foreground-muted mt-0.5 text-[10px]">
              Last synced: {new Date(dataUpdatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
            </p>
          )}
        </div>
        <SyncButton syncStatus={syncStatus} syncProgress={syncProgress} isRefreshing={isRefreshing} refreshCooldown={refreshCooldown} onRefresh={handleRefresh} />
      </div>

      <ChartHeroSection
        timeframes={TIMEFRAMES} timeframe={timeframe} onTimeframeChange={(tf) => setTimeframe(tf as Timeframe)}
        chartScopes={CHART_SCOPES} chartScope={chartScope} onChartScopeChange={() => {}}
        isLoading={isLoading} headlineLoading={headlineLoading} isHidden={isHidden} togglePrivacy={togglePrivacy}
        chartDisplayValue={chartDisplayValue} hoveredPoint={hoveredPoint} onCrosshairMove={setHoveredPoint}
        onPointClick={setClickedPoint}
        periodChange={periodChange} hoverDelta={hoverDelta} chartData={chartData} chartColor={chartColor}
        chartStats={chartStats} historyWarning={historyWarning} syncStatus={syncStatus}
      />

      <StaggerChildren className="grid grid-cols-2 lg:grid-cols-4 gap-3" staggerMs={60}>
        <StaggerItem>
          <OverviewStatCard label="Total Value" value={formatFiatValue(effectiveTotalValue)} icon="account_balance" isLoading={headlineLoading} accentColor="#ffffff" isHidden={isHidden} />
        </StaggerItem>
        <StaggerItem>
          <OverviewStatCard
            label="24h Change"
            value={change24h ? `${change24h.positive ? "+" : ""}${formatFiatValue(change24h.delta)}` : "--"}
            change={change24h ? { value: `${change24h.positive ? "+" : ""}${change24h.pct.toFixed(2)}%`, positive: change24h.positive } : undefined}
            icon="trending_up" isLoading={headlineLoading}
            accentColor={change24h ? (change24h.positive ? "var(--success)" : "var(--error)") : "#2a2a2a"}
            isHidden={isHidden}
          />
        </StaggerItem>
        <StaggerItem>
          <OverviewStatCard label="Total Assets" value={bothSourcesLoading ? "..." : String(topAssets.length)} icon="token" isLoading={bothSourcesLoading} />
        </StaggerItem>
        <StaggerItem>
          <OverviewStatCard label="Active Chains" value={bothSourcesLoading ? "..." : String(activeChains)} icon="device_hub" isLoading={bothSourcesLoading} />
        </StaggerItem>
      </StaggerChildren>

      {Object.keys(locationData).length > 0 && (
        <FadeIn delay={0.15}>
          <ChainAllocationBar locations={locationData} totalValue={effectiveTotalValue} isHidden={isHidden} />
        </FadeIn>
      )}

      <FadeIn delay={0.2}>
        <QuickActionsGrid />
      </FadeIn>

      <FadeIn delay={0.25}>
        <ExpandableAssetTable
        assets={aggregatedAssets} totalValue={effectiveTotalValue} iconMap={iconMap} pricesMap={pricesMap}
        assetMappings={assetMappings} wallets={walletInfoList} isLoading={bothSourcesLoading}
        isResolvingNames={isResolvingNames} overview={overview} blockchainData={blockchainData}
        trackedAccounts={trackedAccounts} balancesError={balancesError} overviewError={overviewError}
        onRefresh={handleRefresh} isRefreshing={!!isRefreshing} refreshCooldown={refreshCooldown} isHidden={isHidden}
      />
      </FadeIn>

      {clickedPoint && (
        <ChartPointDetail
          timestamp={clickedPoint.time}
          value={clickedPoint.value}
          previousValue={clickedPreviousValue}
          onClose={() => setClickedPoint(null)}
        />
      )}
    </div>
  )
}
