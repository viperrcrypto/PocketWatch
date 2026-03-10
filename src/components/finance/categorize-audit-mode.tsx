"use client"

import { useState } from "react"
import { useAIAudit, useApplyAIAudit } from "@/hooks/use-finance"
import { getCategoryMeta } from "@/lib/finance/categories"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface AuditSuggestion {
  merchantName: string
  transactionIds: string[]
  currentCategory: string
  suggestedCategory: string
  suggestedSubcategory: string | null
  confidence: "high" | "medium" | "low"
  reasoning: string
}

interface CategorizeAuditModeProps {
  onComplete: () => void
}

export function CategorizeAuditMode({ onComplete }: CategorizeAuditModeProps) {
  const aiAudit = useAIAudit()
  const applyAudit = useApplyAIAudit()
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [createRules, setCreateRules] = useState(true)

  const suggestions: AuditSuggestion[] = aiAudit.data?.suggestions ?? []

  const toggleMerchant = (name: string) => {
    setAccepted((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleTrigger = () => {
    aiAudit.mutate(undefined, {
      onSuccess: (data) => {
        // Auto-select high confidence suggestions
        setAccepted(new Set(
          data.suggestions.filter((s) => s.confidence === "high").map((s) => s.merchantName)
        ))
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const handleApply = () => {
    const items = suggestions
      .filter((s) => accepted.has(s.merchantName))
      .map((s) => ({
        transactionIds: s.transactionIds,
        category: s.suggestedCategory,
        subcategory: s.suggestedSubcategory ?? undefined,
        createRule: createRules,
        merchantName: s.merchantName,
      }))

    applyAudit.mutate(
      { accepted: items },
      {
        onSuccess: (result) => {
          toast.success(`Applied ${result.applied} corrections, ${result.rulesCreated} rules updated`)
          aiAudit.reset()
          onComplete()
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const confidenceDot: Record<string, string> = {
    high: "bg-success",
    medium: "bg-amber-500",
    low: "bg-foreground-muted/40",
  }

  // Initial state — trigger audit
  if (!aiAudit.data && !aiAudit.isPending) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-background-secondary flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 24 }}>fact_check</span>
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1.5">AI Categorization Audit</h3>
        <p className="text-sm text-foreground-muted max-w-md mx-auto mb-6">
          Review your existing categorizations with AI. It will flag transactions that may be incorrectly categorized and suggest corrections.
        </p>
        <button
          onClick={handleTrigger}
          className="px-6 py-3 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Audit Recent Transactions
        </button>
      </div>
    )
  }

  // Loading
  if (aiAudit.isPending) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-foreground-muted">Auditing categorizations...</p>
      </div>
    )
  }

  // No suggestions — all correct
  if (suggestions.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-2xl py-12 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-rounded text-success" style={{ fontSize: 24 }}>verified</span>
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1.5">Categorizations look good</h3>
        <p className="text-sm text-foreground-muted">AI found no issues with your recent transaction categorizations.</p>
      </div>
    )
  }

  // Results
  const totalTxs = suggestions
    .filter((s) => accepted.has(s.merchantName))
    .reduce((sum, s) => sum + s.transactionIds.length, 0)

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAccepted(new Set(suggestions.map((s) => s.merchantName)))}
            className="px-3 py-1.5 text-xs font-medium border border-card-border rounded-lg hover:bg-background-secondary transition-colors"
          >
            Select all
          </button>
          <button
            onClick={() => setAccepted(new Set(suggestions.filter((s) => s.confidence === "high").map((s) => s.merchantName)))}
            className="px-3 py-1.5 text-xs font-medium border border-card-border rounded-lg hover:bg-background-secondary transition-colors"
          >
            High confidence only
          </button>
          <button
            onClick={() => setAccepted(new Set())}
            className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-foreground-muted cursor-pointer">
          <input
            type="checkbox"
            checked={createRules}
            onChange={(e) => setCreateRules(e.target.checked)}
            className="rounded border-card-border"
          />
          Update rules for future transactions
        </label>
      </div>

      {/* Suggestions table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="divide-y divide-card-border/50">
          {suggestions.map((s) => {
            const currentMeta = getCategoryMeta(s.currentCategory)
            const suggestedMeta = getCategoryMeta(s.suggestedCategory)
            const isChecked = accepted.has(s.merchantName)
            return (
              <div
                key={s.merchantName}
                onClick={() => toggleMerchant(s.merchantName)}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors",
                  isChecked ? "bg-primary/5" : "hover:bg-background-secondary/50"
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleMerchant(s.merchantName)}
                  className="rounded border-card-border flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{s.merchantName}</span>
                    <span className="text-xs text-foreground-muted flex-shrink-0">
                      {s.transactionIds.length} tx{s.transactionIds.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  {s.reasoning && (
                    <p className="text-xs text-foreground-muted mt-0.5 truncate">{s.reasoning}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Current category (red) */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10">
                    <span className="material-symbols-rounded" style={{ fontSize: 12, color: currentMeta.hex }}>
                      {currentMeta.icon}
                    </span>
                    <span className="text-xs font-medium text-red-600 line-through">{s.currentCategory}</span>
                  </div>

                  <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 14 }}>arrow_forward</span>

                  {/* Suggested category (green) */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/10">
                    <span className="material-symbols-rounded" style={{ fontSize: 12, color: suggestedMeta.hex }}>
                      {suggestedMeta.icon}
                    </span>
                    <span className="text-xs font-medium text-success">{s.suggestedCategory}</span>
                    {s.suggestedSubcategory && (
                      <span className="text-xs text-foreground-muted">· {s.suggestedSubcategory}</span>
                    )}
                  </div>

                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", confidenceDot[s.confidence])} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Apply footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">
          Only merchant names were shared with {aiAudit.data?.providerLabel ?? "AI"}.
        </p>
        <button
          onClick={handleApply}
          disabled={accepted.size === 0 || applyAudit.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {applyAudit.isPending ? "Applying..." : `Apply ${accepted.size} correction${accepted.size !== 1 ? "s" : ""} (${totalTxs} txs)`}
        </button>
      </div>
    </div>
  )
}
