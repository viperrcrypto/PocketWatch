"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface Perk {
  id: string
  perkName: string
  perkValue: number | null
  isUsed: boolean
}

interface CardPerks {
  cardId: string
  cardName: string
  annualFee: number
  perks: Perk[]
}

interface PerksTrackerProps {
  cards: CardPerks[]
  onTogglePerk?: (cardId: string, perkId: string, isUsed: boolean) => void
}

export function PerksTracker({ cards, onTogglePerk }: PerksTrackerProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  if (cards.length === 0) {
    return <p className="text-sm text-foreground-muted text-center py-6">No card perks tracked</p>
  }

  return (
    <div className="divide-y divide-card-border/30">
      {cards.map((card) => {
        const isExpanded = expandedCard === card.cardId
        const usedValue = card.perks.filter((p) => p.isUsed).reduce((s, p) => s + (p.perkValue ?? 0), 0)
        const totalValue = card.perks.reduce((s, p) => s + (p.perkValue ?? 0), 0)
        const roi = card.annualFee > 0 ? ((usedValue / card.annualFee) * 100) : 0
        const usedCount = card.perks.filter((p) => p.isUsed).length

        return (
          <div key={card.cardId}>
            <button
              onClick={() => setExpandedCard(isExpanded ? null : card.cardId)}
              className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{card.cardName}</p>
                <p className="text-[10px] text-foreground-muted">
                  {usedCount}/{card.perks.length} perks used
                  {card.annualFee > 0 && ` · ${roi.toFixed(0)}% fee ROI`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Mini progress */}
                <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-background-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      roi >= 100 ? "bg-success" : roi >= 50 ? "bg-amber-500" : "bg-error"
                    )}
                    style={{ width: `${Math.min((usedCount / card.perks.length) * 100, 100)}%` }}
                  />
                </div>
                <span className={cn(
                  "material-symbols-rounded text-foreground-muted transition-transform",
                  isExpanded && "rotate-180"
                )} style={{ fontSize: 16 }}>expand_more</span>
              </div>
            </button>

            {isExpanded && (
              <div className="px-5 pb-3 space-y-1">
                {card.perks.map((perk) => (
                  <div key={perk.id} className="flex items-center gap-3 py-1.5">
                    <button
                      onClick={() => onTogglePerk?.(card.cardId, perk.id, !perk.isUsed)}
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                        perk.isUsed
                          ? "bg-success border-success"
                          : "border-gray-300 dark:border-gray-600"
                      )}
                    >
                      {perk.isUsed && (
                        <span className="material-symbols-rounded text-white" style={{ fontSize: 14 }}>check</span>
                      )}
                    </button>
                    <span className={cn("text-sm flex-1", perk.isUsed ? "text-foreground" : "text-foreground-muted")}>
                      {perk.perkName}
                    </span>
                    {perk.perkValue != null && perk.perkValue > 0 && (
                      <span className="text-xs font-data text-foreground-muted tabular-nums">
                        ${perk.perkValue}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
