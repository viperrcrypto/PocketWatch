import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { ChainBadge } from "@/components/portfolio/chain-badge"
import type { Column } from "@/components/portfolio/portfolio-data-table"
import { formatFiatValue, formatCryptoAmount } from "@/lib/portfolio/utils"
import type { StakingPosition } from "./staking-types"
import { ApySourceBadge, MaturityBadge, metricStatusLabel, formatShortDate } from "./staking-badges"

// ─── Table columns ───

export const POSITION_COLUMNS: Column<StakingPosition>[] = [
  {
    key: "asset",
    header: "Asset",
    accessor: (row) => (
      <div className="flex items-center gap-3 min-w-0">
        <PortfolioAssetIcon
          asset={row.underlying ?? row.symbol}
          chain={row.chain}
          iconUrl={row.iconUrl}
          size={32}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-foreground truncate">
              {row.underlying ?? row.symbol}
            </p>
            {row.maturityDate && <MaturityBadge date={row.maturityDate} />}
            {row.cacheState === "frozen" && (
              <span className="text-[9px] font-medium text-info bg-info/10 px-1 py-0.5 rounded">
                Frozen
              </span>
            )}
            {row.dataConfidence && row.dataConfidence !== "exact" && (
              <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${
                row.dataConfidence === "modeled"
                  ? "text-warning bg-warning/10"
                  : "text-error bg-error/10"
              }`}>
                {row.dataConfidence === "modeled" ? "Modeled" : "Estimated"}
              </span>
            )}
          </div>
          {row.protocol && (
            <span className="text-[10px] font-medium text-foreground-muted bg-background-secondary px-1.5 py-0.5 rounded">
              {row.protocol}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "quantity",
    header: "Amount",
    align: "right",
    sortable: true,
    accessor: (row) => (
      <span className="text-sm font-data text-foreground tabular-nums">
        {formatCryptoAmount(row.quantity)}
      </span>
    ),
  },
  {
    key: "value",
    header: "Value",
    align: "right",
    sortable: true,
    accessor: (row) => (
      <span className="text-sm font-data text-foreground tabular-nums">
        {formatFiatValue(row.value)}
      </span>
    ),
  },
  {
    key: "depositedUsd",
    header: "Deposited",
    align: "right",
    sortable: true,
    accessor: (row) =>
      row.depositedUsd !== undefined && row.depositedUsd > 0 ? (
        <span className="text-sm font-data text-foreground tabular-nums">
          {formatFiatValue(row.depositedUsd)}
        </span>
      ) : row.yieldMetricsState && row.yieldMetricsState !== "valid" ? (
        <span className="text-xs text-foreground-muted">{metricStatusLabel(row)}</span>
      ) : (
        <span className="text-sm text-foreground-muted">{"\u2014"}</span>
      ),
  },
  {
    key: "yieldEarnedUsd",
    header: "Earned",
    align: "right",
    sortable: true,
    accessor: (row) => {
      if (row.yieldEarnedUsd === undefined || row.yieldEarnedUsd === null) {
        return <span className="text-sm text-foreground-muted">{"\u2014"}</span>
      }
      if (
        row.status === "closed"
        && row.yieldMetricsState
        && row.yieldMetricsState !== "valid"
        && row.yieldMetricsState !== "clamped"
      ) {
        return <span className="text-sm text-foreground-muted">{"\u2014"}</span>
      }
      const colorClass = row.excludeFromYield
        ? "text-foreground-muted line-through"
        : row.yieldEarnedUsd >= 0 ? "text-success" : "text-error"
      return (
        <div className="flex flex-col items-end gap-0.5">
          <span className={`text-sm font-data tabular-nums ${colorClass}`}>
            {formatFiatValue(row.yieldEarnedUsd)}
          </span>
          {row.excludeFromYield ? (
            <span className="text-[9px] font-medium text-warning bg-warning/10 px-1 py-0.5 rounded">
              Excluded
            </span>
          ) : row.yieldEarnedPct !== null && row.yieldEarnedPct !== undefined ? (
            <span className={`text-[10px] font-data tabular-nums ${
              row.yieldEarnedUsd >= 0 ? "text-success" : "text-error"
            }`}>
              {row.yieldEarnedPct >= 0 ? "+" : ""}{row.yieldEarnedPct.toFixed(2)}%
            </span>
          ) : null}
        </div>
      )
    },
  },
  {
    key: "apy",
    header: "APY",
    align: "right",
    sortable: true,
    accessor: (row) => {
      const isExpired = row.maturityDate && new Date(row.maturityDate) < new Date()
      return row.apy !== null ? (
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-sm font-data text-success tabular-nums">
            {row.apy.toFixed(2)}%
          </span>
          {isExpired ? (
            <span className="text-[9px] font-medium text-error bg-error/10 px-1 py-0.5 rounded">
              Expired
            </span>
          ) : (
            <ApySourceBadge source={row.yieldSource} />
          )}
        </div>
      ) : (
        <span className="text-sm text-foreground-muted">{"\u2014"}</span>
      )
    },
  },
  {
    key: "annualYield",
    header: "Est. Annual",
    align: "right",
    sortable: true,
    accessor: (row) =>
      row.annualYield !== null ? (
        <span className="text-sm font-data text-foreground tabular-nums">
          {formatFiatValue(row.annualYield)}
        </span>
      ) : (
        <span className="text-sm text-foreground-muted">{"\u2014"}</span>
      ),
  },
  {
    key: "chain",
    header: "Chain",
    align: "center",
    accessor: (row) => <ChainBadge chainId={row.chain} size="sm" />,
  },
]

export const ACTIVE_COLUMNS: Column<StakingPosition>[] = [
  ...POSITION_COLUMNS,
  {
    key: "openedAt",
    header: "Opened",
    align: "right",
    accessor: (row) => (
      <span className="text-xs font-data text-foreground-muted tabular-nums">
        {formatShortDate(row.openedAt)}
      </span>
    ),
  },
]

export const INACTIVE_COLUMNS: Column<StakingPosition>[] = [
  ...POSITION_COLUMNS,
  {
    key: "openedAt",
    header: "Opened",
    align: "right",
    accessor: (row) => (
      <span className="text-xs font-data text-foreground-muted tabular-nums">
        {formatShortDate(row.openedAt)}
      </span>
    ),
  },
  {
    key: "closedAt",
    header: "Closed",
    align: "right",
    accessor: (row) => (
      <span className="text-xs font-data text-foreground-muted tabular-nums">
        {formatShortDate(row.closedAt)}
      </span>
    ),
  },
]
