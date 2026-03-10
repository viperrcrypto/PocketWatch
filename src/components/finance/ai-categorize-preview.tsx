"use client"

import { useState } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface AISuggestion {
  merchantName: string
  transactionIds: string[]
  suggestedCategory: string
  suggestedSubcategory: string | null
  confidence: "high" | "medium" | "low"
  reasoning: string
  transactionCount: number
}

interface AICategorizePreviewProps {
  suggestions: AISuggestion[]
  providerLabel: string
  onApply: (accepted: Array<{
    transactionIds: string[]
    category: string
    subcategory?: string
    createRule?: boolean
    merchantName: string
  }>) => void
  isApplying: boolean
}

export function AICategorizePreview({
  suggestions,
  providerLabel,
  onApply,
  isApplying,
}: AICategorizePreviewProps) {
  const [accepted, setAccepted] = useState<Set<string>>(
    () => new Set(suggestions.filter((s) => s.confidence === "high").map((s) => s.merchantName))
  )
  const [createRules, setCreateRules] = useState(true)

  const toggleMerchant = (name: string) => {
    setAccepted((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const acceptAll = () => setAccepted(new Set(suggestions.map((s) => s.merchantName)))
  const acceptHighConfidence = () => setAccepted(
    new Set(suggestions.filter((s) => s.confidence === "high").map((s) => s.merchantName))
  )

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
    onApply(items)
  }

  const totalTxs = suggestions
    .filter((s) => accepted.has(s.merchantName))
    .reduce((sum, s) => sum + s.transactionCount, 0)

  const confidenceDot: Record<string, string> = {
    high: "bg-success",
    medium: "bg-amber-500",
    low: "bg-foreground-muted/40",
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={acceptAll}
            className="px-3 py-1.5 text-xs font-medium border border-card-border rounded-lg hover:bg-background-secondary transition-colors"
          >
            Select all
          </button>
          <button
            onClick={acceptHighConfidence}
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
          Create rules for future transactions
        </label>
      </div>

      {/* Suggestions table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="divide-y divide-card-border/50">
          {suggestions.map((s) => {
            const meta = getCategoryMeta(s.suggestedCategory)
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
                    <span className="text-sm font-medium text-foreground truncate">
                      {s.merchantName}
                    </span>
                    <span className="text-xs text-foreground-muted flex-shrink-0">
                      {s.transactionCount} tx{s.transactionCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  {s.reasoning && (
                    <p className="text-xs text-foreground-muted mt-0.5 truncate">{s.reasoning}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background-secondary">
                    <span
                      className="material-symbols-rounded"
                      style={{ fontSize: 14, color: meta.hex }}
                    >
                      {meta.icon}
                    </span>
                    <span className="text-xs font-medium text-foreground">{s.suggestedCategory}</span>
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
          Only merchant names were shared with {providerLabel}. No account details or exact amounts.
        </p>
        <button
          onClick={handleApply}
          disabled={accepted.size === 0 || isApplying}
          className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {isApplying ? "Applying..." : `Apply ${accepted.size} (${totalTxs} txs)`}
        </button>
      </div>
    </div>
  )
}
