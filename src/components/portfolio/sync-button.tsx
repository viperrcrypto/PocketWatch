"use client"

import Link from "next/link"
import type { SyncProgressResponse } from "@/hooks/use-portfolio-tracker"
import { estimateSyncEtaMs, formatEta } from "@/lib/portfolio/overview-helpers"

export interface SyncStatusInfo {
  active: boolean
  icon: string
  title: string
  detail: string
  progress: number
  showProgress: boolean
  variant: "info" | "warning" | "muted"
}

export interface SyncButtonProps {
  syncStatus: SyncStatusInfo | null
  syncProgress: SyncProgressResponse | undefined
  isRefreshing: boolean | "" | null
  refreshCooldown: boolean
  onRefresh: () => void
}

export function SyncButton({
  syncStatus,
  syncProgress,
  isRefreshing,
  refreshCooldown,
  onRefresh,
}: SyncButtonProps) {
  const isSyncing = syncStatus?.variant === "info" && syncStatus.active
  const isThrottled = syncStatus?.variant === "warning" && syncStatus.active
  const isStale = syncStatus?.variant === "muted" && syncStatus.active
  const isActive = isSyncing || isThrottled

  const progressPct = syncProgress?.progressPct ?? syncStatus?.progress ?? 0
  const totalSyncs = syncProgress?.totalSyncs ?? 0
  const etaMs = estimateSyncEtaMs(syncProgress)
  const etaLabel = formatEta(etaMs)

  const resumeTime =
    isThrottled && syncProgress?.nextAdvanceAt
      ? new Date(syncProgress.nextAdvanceAt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : null

  const throttledProvider = (() => {
    if (!isThrottled) return null
    const blocked = (syncProgress?.progress ?? [])
      .filter(
        (p) =>
          !p.isComplete && p.retryAfter && Date.parse(p.retryAfter) > Date.now(),
      )
      .map((p) => p.chain.toLowerCase())
    return (
      (blocked.some((c) => c !== "solana") ? "Alchemy" : null) ??
      (blocked.some((c) => c === "solana") ? "Helius" : null) ??
      (syncProgress?.budgetState?.alchemy?.nextAllowedAt &&
      Date.parse(syncProgress.budgetState.alchemy.nextAllowedAt) > Date.now()
        ? "Alchemy"
        : null) ??
      (syncProgress?.budgetState?.helius?.nextAllowedAt &&
      Date.parse(syncProgress.budgetState.helius.nextAllowedAt) > Date.now()
        ? "Helius"
        : null)
    )
  })()

  // Idle / Stale state — compact button
  if (!isActive) {
    return (
      <button
        onClick={onRefresh}
        disabled={!!isRefreshing || refreshCooldown}
        className="relative flex items-center gap-2 px-4 py-2.5 bg-card border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover hover:bg-card-elevated transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs tracking-wide"
      >
        <span
          className="material-symbols-rounded text-sm"
          style={
            isRefreshing
              ? { animation: "spinnerRotate 0.8s linear infinite" }
              : undefined
          }
        >
          sync
        </span>
        {isRefreshing ? "Syncing..." : "Refresh"}
        {isStale && !isRefreshing && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-warning border-2 border-card" />
        )}
      </button>
    )
  }

  // Syncing / Throttled state — expanded pill
  const borderColor = isThrottled ? "border-warning/20" : "border-primary/20"
  const bgColor = isThrottled ? "bg-warning/5" : "bg-primary/5"
  const accentColor = isThrottled ? "text-warning" : "text-primary"
  const barColor = isThrottled ? "bg-warning" : "bg-primary"

  return (
    <div
      className={`relative overflow-hidden flex items-center gap-3 px-4 py-2.5 ${bgColor} border ${borderColor} rounded-xl transition-all duration-500 ease-out`}
    >
      <span
        className={`material-symbols-rounded text-base flex-shrink-0 ${accentColor}`}
        style={
          isSyncing
            ? { animation: "spinnerRotate 1.2s linear infinite" }
            : undefined
        }
      >
        {isThrottled ? "pace" : "sync"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`font-semibold ${isThrottled ? "text-warning" : "text-foreground"}`}
          >
            {isThrottled
              ? `Paused${throttledProvider ? ` \u00b7 ${throttledProvider}` : ""}${resumeTime ? ` \u00b7 resumes ${resumeTime}` : ""}`
              : `Syncing ${totalSyncs} chain${totalSyncs !== 1 ? "s" : ""}`}
          </span>
          {progressPct > 0 && (
            <span className="text-foreground-muted font-data">
              \u00b7 {progressPct}%
            </span>
          )}
          {etaLabel && !isThrottled && (
            <span className="text-foreground-muted font-data">
              \u00b7 {etaLabel}
            </span>
          )}
        </div>
      </div>
      <Link
        href="/portfolio/settings"
        className="flex-shrink-0 text-foreground-muted hover:text-foreground transition-colors"
        title="View diagnostics"
      >
        <span className="material-symbols-rounded text-base">info</span>
      </Link>
      {/* Thin progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-card-border/30">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${Math.max(progressPct, 2)}%` }}
        />
      </div>
    </div>
  )
}
