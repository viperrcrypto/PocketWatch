"use client"

import { useMemo, useState } from "react"
import { useRebuildStaking, useTriggerHistorySync } from "@/hooks/use-portfolio-tracker"
import type { StakingPosition } from "./staking-types"

interface DataQualityProps {
  positions: StakingPosition[]
  inactivePositions: StakingPosition[]
  confidenceCounts: { exact: number; modeled: number; estimated: number; total: number } | null
  rebuildInProgress: boolean
  hasReliableLifecycleMetrics: boolean
}

export function StakingDataQuality({
  positions,
  inactivePositions,
  confidenceCounts,
  rebuildInProgress,
  hasReliableLifecycleMetrics,
}: DataQualityProps) {
  const [expanded, setExpanded] = useState(false)
  const rebuildMutation = useRebuildStaking()
  const syncMutation = useTriggerHistorySync()

  const needsAttention = useMemo(() => {
    return [...positions, ...inactivePositions].filter(
      (p) => p.yieldMetricsState && p.yieldMetricsState !== "valid" && p.yieldMetricsState !== "clamped",
    )
  }, [positions, inactivePositions])

  const estimatedPositions = useMemo(() => {
    return [...positions, ...inactivePositions].filter((p) => p.dataConfidence === "estimated")
  }, [positions, inactivePositions])

  const hasIssues = needsAttention.length > 0 || estimatedPositions.length > 0 || rebuildInProgress
  const allExact = confidenceCounts && confidenceCounts.modeled === 0 && confidenceCounts.estimated === 0

  // Nothing to show — all data is clean
  if (!hasIssues && (allExact || !confidenceCounts)) return null

  // Modeled-only (no action needed) — subtle inline indicator
  if (!hasIssues && confidenceCounts && confidenceCounts.modeled > 0) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-foreground-muted">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-info" />
        {confidenceCounts.modeled} position{confidenceCounts.modeled !== 1 ? "s" : ""} use modeled yield
        (no exact tx match — still accurate)
      </div>
    )
  }

  // Actionable issues — show a banner
  const affectedPositions = [...new Map(
    [...needsAttention, ...estimatedPositions].map((p) => [p.positionKey, p]),
  ).values()]

  return (
    <div className="bg-card border border-warning/20 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-rounded text-warning mt-0.5" style={{ fontSize: 16 }}>
            data_alert
          </span>
          <div>
            <p className="text-xs font-medium text-foreground">
              {rebuildInProgress
                ? "Rebuilding yield history — totals will update when done"
                : `${affectedPositions.length} position${affectedPositions.length !== 1 ? "s" : ""} missing yield data`}
            </p>
            {!rebuildInProgress && (
              <p className="text-[11px] text-foreground-muted mt-0.5">
                Yield earned is approximate until transaction history is synced.
              </p>
            )}
          </div>
        </div>
        {!rebuildInProgress && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => rebuildMutation.mutate()}
              disabled={rebuildMutation.isPending}
              className="text-[11px] font-medium text-warning hover:text-warning/80 disabled:opacity-50"
            >
              {rebuildMutation.isPending ? "Rebuilding..." : "Rebuild"}
            </button>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="text-[11px] font-medium text-info hover:text-info/80 disabled:opacity-50"
            >
              {syncMutation.isPending ? "Syncing..." : "Sync History"}
            </button>
          </div>
        )}
      </div>

      {affectedPositions.length > 0 && !rebuildInProgress && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-foreground-muted hover:text-foreground flex items-center gap-0.5"
          >
            <span
              className={`material-symbols-rounded transition-transform ${expanded ? "rotate-90" : ""}`}
              style={{ fontSize: 12 }}
            >
              chevron_right
            </span>
            {expanded ? "Hide" : "Show"} affected positions
          </button>

          {expanded && (
            <div className="space-y-1 ml-5">
              {affectedPositions.slice(0, 8).map((p) => (
                <div key={p.positionKey} className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground">
                    {p.name || p.symbol} <span className="text-foreground-muted">({p.chain})</span>
                  </span>
                  <span className="text-foreground-muted">
                    {p.yieldMetricsState === "insufficient_history"
                      ? "needs tx sync"
                      : p.yieldMetricsState === "recomputing"
                        ? "recomputing..."
                        : p.dataConfidence === "estimated"
                          ? "yield estimated from APY"
                          : "incomplete"}
                  </span>
                </div>
              ))}
              {affectedPositions.length > 8 && (
                <span className="text-[11px] text-foreground-muted">
                  +{affectedPositions.length - 8} more
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
