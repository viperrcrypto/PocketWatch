"use client"

import { cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { useAIRebuild, type ProcessedMerchant } from "@/hooks/finance/use-ai-rebuild"

interface AIRebuildPanelProps {
  uncategorizedCount: number
}

export function AIRebuildPanel({ uncategorizedCount }: AIRebuildPanelProps) {
  const { state, start, cancel, reset, isRunning, isCounting, isComplete } = useAIRebuild()

  // Idle — mode selection
  if (state.status === "idle" && !state.preview) {
    return (
      <div className="space-y-3">
        <ModeCard
          title="Uncategorized Only"
          description={`Categorize ${uncategorizedCount} uncategorized transactions using AI.`}
          icon="auto_awesome"
          disabled={uncategorizedCount === 0}
          onClick={() => start("uncategorized", true)}
        />
        <ModeCard
          title="Full Rebuild"
          description="Re-evaluate ALL transactions. AI will review and fix miscategorizations."
          icon="restart_alt"
          variant="warning"
          onClick={() => start("full", true)}
        />
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
            Estimated time: {Math.ceil(state.preview.batchCount * 8 / 60)}–{Math.ceil(state.preview.batchCount * 12 / 60)} minutes
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={() => start(uncategorizedCount > 0 ? "uncategorized" : "full")}
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
              <p className="text-sm font-semibold text-foreground">{p?.message ?? "Starting..."}</p>
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
          <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
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
            <p className="text-xs text-amber-500">{s.batchesFailed} batch{s.batchesFailed > 1 ? "es" : ""} failed — partial results applied.</p>
          )}
          <button onClick={reset} className="w-full py-2.5 text-sm font-semibold border border-card-border rounded-xl hover:bg-background-secondary transition-colors">
            Done
          </button>
        </div>
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
