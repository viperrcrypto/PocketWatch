"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { useAIRebuild, type ProcessedMerchant } from "@/hooks/finance/use-ai-rebuild"
import { useReviewCount } from "@/hooks/use-finance"
import type { QualityCheck } from "@/lib/finance/ai-rebuild-engine"
import { formatCurrency } from "@/lib/utils"

interface AIRebuildPanelProps {
  uncategorizedCount: number
}

export function AIRebuildPanel({ uncategorizedCount }: AIRebuildPanelProps) {
  const { state, start, cancel, reset, retryFailed, isRunning, isCounting, isComplete } = useAIRebuild()
  const { data: reviewData } = useReviewCount()
  const reviewCount = reviewData?.count ?? 0
  const [previewedMode, setPreviewedMode] = useState<"uncategorized" | "full">("uncategorized")

  // Idle — mode selection
  if (state.status === "idle" && !state.preview) {
    return (
      <div className="bg-card border border-card-border rounded-xl divide-y divide-card-border">
        {reviewCount > 0 && (
          <Link
            href="/finance/categorize"
            className="flex items-center justify-between px-5 py-4 hover:bg-background-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="material-symbols-rounded text-orange-500 shrink-0" style={{ fontSize: 18 }}>rate_review</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{reviewCount} items need your review</p>
                <p className="text-xs text-foreground-muted truncate">AI wasn&apos;t confident — review in Pattern Review</p>
              </div>
            </div>
            <span className="material-symbols-rounded text-foreground-muted shrink-0" style={{ fontSize: 16 }}>chevron_right</span>
          </Link>
        )}
        <button
          onClick={() => { setPreviewedMode("uncategorized"); start("uncategorized", true) }}
          disabled={uncategorizedCount === 0}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-background-secondary/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-rounded text-primary shrink-0" style={{ fontSize: 18 }}>auto_awesome</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Uncategorized Only</p>
            <p className="text-xs text-foreground-muted">{uncategorizedCount} transactions to categorize</p>
          </div>
        </button>
        <button
          onClick={() => { setPreviewedMode("full"); start("full", true) }}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-background-secondary/50 transition-colors"
        >
          <span className="material-symbols-rounded text-amber-500 shrink-0" style={{ fontSize: 18 }}>restart_alt</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Full Rebuild</p>
            <p className="text-xs text-foreground-muted">Re-categorize everything from scratch</p>
          </div>
        </button>
      </div>
    )
  }

  // Counting (dry run)
  if (isCounting) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-foreground-muted">Counting transactions...</p>
      </div>
    )
  }

  // Preview (dry run complete)
  if (state.status === "idle" && state.preview) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 24 }}>batch_prediction</span>
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{state.preview.merchantCount} merchants</h3>
          <p className="text-sm text-foreground-muted mt-1">
            {state.preview.txCount} transactions across {state.preview.batchCount} batch{state.preview.batchCount !== 1 ? "es" : ""}
          </p>
          <p className="text-xs text-foreground-muted mt-2">
            Estimated time: ~{Math.max(1, Math.ceil(Math.ceil(state.preview.batchCount / 2) * 10 / 60))} minute{Math.ceil(Math.ceil(state.preview.batchCount / 2) * 10 / 60) > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={() => start(previewedMode)}
            className="px-6 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Start Rebuild
          </button>
        </div>
        <p className="text-[10px] text-foreground-muted/60">Only merchant names are shared with AI. No amounts, dates, or account details.</p>
      </div>
    )
  }

  // Running
  if (isRunning) {
    const p = state.progress
    const pct = p ? Math.round((p.merchantsProcessed / p.totalMerchants) * 100) : 0
    return (
      <div className="space-y-4">
        <div className="bg-card border border-card-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                {p?.message ?? "Starting..."}
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              </p>
              <p className="text-xs text-foreground-muted mt-0.5">
                {p ? `${p.merchantsProcessed} / ${p.totalMerchants} merchants` : "Preparing..."}
              </p>
            </div>
            <button
              onClick={cancel}
              className="px-3 py-1.5 text-xs font-medium text-error border border-error/30 rounded-lg hover:bg-error/5 transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="h-2.5 bg-background-secondary rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 relative overflow-hidden"
              style={{ width: `${Math.max(pct, 2)}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: "200% 100%" }} />
            </div>
          </div>
          <div className="flex justify-between text-[11px] text-foreground-muted">
            <span>{pct}% complete</span>
            {p && <span>Batch {p.batchIndex + 1} of {p.totalBatches}</span>}
          </div>
        </div>
        <MerchantResultsList merchants={state.processedMerchants} />
      </div>
    )
  }

  // Paused
  if (state.status === "paused") {
    return (
      <div className="space-y-4">
        <div className="bg-card border border-amber-500/30 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Rebuild paused</p>
          <p className="text-xs text-foreground-muted mt-1">
            {state.processedMerchants.length} merchants processed so far.
          </p>
          <button onClick={reset} className="mt-3 px-4 py-2 text-sm font-medium border border-card-border rounded-lg hover:bg-background-secondary transition-colors">
            Done
          </button>
        </div>
        <MerchantResultsList merchants={state.processedMerchants} />
      </div>
    )
  }

  // Complete
  if (isComplete && state.summary) {
    const s = state.summary
    return (
      <div className="space-y-4">
        <div className="bg-card border border-success/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <span className="material-symbols-rounded text-success" style={{ fontSize: 20 }}>check_circle</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Rebuild Complete</p>
              <p className="text-xs text-foreground-muted">in {Math.round(s.durationMs / 1000)}s</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Categorized" value={s.totalTxCategorized} />
            <StatBox label="Rules Created" value={s.rulesCreated} />
            <StatBox label="Rules Updated" value={s.rulesUpdated} />
            <StatBox label="Custom Categories" value={s.customCategoriesCreated} />
          </div>
          {s.batchesFailed > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-500">{s.batchesFailed} batch{s.batchesFailed > 1 ? "es" : ""} failed after retries — partial results applied.</span>
                <button
                  onClick={retryFailed}
                  disabled={isRunning}
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex-shrink-0 ml-3 disabled:opacity-50"
                >
                  {isRunning ? "Retrying..." : "Retry failed"}
                </button>
              </div>
              {s.failedMerchants && s.failedMerchants.length > 0 && (
                <p className="text-[10px] text-foreground-muted leading-relaxed">
                  Failed: {s.failedMerchants.slice(0, 8).join(", ")}
                  {s.failedMerchants.length > 8 && ` +${s.failedMerchants.length - 8} more`}
                </p>
              )}
            </div>
          )}
          {reviewCount > 0 && (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-amber-400" style={{ fontSize: 16 }}>help_outline</span>
                <span className="text-xs text-foreground">
                  <strong>{reviewCount}</strong> item{reviewCount !== 1 ? "s" : ""} need your review — AI wasn&apos;t sure
                </span>
              </div>
              <Link href="/finance/categorize" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                Review now &rarr;
              </Link>
            </div>
          )}
          <button onClick={reset} className="w-full py-2.5 text-sm font-semibold border border-card-border rounded-xl hover:bg-background-secondary transition-colors">
            Done
          </button>
        </div>

        {/* Quality Check Results */}
        {s.qualityCheck && (
          <QualityCheckCard check={s.qualityCheck} />
        )}

        <MerchantResultsList merchants={state.processedMerchants} />
      </div>
    )
  }

  // Error
  return (
    <div className="bg-card border border-error/30 rounded-2xl p-8 text-center">
      <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
      <p className="text-sm text-error mb-3">{state.error ?? "Something went wrong"}</p>
      <button onClick={reset} className="px-4 py-2 text-sm font-medium border border-card-border rounded-lg hover:bg-background-secondary transition-colors">
        Try Again
      </button>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function ModeCard({ title, description, icon, variant, disabled, onClick }: {
  title: string; description: string; icon: string; variant?: "warning"; disabled?: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full text-left bg-card border rounded-2xl p-5 transition-all hover:border-card-border-hover disabled:opacity-40 disabled:cursor-not-allowed",
        variant === "warning" ? "border-amber-500/30 hover:border-amber-500/50" : "border-card-border"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", variant === "warning" ? "bg-amber-500/10" : "bg-primary/10")}>
          <span className={cn("material-symbols-rounded", variant === "warning" ? "text-amber-500" : "text-primary")} style={{ fontSize: 20 }}>{icon}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background-secondary rounded-xl p-3 text-center">
      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-[10px] text-foreground-muted">{label}</p>
    </div>
  )
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-success/10", text: "text-success", border: "border-success/30" },
  B: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30" },
  C: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30" },
  D: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  F: { bg: "bg-error/10", text: "text-error", border: "border-error/30" },
}

function QualityCheckCard({ check }: { check: QualityCheck }) {
  const g = GRADE_COLORS[check.grade] ?? GRADE_COLORS.C

  return (
    <div className={cn("bg-card border rounded-xl p-5 space-y-4", g.border)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>verified</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Data Quality Check</p>
            <p className="text-xs text-foreground-muted">Post-rebuild verification</p>
          </div>
        </div>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black", g.bg, g.text)}>
          {check.grade}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-background-secondary rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-foreground tabular-nums">{check.categorizedPct}%</p>
          <p className="text-[10px] text-foreground-muted">Categorized</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-foreground tabular-nums">{check.incomeCount}</p>
          <p className="text-[10px] text-foreground-muted">Income Txns</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(check.incomeTotal)}</p>
          <p className="text-[10px] text-foreground-muted">Total Income</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-foreground tabular-nums">{check.uncategorized}</p>
          <p className="text-[10px] text-foreground-muted">Uncategorized</p>
        </div>
      </div>

      {check.topCategories.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-foreground-muted uppercase tracking-widest mb-2">Top Categories</p>
          <div className="space-y-1">
            {check.topCategories.slice(0, 5).map((c) => {
              const meta = getCategoryMeta(c.category)
              return (
                <div key={c.category} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-rounded" style={{ fontSize: 13, color: meta.hex }}>{meta.icon}</span>
                    <span className="text-foreground">{c.category}</span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-foreground-muted">{c.count} txns</span>
                    <span className="font-medium text-foreground">{formatCurrency(Math.abs(c.total))}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {check.issues.length > 0 && (
        <div className="space-y-1.5">
          {check.issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-500">
              <span className="material-symbols-rounded shrink-0 mt-0.5" style={{ fontSize: 13 }}>warning</span>
              {issue}
            </div>
          ))}
        </div>
      )}

      {check.issues.length === 0 && (
        <p className="text-xs text-success flex items-center gap-1.5">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>check_circle</span>
          No issues detected — data looks clean
        </p>
      )}
    </div>
  )
}

function MerchantResultsList({ merchants }: { merchants: ProcessedMerchant[] }) {
  if (merchants.length === 0) return null
  const visible = merchants.slice(-30).reverse()

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
      <div className="divide-y divide-card-border/50">
        {visible.map((m, i) => {
          const meta = getCategoryMeta(m.category)
          return (
            <div key={`${m.merchantName}-${i}`} className="flex items-center gap-3 px-4 py-2.5 animate-fade-up">
              <span className="material-symbols-rounded" style={{ fontSize: 14, color: meta.hex }}>{meta.icon}</span>
              <span className="text-xs font-medium text-foreground flex-1 truncate">{m.merchantName}</span>
              <span className="text-xs text-foreground-muted">{m.category}</span>
              <span className="text-[10px] text-foreground-muted/60">{m.txCount} tx</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
