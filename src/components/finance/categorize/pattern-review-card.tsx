"use client"

import { useState, useEffect } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { CategoryPicker } from "@/components/finance/category-picker"
import { ConfidenceBar } from "./confidence-bar"
import type { ReviewTransaction } from "@/hooks/finance/use-review"

interface PatternReviewCardProps {
  transaction: ReviewTransaction
  onAccept: (nickname?: string) => void
  onChange: (category: string, subcategory?: string, nickname?: string) => void
  onSkip: () => void
  isSubmitting: boolean
}

export function PatternReviewCard({ transaction: tx, onAccept, onChange, onSkip, isSubmitting }: PatternReviewCardProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [nickname, setNickname] = useState("")
  const topSuggestion = tx.suggestedCategories[0]
  // Use top suggestion (which includes user rules) over the auto-applied category
  const displayCategory = topSuggestion?.category ?? tx.currentCategory
  const displaySubcategory = topSuggestion?.subcategory ?? tx.currentSubcategory
  const displayMeta = getCategoryMeta(displayCategory)
  const confidenceMap: Record<string, number> = { high: 0.9, medium: 0.65, low: 0.3 }
  const displayConfidence = confidenceMap[topSuggestion?.confidence ?? "low"] ?? 0.5

  // "C" key toggles category picker
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "c" || e.key === "C") setShowPicker((v) => !v)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
      {/* Transaction info */}
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          {tx.logoUrl ? (
            <img src={tx.logoUrl} alt="" className="w-11 h-11 rounded-xl object-contain bg-background-secondary flex-shrink-0" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-background-secondary flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 20 }}>receipt_long</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-foreground truncate">{tx.cleanedName}</p>
            {tx.name && tx.name !== tx.cleanedName && (
              <p className="text-xs text-foreground-muted">{tx.name}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-sm font-medium tabular-nums text-foreground">
                {formatCurrency(Math.abs(tx.amount))}
              </span>
              <span className="text-xs text-foreground-muted">
                {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              {tx.accountName && (
                <span className="text-xs text-foreground-muted">
                  {tx.accountName}{tx.accountMask ? ` ••${tx.accountMask}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Nickname input */}
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>label</span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname (e.g. YouTube Premium)"
            className="flex-1 bg-transparent border border-card-border rounded-lg py-2 px-3 text-sm outline-none focus:border-primary placeholder:text-foreground-muted/40"
          />
        </div>

        {/* Top suggestion (prioritizes user rules over auto-applied category) */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-background-secondary">
          <span className="text-xs text-foreground-muted flex-shrink-0">Suggested:</span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-rounded" style={{ fontSize: 16, color: displayMeta.hex }}>
              {displayMeta.icon}
            </span>
            <span className="text-sm font-medium text-foreground">{displayCategory}</span>
            {displaySubcategory && (
              <span className="text-xs text-foreground-muted">· {displaySubcategory}</span>
            )}
          </div>
          <ConfidenceBar confidence={displayConfidence} showLabel className="ml-auto" />
        </div>

        {/* Alternative suggestions */}
        {tx.suggestedCategories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {tx.suggestedCategories.slice(1, 4).map((s, i) => {
              const meta = getCategoryMeta(s.category)
              return (
                <button
                  key={s.category}
                  onClick={() => onChange(s.category, s.subcategory ?? undefined, nickname || undefined)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-card-border hover:border-card-border-hover hover:bg-background-secondary transition-colors"
                >
                  <span className="text-[10px] font-medium text-foreground-muted/50">{i + 2}</span>
                  <span className="material-symbols-rounded" style={{ fontSize: 14, color: meta.hex }}>{meta.icon}</span>
                  <span className="text-xs font-medium text-foreground">{s.category}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-card-border/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onSkip}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            Skip <span className="text-[10px] opacity-60 ml-0.5">S</span>
          </button>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="px-3 py-2 text-xs font-medium text-foreground-muted hover:text-foreground border border-card-border rounded-lg transition-colors"
          >
            Change <span className="text-[10px] opacity-60 ml-0.5">C</span>
          </button>
          <a
            href={`/finance/transactions?search=${encodeURIComponent(tx.cleanedName || tx.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs font-medium text-foreground-muted hover:text-foreground border border-card-border rounded-lg transition-colors inline-flex items-center gap-1"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 13 }}>open_in_new</span>
            View Txn
          </a>
        </div>

        <button
          onClick={() => {
            // If top suggestion differs from current category, apply it as a change
            if (displayCategory && displayCategory !== tx.currentCategory) {
              onChange(displayCategory, displaySubcategory ?? undefined, nickname || undefined)
            } else {
              onAccept(nickname || undefined)
            }
          }}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {isSubmitting ? "..." : "Accept"}
          <span className="text-xs opacity-60">↵</span>
        </button>
      </div>

      {/* Full category picker (expandable) */}
      {showPicker && (
        <div className="border-t border-card-border/50 px-6 py-4">
          <CategoryPicker
            selected={null}
            onSelect={(cat, sub) => {
              onChange(cat, sub ?? undefined, nickname || undefined)
              setShowPicker(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
