"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { ChainBadge } from "@/components/portfolio/chain-badge"
import { formatFiatValue, formatCryptoAmount } from "@/lib/portfolio/utils"
import { getChainMeta } from "@/lib/portfolio/chains"
import { portfolioFetch } from "@/hooks/portfolio/shared"
import type { StakingPosition } from "./staking-types"
import { ApySourceBadge, ConfidenceBadge, MaturityBadge, metricStatusLabel } from "./staking-badges"

export function PositionDetailModal({
  position,
  onClose,
}: {
  position: StakingPosition
  onClose: () => void
}) {
  const metricLabel = metricStatusLabel(position)
  const queryClient = useQueryClient()
  const [excluded, setExcluded] = useState(!!position.excludeFromYield)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const toggleExclude = async () => {
    setToggling(true)
    try {
      await portfolioFetch("/staking/exclude", {
        method: "PATCH",
        body: JSON.stringify({ positionKey: position.positionKey, exclude: !excluded }),
      })
      setExcluded(!excluded)
      queryClient.invalidateQueries({ queryKey: ["portfolio", "staking"] })
    } catch {
      toast.error("Failed to update position")
    } finally {
      setToggling(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="position-detail-title"
    >
      <div
        className="bg-card border border-card-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <PortfolioAssetIcon
              asset={position.underlying ?? position.symbol}
              chain={position.chain}
              iconUrl={position.iconUrl}
              size={36}
            />
            <div>
              <p id="position-detail-title" className="text-base font-semibold text-foreground">
                {position.underlying ?? position.symbol}
              </p>
              {position.protocol && (
                <span className="text-xs text-foreground-muted">{position.protocol}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-foreground-muted hover:text-foreground text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3">
          {/* Value */}
          <div className="flex justify-between text-sm">
            <span className="text-foreground-muted">Value</span>
            <span className="text-foreground font-data tabular-nums">
              {formatFiatValue(position.value)}
            </span>
          </div>

          {/* Amount */}
          <div className="flex justify-between text-sm">
            <span className="text-foreground-muted">Amount</span>
            <span className="text-foreground font-data tabular-nums">
              {formatCryptoAmount(position.quantity)} {position.symbol}
            </span>
          </div>

          {/* Economic yield metrics */}
          {position.depositedUsd !== undefined && position.depositedUsd > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-foreground-muted">Deposited</span>
              <span className="text-foreground font-data tabular-nums">
                {formatFiatValue(position.depositedUsd)}
              </span>
            </div>
          )}
          {position.yieldEarnedUsd !== undefined && position.yieldEarnedUsd !== null
            && !(position.status === "closed" && position.yieldMetricsState
              && position.yieldMetricsState !== "valid" && position.yieldMetricsState !== "clamped") && (
            <div className="flex justify-between text-sm">
              <span className="text-foreground-muted">Yield Earned</span>
              <span className={`font-data tabular-nums ${
                position.yieldEarnedUsd >= 0 ? "text-success" : "text-error"
              }`}>
                {formatFiatValue(position.yieldEarnedUsd)}
                {position.yieldEarnedPct !== null && position.yieldEarnedPct !== undefined && (
                  <span className="ml-1 text-xs">
                    ({position.yieldEarnedPct >= 0 ? "+" : ""}{position.yieldEarnedPct.toFixed(2)}%)
                  </span>
                )}
              </span>
            </div>
          )}
          {(position.dataConfidence || position.cacheState) && (
            <div className="flex justify-between text-sm items-center">
              <span className="text-foreground-muted">Data</span>
              <div className="flex items-center gap-2">
                <ConfidenceBadge confidence={position.dataConfidence} />
                {position.cacheState === "frozen" && (
                  <span className="text-[9px] font-medium text-info bg-info/10 px-1 py-0.5 rounded">
                    Frozen
                  </span>
                )}
              </div>
            </div>
          )}
          {position.confidenceReason && (
            <p className="text-xs text-foreground-muted">
              {position.confidenceReason}
            </p>
          )}
          {position.yieldMetricsReason && position.yieldMetricsState !== "valid" && (
            <p className="text-xs text-warning">
              {position.yieldMetricsReason}
            </p>
          )}

          {/* APY Breakdown */}
          {position.apy !== null && (
            <>
              <div className="border-t border-card-border my-2" />
              <p className="text-xs font-medium text-foreground-muted">APY Breakdown</p>
              <div className="flex justify-between text-sm">
                <span className="text-foreground-muted">Base APY</span>
                <span className="text-foreground font-data tabular-nums">
                  {(position.apyBase ?? 0).toFixed(2)}%
                </span>
              </div>
              {position.apyReward !== null && position.apyReward > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-muted">Reward APR</span>
                  <span className="text-foreground font-data tabular-nums">
                    +{position.apyReward.toFixed(2)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-medium">
                <span className="text-foreground-muted">Total APY</span>
                <span className="text-success font-data tabular-nums">
                  {position.apy.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground-muted">Source</span>
                <ApySourceBadge source={position.yieldSource} />
              </div>
            </>
          )}

          {/* Maturity */}
          {position.maturityDate && (
            <div className="flex justify-between text-sm items-center">
              <span className="text-foreground-muted">Maturity</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-data tabular-nums text-xs">
                  {new Date(position.maturityDate).toLocaleDateString()}
                </span>
                <MaturityBadge date={position.maturityDate} />
              </div>
            </div>
          )}

          {/* Contract */}
          {position.contractAddress && (() => {
            const explorerBase = getChainMeta(position.chain)?.explorerUrl
            const contractUrl = explorerBase ? `${explorerBase}/address/${position.contractAddress}` : null
            const truncated = `${position.contractAddress.slice(0, 6)}...${position.contractAddress.slice(-4)}`
            return (
              <>
                <div className="border-t border-card-border my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-muted">Contract</span>
                  {contractUrl ? (
                    <a
                      href={contractUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline font-mono text-xs"
                    >
                      {truncated}
                    </a>
                  ) : (
                    <span className="text-foreground font-mono text-xs">{truncated}</span>
                  )}
                </div>
              </>
            )
          })()}

          {/* Chain */}
          <div className="flex justify-between text-sm items-center">
            <span className="text-foreground-muted">Chain</span>
            <ChainBadge chainId={position.chain} size="sm" />
          </div>

          {/* Exclude from yield toggle */}
          <div className="border-t border-card-border my-2" />
          <div className="flex justify-between text-sm items-center">
            <div>
              <span className="text-foreground-muted">Exclude from yield totals</span>
              <p className="text-[10px] text-foreground-muted mt-0.5">
                {excluded ? "This position is excluded from earned totals" : "Include in all yield calculations"}
              </p>
            </div>
            <button
              onClick={toggleExclude}
              disabled={toggling}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                excluded ? "bg-warning" : "bg-card-border"
              } ${toggling ? "opacity-50" : ""}`}
              aria-label={excluded ? "Include in yield totals" : "Exclude from yield totals"}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  excluded ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
