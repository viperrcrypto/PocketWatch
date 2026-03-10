"use client"

import { useState } from "react"
import {
  useDataQualityCheck,
  useRepairAction,
  type RepairAction,
} from "@/hooks/use-portfolio-tracker"

export function DataQualityCheck({ refetchSync }: { refetchSync: () => void }) {
  const [qualityCheckEnabled, setQualityCheckEnabled] = useState(false)
  const { data: qualityData, isLoading: qualityLoading, refetch: refetchQuality } = useDataQualityCheck(qualityCheckEnabled)
  const repair = useRepairAction()
  const [lastRepairMsg, setLastRepairMsg] = useState<string | null>(null)

  return (
    <div className="mt-4 pt-4 border-t border-card-border">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Data Quality Check</p>
          <p className="text-xs text-foreground-muted mt-0.5">
            Analyze transaction data for duplicates, gaps, suspicious values, and sync issues.
          </p>
        </div>
        <button
          onClick={() => { setQualityCheckEnabled(true); refetchQuality() }}
          disabled={qualityLoading}
          className="px-3 py-1.5 border border-card-border rounded-lg text-foreground hover:bg-foreground/5 transition-colors text-xs font-medium flex-shrink-0"
        >
          {qualityLoading ? "Checking..." : "Run Check"}
        </button>
      </div>

      {qualityData && (
        <div className="mt-3 space-y-3">
          {qualityData.syncRunning && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-amber-500/10 text-amber-600 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Sync is running — results may be incomplete. Re-check after sync finishes.
            </div>
          )}

          <QualityScoreCard qualityData={qualityData} />
          <QualityChainBreakdown qualityData={qualityData} />
          <QualityWalletBreakdown qualityData={qualityData} repair={repair} refetchQuality={refetchQuality} refetchSync={refetchSync} setLastRepairMsg={setLastRepairMsg} />
          <QuickRepairActions qualityData={qualityData} repair={repair} refetchQuality={refetchQuality} refetchSync={refetchSync} setLastRepairMsg={setLastRepairMsg} />

          {lastRepairMsg && (
            <div className="flex items-center gap-1.5 text-success text-xs">
              <span className="material-symbols-rounded text-xs">check_circle</span>
              <span>{lastRepairMsg}</span>
            </div>
          )}
          {repair.isError && (
            <p className="text-error text-xs">{repair.error?.message || "Repair failed"}</p>
          )}

          <QualityIssuesList qualityData={qualityData} repair={repair} refetchQuality={refetchQuality} refetchSync={refetchSync} setLastRepairMsg={setLastRepairMsg} />
        </div>
      )}
    </div>
  )
}

