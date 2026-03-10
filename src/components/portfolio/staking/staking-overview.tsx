"use client"

import { useMemo, useState } from "react"
import { useStakingPositions, useRefreshStaking, useRebuildStaking } from "@/hooks/use-portfolio-tracker"
import { PortfolioStatCard } from "@/components/portfolio/portfolio-stat-card"
import { PortfolioDataTable } from "@/components/portfolio/portfolio-data-table"
import { CollapsibleSection } from "@/components/ui/collapsible-section"
import { EmptyState } from "@/components/ui/empty-state"
import { formatFiatValue } from "@/lib/portfolio/utils"
import { YieldHistoryModal } from "@/components/portfolio/staking-history"
import type { StakingPosition, OnChainReward } from "./staking-types"
import { getSortableValue, FreshnessIndicator } from "./staking-badges"
import { ProtocolAllocationBar } from "./staking-protocol-bar"
import { PositionDetailModal } from "./staking-detail-modal"
import { POSITION_COLUMNS, ACTIVE_COLUMNS, INACTIVE_COLUMNS } from "./staking-columns"
import { ZerionRewardsSection, AaveRewardsSection } from "./staking-rewards"
import { StakingDataQuality } from "./staking-data-quality"

// ─── Exported StakingView ───

export function StakingView() {
  const { data, isLoading, isError } = useStakingPositions()
  const refreshMutation = useRefreshStaking()
  const rebuildMutation = useRebuildStaking()
  const [sortKey, setSortKey] = useState("value")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [detailPosition, setDetailPosition] = useState<StakingPosition | null>(null)
  const [showYieldHistory, setShowYieldHistory] = useState(false)

  const positions = useMemo(() => {
    if (!data?.positions) return [] as StakingPosition[]
    const list = data.positions as StakingPosition[]
    return [...list].sort((a, b) => {
      const aNum = getSortableValue(a, sortKey)
      const bNum = getSortableValue(b, sortKey)
      return sortDir === "asc" ? aNum - bNum : bNum - aNum
    })
  }, [data, sortKey, sortDir])

  const inactivePositions = useMemo(() => {
    if (!data?.inactivePositions) return [] as StakingPosition[]
    return data.inactivePositions as StakingPosition[]
  }, [data])

  const pastPositions = useMemo(() => {
    if (!data?.pastPositions) return [] as StakingPosition[]
    return data.pastPositions as StakingPosition[]
  }, [data])

  const zerionRewards = useMemo(
    () => (data?.rewards ?? []) as StakingPosition[],
    [data]
  )

  const onChainRewards = useMemo(
    () => (data?.onChainRewards ?? []) as OnChainReward[],
    [data]
  )

  const totalStaked = (data?.totalStaked as number) ?? 0
  const totalDailyYield = (data?.totalDailyYield as number) ?? 0
  const totalAnnualYield = (data?.totalAnnualYield as number) ?? 0
  const yieldEarnedAllTimeUsd = (data?.yieldEarnedAllTimeUsd as number) ?? 0
  const yieldEarnedYtdUsd = (data?.yieldEarnedYtdUsd as number) ?? 0
  const avgApy = (data?.avgApy as number) ?? 0
  const protocolBreakdown = (data?.protocolBreakdown as Record<string, number>) ?? {}
  const lifecycleStatus = (data?.lifecycleStatus as "ready" | "recomputing" | undefined) ?? "recomputing"
  const rebuildInProgress = Boolean(data?.rebuildInProgress)
  const fetchedAt = (data?.fetchedAt as string) ?? null
  const walletsTotal = (data?.walletsTotal as number) ?? 0
  const walletsFetched = (data?.walletsFetched as number) ?? 0
  const hasAnyPositions = positions.length > 0 || inactivePositions.length > 0
  const hasReliableLifecycleMetrics = lifecycleStatus === "ready"
  const confidenceCounts = (data?.confidenceCounts as { exact: number; modeled: number; estimated: number; total: number } | undefined) ?? null

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const handleRowClick = (row: StakingPosition) => {
    setDetailPosition(row)
  }

  const handleRefresh = () => {
    refreshMutation.mutate()
  }

  // Loading state
  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center gap-3 py-6">
          <span className="material-symbols-rounded text-info animate-spin" style={{ fontSize: 20 }}>progress_activity</span>
          <span className="text-sm text-foreground-muted">Loading staking positions across all wallets...</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <PortfolioStatCard key={i} label="" value="" isLoading />
          ))}
        </div>
        <PortfolioDataTable columns={POSITION_COLUMNS} data={[]} isLoading />
      </>
    )
  }

  // Error state
  if (isError) {
    return (
      <EmptyState
        icon="error"
        title="Failed to Load"
        description="Unable to fetch staking positions. Check your Zerion API key in Settings and try again."
        action={{ label: "Go to Settings", href: "/portfolio/settings" }}
        variant="error"
      />
    )
  }

  // No API key
  if (data?.error === "no_api_key") {
    return (
      <EmptyState
        icon="key"
        title="Zerion API Key Required"
        description="Add your Zerion API key in Settings to view staking positions across all chains."
        action={{ label: "Add API Key", href: "/portfolio/settings" }}
        variant="info"
      />
    )
  }

  // Empty state
  if (positions.length === 0 && inactivePositions.length === 0 && pastPositions.length === 0 && zerionRewards.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="No DeFi Positions"
        description="You don't have any staked, deposited, or locked positions yet. Deposit into DeFi protocols like Aave, Lido, or Rocket Pool to see them here."
      />
    )
  }

  return (
    <>
      {/* Header with refresh */}
      <div className="flex items-center justify-end gap-3">
        <FreshnessIndicator fetchedAt={fetchedAt} />
        <button
          onClick={() => rebuildMutation.mutate()}
          disabled={rebuildMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warning hover:text-warning/80 bg-background-secondary hover:bg-card border border-card-border rounded-lg transition-all disabled:opacity-50"
        >
          <span
            className={`material-symbols-rounded text-sm ${rebuildMutation.isPending ? "animate-spin" : ""}`}
            style={{ fontSize: 14 }}
          >
            construction
          </span>
          {rebuildMutation.isPending ? "Rebuilding..." : "Rebuild"}
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground bg-background-secondary hover:bg-card border border-card-border rounded-lg transition-all disabled:opacity-50"
        >
          <span
            className={`material-symbols-rounded text-sm ${refreshMutation.isPending ? "animate-spin" : ""}`}
            style={{ fontSize: 14 }}
          >
            refresh
          </span>
          {refreshMutation.isPending ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Data quality — only shows when there are issues */}
      {hasAnyPositions && (
        <StakingDataQuality
          positions={positions}
          inactivePositions={inactivePositions}
          confidenceCounts={confidenceCounts}
          rebuildInProgress={rebuildInProgress}
          hasReliableLifecycleMetrics={hasReliableLifecycleMetrics}
        />
      )}

      {/* Partial data warning */}
      {walletsTotal > 0 && walletsFetched < walletsTotal && (
        <div className="bg-card border border-warning/30 px-4 py-3 flex items-center gap-3 rounded-xl">
          <span className="material-symbols-rounded text-warning text-lg">warning</span>
          <p className="text-sm text-warning">
            Showing partial data — {walletsFetched} of {walletsTotal} wallets loaded. Zerion rate limit hit. Refresh in a minute.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3 min-[1800px]:grid-cols-6 gap-4">
        <PortfolioStatCard icon="trending_up" label="Total Staked" value={formatFiatValue(totalStaked)} />
        <PortfolioStatCard
          icon="payments"
          label="Annual Yield"
          value={formatFiatValue(totalAnnualYield)}
          change={avgApy > 0 ? { value: `${avgApy.toFixed(1)}% APY`, positive: true } : undefined}
        />
        <PortfolioStatCard icon="schedule" label="Daily Yield" value={formatFiatValue(totalDailyYield)} />
        <PortfolioStatCard
          icon="insights"
          label="Yield Earned (All-Time)"
          value={hasReliableLifecycleMetrics ? formatFiatValue(yieldEarnedAllTimeUsd) : "Recomputing..."}
        />
        <PortfolioStatCard
          icon="calendar_month"
          label="Yield Earned (YTD)"
          value={hasReliableLifecycleMetrics ? formatFiatValue(yieldEarnedYtdUsd) : "Recomputing..."}
        />
        <PortfolioStatCard
          icon="show_chart"
          label="Yield History"
          value={`${formatFiatValue(totalAnnualYield)}/yr`}
          change={{ value: "View history", positive: true }}
          onClick={() => setShowYieldHistory(true)}
          className="cursor-pointer hover:border-card-border-hover transition-all"
        />
      </div>

      {/* Protocol Allocation */}
      {Object.keys(protocolBreakdown).length > 1 && (
        <ProtocolAllocationBar breakdown={protocolBreakdown} totalValue={totalStaked} />
      )}

      {/* Active Positions Table */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-sm font-semibold text-foreground">Active Positions</h2>
          <span className="hidden md:block text-[11px] text-foreground-muted">Scroll horizontally to see all columns</span>
        </div>
        <p className="text-[11px] text-foreground-muted mb-2">
          Earned reflects real staking yield. Volatile assets (ETH, BTC) use native-token math; stablecoins use USD.
        </p>
        <PortfolioDataTable
          columns={ACTIVE_COLUMNS}
          data={positions}
          tableClassName="min-w-[950px]"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={handleRowClick}
          emptyMessage="No active DeFi positions"
          emptyIcon="layers"
          getRowKey={(row) => row.positionKey}
        />
      </div>

      {/* Claimable Rewards */}
      <ZerionRewardsSection rewards={zerionRewards} />
      <AaveRewardsSection rewards={onChainRewards} />

      {/* Inactive Positions */}
      {inactivePositions.length > 0 && (
        <CollapsibleSection
          title="Closed / Inactive Positions"
          icon="archive"
          badge={inactivePositions.length}
          defaultOpen
          className="rounded-xl"
        >
          <PortfolioDataTable
            columns={INACTIVE_COLUMNS}
            data={inactivePositions}
            tableClassName="min-w-[1050px]"
            onRowClick={handleRowClick}
            emptyMessage="No inactive positions"
            emptyIcon="archive"
          />
        </CollapsibleSection>
      )}

      {/* Past Positions (from snapshots) */}
      {pastPositions.length > 0 && (
        <CollapsibleSection title="Past Positions" icon="history" badge={pastPositions.length} className="rounded-xl">
          <PortfolioDataTable
            columns={POSITION_COLUMNS}
            data={pastPositions}
            tableClassName="min-w-[1200px]"
            onRowClick={handleRowClick}
            emptyMessage="No past positions"
            emptyIcon="history"
          />
        </CollapsibleSection>
      )}

      {/* Yield History Modal */}
      {showYieldHistory && <YieldHistoryModal onClose={() => setShowYieldHistory(false)} />}

      {/* Position Detail Modal */}
      {detailPosition && <PositionDetailModal position={detailPosition} onClose={() => setDetailPosition(null)} />}
    </>
  )
}
