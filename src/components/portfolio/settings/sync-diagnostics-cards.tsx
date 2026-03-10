"use client"

import type { SyncProgressResponse } from "@/hooks/use-portfolio-tracker"
import { formatDateTime, formatDuration } from "./settings-utils"

interface SyncMetrics {
  syncTotal: number
  syncProcessed: number
  syncFailed: number
  syncRemaining: number
  syncProgressPct: number
  syncStatus: string
  syncEtaMs: number | null
  txCached: number
  anyIncremental: boolean
  syncModeLabel: string
  maxHighWaterMark: number | null
  lastIncrementalComplete: number | null
  nextAdvanceAtMs: number
  isActivelyThrottled: boolean
  rateLimitedProvider: string | null
}

export function SyncStatusBadges({ metrics: m }: { metrics: SyncMetrics }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium ${
        m.syncStatus === "running" || m.syncStatus === "queued"
          ? "bg-info/10 text-info"
          : m.syncStatus === "completed" || m.syncStatus === "partial"
            ? "bg-success/10 text-success"
            : m.syncStatus === "failed"
              ? "bg-error/10 text-error"
              : "bg-foreground-muted/10 text-foreground-muted"
      }`}>
        Job: {m.syncStatus.toUpperCase()}
      </span>
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-foreground-muted/10 text-foreground-muted">
        Progress: {m.syncProcessed}/{m.syncTotal} ({m.syncProgressPct}%)
      </span>
      {m.isActivelyThrottled && (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-warning/10 text-warning">
          Throttled{m.rateLimitedProvider ? ` by ${m.rateLimitedProvider}` : ""} until {new Date(m.nextAdvanceAtMs).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
        </span>
      )}
      {m.syncEtaMs !== null && m.syncRemaining > 0 && (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-foreground-muted/10 text-foreground-muted">
          Est. remaining: {formatDuration(m.syncEtaMs)}
        </span>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SyncProgressCard({ metrics: m, missingKeyChains, repairSummary }: { metrics: SyncMetrics; missingKeyChains: string[]; repairSummary: any }) {
  return (
    <div className="rounded-lg border border-card-border px-3 py-3">
      <p className="text-[11px] font-semibold text-foreground-muted">Sync Progress</p>
      <p className="mt-1 text-sm text-foreground font-medium">
        {m.syncRemaining > 0 ? `${m.syncRemaining} wallet-chain syncs remaining` : "No remaining sync steps"}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">Failed steps: {m.syncFailed}</p>
      {missingKeyChains.length > 0 && (
        <p className="mt-1 text-xs text-amber-500">
          Missing API keys for: {missingKeyChains.join(", ")} — add them below in API Keys
        </p>
      )}
      <p className="mt-1 text-xs text-foreground-muted">
        Last state update: {formatDateTime(repairSummary?.sync?.latestStateUpdate)}
      </p>
    </div>
  )
}

export function RateLimitCard({ metrics: m, syncData }: { metrics: SyncMetrics; syncData: SyncProgressResponse | undefined }) {
  return (
    <div className="rounded-lg border border-card-border px-3 py-3">
      <p className="text-[11px] font-semibold text-foreground-muted">Rate Limit / Governor</p>
      <p className="mt-1 text-sm text-foreground font-medium">
        {m.rateLimitedProvider
          ? `Rate limited by ${m.rateLimitedProvider}`
          : m.isActivelyThrottled
            ? "Cooling down between requests"
            : "Active — no limits hit"}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">
        Next allowed: {formatDateTime(syncData?.nextAdvanceAt ?? syncData?.budgetState?.alchemy?.nextAllowedAt ?? syncData?.budgetState?.helius?.nextAllowedAt ?? null)}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">
        Alchemy: {syncData?.budgetState?.alchemy?.activeLeases ?? 0} leases / {syncData?.budgetState?.alchemy?.operationCount ?? 0} ops
      </p>
      <p className="mt-1 text-xs text-foreground-muted">
        Helius: {syncData?.budgetState?.helius?.activeLeases ?? 0} leases / {syncData?.budgetState?.helius?.operationCount ?? 0} ops
      </p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DbCacheCard({ metrics: m, repairSummary, hasCompleteCoverage }: { metrics: SyncMetrics; repairSummary: any; hasCompleteCoverage: boolean }) {
  return (
    <div className="rounded-lg border border-card-border px-3 py-3">
      <p className="text-[11px] font-semibold text-foreground-muted">DB Cache / Coverage</p>
      <p className="mt-1 text-sm text-foreground font-medium">
        Cached tx rows: {m.txCached.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">
        Wallets in scope: {repairSummary?.walletCount ?? 0}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">
        Strict coverage start: {hasCompleteCoverage ? formatDateTime(repairSummary?.coverageStart?.iso) : "Not ready yet"}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">Mode: {m.syncModeLabel}</p>
      {m.maxHighWaterMark !== null && (
        <p className="mt-1 text-xs text-foreground-muted">
          High-water mark: block {m.maxHighWaterMark.toLocaleString()}
        </p>
      )}
      {m.anyIncremental && m.lastIncrementalComplete !== null && (
        <p className="mt-1 text-xs text-foreground-muted">
          Last incremental sync: {formatDateTime(new Date(m.lastIncrementalComplete).toISOString())}
        </p>
      )}
    </div>
  )
}

export function KeyRotationCard({ syncData }: { syncData: SyncProgressResponse | undefined }) {
  const keyHealth = syncData?.keyHealth
  const services = keyHealth ? Object.entries(keyHealth) : []

  return (
    <div className="rounded-lg border border-card-border px-3 py-3">
      <p className="text-[11px] font-semibold text-foreground-muted">API Key Rotation</p>
      {services.length === 0 ? (
        <p className="mt-1 text-xs text-foreground-muted">No multi-key services configured</p>
      ) : (
        <div className="mt-1.5 space-y-2">
          {services.map(([service, keys]) => (
            <div key={service}>
              <p className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wide">
                {service} · {keys.length} key{keys.length !== 1 ? "s" : ""}
              </p>
              <div className="mt-1 space-y-0.5">
                {keys.map((k) => {
                  const isThrottled = k.consecutive429 >= 10
                  const isWarning = k.consecutive429 >= 3 && !isThrottled
                  const isActive = k.active
                  const neverUsed = !k.lastUsedAt
                  const dotColor = isThrottled
                    ? "bg-error"
                    : isWarning
                      ? "bg-warning"
                      : isActive || !neverUsed
                        ? "bg-success"
                        : "bg-foreground-muted/40"
                  const lastUsed = k.lastUsedAt
                    ? `${Math.round((Date.now() - new Date(k.lastUsedAt).getTime()) / 1000)}s ago`
                    : "never"
                  return (
                    <div key={k.id} className="flex items-center gap-1.5 text-[10px]">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                      <span className="text-foreground-muted truncate">{k.label || "Key"}</span>
                      {isActive && <span className="text-success font-medium">active</span>}
                      {isThrottled && <span className="text-warning font-medium">deprioritized ({k.consecutive429}x)</span>}
                      {isWarning && <span className="text-warning font-medium">{k.consecutive429}x 429</span>}
                      <span className="text-foreground-muted/60 ml-auto flex-shrink-0">{lastUsed}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function QualityChecklist({ syncRemaining, repairSummary, hasCompleteCoverage, syncQualityHealthy }: { syncRemaining: number; repairSummary: any; hasCompleteCoverage: boolean; syncQualityHealthy: boolean }) {
  return (
    <div className="rounded-lg border border-card-border px-3 py-3">
      <p className="text-[11px] font-semibold text-foreground-muted">Quality Checklist</p>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
        <p className={`text-xs ${syncRemaining === 0 ? "text-success" : "text-warning"}`}>
          {syncRemaining === 0 ? "Pass" : "Pending"}: all wallet-chain sync states completed
        </p>
        <p className={`text-xs ${(repairSummary?.sync?.syncErrorCount ?? 0) === 0 ? "text-success" : "text-warning"}`}>
          {(repairSummary?.sync?.syncErrorCount ?? 0) === 0 ? "Pass" : "Warn"}: no unresolved sync error states
        </p>
        <p className={`text-xs ${hasCompleteCoverage ? "text-success" : "text-warning"}`}>
          {hasCompleteCoverage ? "Pass" : "Pending"}: strict historical coverage start available
        </p>
        <p className={`text-xs ${syncQualityHealthy ? "text-success" : "text-warning"}`}>
          {syncQualityHealthy ? "Pass" : "Pending"}: confidence checks healthy for chart history
        </p>
      </div>
    </div>
  )
}