/* ─── Sub-components ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QualityScoreCard({ qualityData }: { qualityData: any }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`text-xl font-bold ${
        qualityData.score >= 80 ? "text-success" : qualityData.score >= 50 ? "text-amber-500" : "text-error"
      }`}>
        {qualityData.score}/100
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">{qualityData.verdict}</p>
        <p className="text-[11px] text-foreground-muted">
          {qualityData.totalRows.toLocaleString()} rows &middot; {qualityData.walletCount} wallet{qualityData.walletCount !== 1 ? "s" : ""} &middot; {qualityData.chainCount} chain{qualityData.chainCount !== 1 ? "s" : ""} &middot; {qualityData.counts.errors}E / {qualityData.counts.warnings}W / {qualityData.counts.info}I
        </p>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QualityChainBreakdown({ qualityData }: { qualityData: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
      {Object.entries(qualityData.chainDetail).map(([chain, d]: [string, any]) => (
        <div key={chain} className="text-xs px-2.5 py-1.5 rounded bg-foreground/5 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="font-medium">{chain}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              d.syncComplete && !d.syncError ? "bg-success/10 text-success" :
              d.syncError ? "bg-error/10 text-error" :
              "bg-amber-500/10 text-amber-500"
            }`}>
              {d.syncComplete ? (d.syncError ? "error" : "synced") : d.syncPhase ?? "pending"}
            </span>
          </div>
          <div className="text-foreground-muted">
            {d.count.toLocaleString()} txs &middot; {d.directions.in} in / {d.directions.out} out
            {d.spanDays !== null && <> &middot; {d.spanDays}d span</>}
          </div>
          <div className="text-foreground-muted">
            Categories: {Object.entries(d.categories).map(([cat, n]) => `${cat}(${n})`).join(", ") || "none"}
          </div>
          {d.dbVsSyncDelta !== null && d.dbVsSyncDelta !== 0 && (
            <div className="text-amber-500">DB vs sync delta: {d.dbVsSyncDelta > 0 ? "+" : ""}{d.dbVsSyncDelta} rows</div>
          )}
        </div>
      ))}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QualityWalletBreakdown({ qualityData, repair, refetchQuality, refetchSync, setLastRepairMsg }: { qualityData: any; repair: ReturnType<typeof useRepairAction>; refetchQuality: () => void; refetchSync: () => void; setLastRepairMsg: (v: string | null) => void }) {
  if (!qualityData.walletDetail || qualityData.walletDetail.length === 0) return null

  const byWallet = new Map<string, typeof qualityData.walletDetail>()
  for (const wd of qualityData.walletDetail) {
    if (!byWallet.has(wd.wallet)) byWallet.set(wd.wallet, [])
    byWallet.get(wd.wallet)!.push(wd)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-foreground-muted">Per-Wallet Status</p>
      {[...byWallet.entries()].map(([wallet, chains]) => {
        const allOk = chains.every((c: any) => c.syncComplete && !c.syncError)
        const hasErrors = chains.some((c: any) => c.syncError)
        const statusColor = allOk ? "text-success" : hasErrors ? "text-error" : "text-amber-500"
        return (
          <div key={wallet} className="text-xs px-2.5 py-2 rounded bg-foreground/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className={`font-medium ${statusColor}`}>{wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setLastRepairMsg(null)
                    repair.mutate({ action: "resync_wallet", wallet }, {
                      onSuccess: (data) => { setLastRepairMsg(data.message); refetchQuality(); refetchSync() },
                    })
                  }}
                  disabled={repair.isPending}
                  className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-card-border hover:bg-foreground/5 transition-colors disabled:opacity-50"
                >
                  Resync
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Wipe & resync wallet ${wallet.slice(0, 10)}...? This deletes all transactions and sync states for this wallet, then starts a fresh sync.`)) {
                      setLastRepairMsg(null)
                      repair.mutate({ action: "nuke_wallet", wallet }, {
                        onSuccess: (data) => { setLastRepairMsg(data.message); refetchQuality(); refetchSync() },
                      })
                    }
                  }}
                  disabled={repair.isPending}
                  className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-error/30 text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                >
                  Wipe
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {chains.map((c: any) => (
                <span key={c.chain} className={`text-[10px] px-1 py-0.5 rounded ${
                  c.syncComplete && !c.syncError ? "bg-success/10 text-success" :
                  c.syncError ? "bg-error/10 text-error" :
                  "bg-amber-500/10 text-amber-500"
                }`}>
                  {c.chain} ({c.count})
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QuickRepairActions({ qualityData, repair, refetchQuality, refetchSync, setLastRepairMsg }: { qualityData: any; repair: ReturnType<typeof useRepairAction>; refetchQuality: () => void; refetchSync: () => void; setLastRepairMsg: (v: string | null) => void }) {
  const fixableActions: Array<{ label: string; action: RepairAction; chain?: string; condition: boolean }> = [
    { label: "Fix future timestamps", action: "future_timestamps", condition: qualityData.issues.some((i: any) => i.code === "future_timestamps") },
    { label: "Fix ancient timestamps", action: "ancient_timestamps", condition: qualityData.issues.some((i: any) => i.code === "ancient_timestamps") },
    { label: "Fix empty tx hashes", action: "empty_tx_hashes", condition: qualityData.issues.some((i: any) => i.code === "empty_tx_hashes") },
    { label: "Remove duplicates", action: "duplicate_txs", condition: qualityData.issues.some((i: any) => i.code === "duplicate_txs") },
    { label: "Retry all failed syncs", action: "resync_all_failed", condition: qualityData.issues.some((i: any) => i.code === "failed_sync") },
    { label: "Clear all throttle gates", action: "clear_throttle", condition: qualityData.issues.some((i: any) => i.code === "excessive_throttling" || i.code === "active_backoff") },
  ]
  const applicable = fixableActions.filter((a) => a.condition)
  if (applicable.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {applicable.map((a) => (
        <button
          key={a.action}
          onClick={() => {
            setLastRepairMsg(null)
            repair.mutate({ action: a.action, chain: a.chain }, {
              onSuccess: (data) => { setLastRepairMsg(data.message); refetchQuality(); refetchSync() },
            })
          }}
          disabled={repair.isPending}
          className="px-2 py-1 text-[11px] font-medium rounded border border-card-border text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50"
        >
          {repair.isPending ? "..." : a.label}
        </button>
      ))}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QualityIssuesList({ qualityData, repair, refetchQuality, refetchSync, setLastRepairMsg }: { qualityData: any; repair: ReturnType<typeof useRepairAction>; refetchQuality: () => void; refetchSync: () => void; setLastRepairMsg: (v: string | null) => void }) {
  const repairMap: Record<string, { action: RepairAction; label: string }> = {
    future_timestamps: { action: "future_timestamps", label: "Delete" },
    ancient_timestamps: { action: "ancient_timestamps", label: "Delete" },
    empty_tx_hashes: { action: "empty_tx_hashes", label: "Delete" },
    duplicate_txs: { action: "duplicate_txs", label: "Dedupe" },
    failed_sync: { action: "resync_chain", label: "Re-sync" },
    stuck_sync: { action: "resync_chain", label: "Re-sync" },
    stale_sync: { action: "resync_chain", label: "Re-sync" },
    sparse_chain: { action: "resync_chain", label: "Re-sync" },
    sync_vs_db_mismatch: { action: "resync_chain", label: "Re-sync" },
    one_direction_only: { action: "resync_chain", label: "Re-sync" },
    missing_categories: { action: "resync_chain", label: "Re-sync" },
    excessive_throttling: { action: "clear_throttle", label: "Clear" },
    active_backoff: { action: "clear_throttle", label: "Clear" },
  }

  if (qualityData.issues.length === 0) {
    return <p className="text-xs text-success font-medium">No issues found</p>
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-foreground-muted">
        {qualityData.issues.length} issue{qualityData.issues.length !== 1 ? "s" : ""} found
      </p>
      {qualityData.issues.map((issue: any, idx: number) => {
        const fixable = repairMap[issue.code]
        return (
          <div key={idx} className={`text-xs rounded px-2.5 py-1.5 ${
            issue.severity === "error" ? "bg-error/5 text-error" : issue.severity === "warning" ? "bg-amber-500/5 text-amber-500" : "bg-foreground/5 text-foreground-muted"
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 min-w-0">
                <span className="material-symbols-rounded text-xs mt-0.5">
                  {issue.severity === "error" ? "error" : issue.severity === "warning" ? "warning" : "info"}
                </span>
                <div>
                  <span className="font-medium">{issue.message}</span>
                  {issue.detail && <p className="mt-0.5 opacity-70 text-[11px]">{issue.detail}</p>}
                </div>
              </div>
              {fixable && (
                <button
                  onClick={() => {
                    setLastRepairMsg(null)
                    repair.mutate({
                      action: fixable.action,
                      chain: issue.chain ?? undefined,
                      wallet: issue.wallet ?? undefined,
                    }, {
                      onSuccess: (data) => { setLastRepairMsg(data.message); refetchQuality(); refetchSync() },
                    })
                  }}
                  disabled={repair.isPending}
                  className="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded border border-current/20 hover:bg-current/10 transition-colors disabled:opacity-50"
                >
                  {repair.isPending ? "..." : fixable.label}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
