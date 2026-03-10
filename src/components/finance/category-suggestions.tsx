"use client"

import { cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"

interface Suggestion {
  category: string
  subcategory: string | null
  source: string
  confidence: "high" | "medium" | "low"
}

interface CategorySuggestionsProps {
  suggestions: Suggestion[]
  selected: string | null
  onSelect: (category: string, subcategory: string | null) => void
}

const confidenceLabel: Record<string, string> = {
  high: "Strong match",
  medium: "Likely",
  low: "Possible",
}

export function CategorySuggestions({ suggestions, selected, onSelect }: CategorySuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.map((s, i) => {
        const meta = getCategoryMeta(s.category)
        const isSelected = selected === s.category
        return (
          <button
            key={`${s.category}-${s.source}`}
            onClick={() => onSelect(s.category, s.subcategory)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
              isSelected
                ? "border-foreground bg-foreground text-background"
                : "border-card-border bg-card text-foreground hover:border-foreground/30 hover:bg-background-secondary"
            )}
          >
            <span
              className="material-symbols-rounded flex-shrink-0"
              style={{ fontSize: 16, color: isSelected ? "currentColor" : meta.hex }}
            >
              {meta.icon}
            </span>
            <span>{s.category}</span>
            {s.subcategory && (
              <span className={cn(
                "text-xs",
                isSelected ? "opacity-70" : "text-foreground-muted"
              )}>
                · {s.subcategory}
              </span>
            )}
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
              isSelected
                ? "bg-background/20 text-background"
                : s.confidence === "high"
                ? "bg-success/10 text-success"
                : s.confidence === "medium"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-background-secondary text-foreground-muted"
            )}>
              {i + 1}
            </span>
          </button>
        )
      })}
    </div>
  )
}
