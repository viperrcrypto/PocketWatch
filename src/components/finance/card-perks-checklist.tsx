"use client"

import { cn, formatCurrency } from "@/lib/utils"

interface ChecklistPerk {
  id: string
  perkName: string
  perkType: "limited" | "unlimited"
  maxValue: number
  isUsed: boolean
}

interface CardPerksChecklistProps {
  cardName: string
  annualFee: number
  perks: ChecklistPerk[]
  onTogglePerk?: (perkId: string, data: { isUsed?: boolean }) => void
  showHeader?: boolean
}

export type { ChecklistPerk }

export function CardPerksChecklist({
  cardName, annualFee, perks, onTogglePerk, showHeader = true,
}: CardPerksChecklistProps) {
  const usedCount = perks.filter((p) => p.isUsed).length
  const usedValue = perks
    .filter((p) => p.perkType === "limited" && p.maxValue > 0 && p.isUsed)
    .reduce((sum, p) => sum + p.maxValue, 0)
  const roi = annualFee > 0 ? (usedValue / annualFee) * 100 : 0

  return (
    <div>
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">{cardName}</span>
            <span className="text-[10px] text-foreground-muted flex-shrink-0">
              {usedCount}/{perks.length} perks used
            </span>
          </div>
          {annualFee > 0 && (
            <span className={cn(
              "text-[10px] font-data font-semibold tabular-nums px-2 py-0.5 rounded-lg flex-shrink-0",
              roi >= 100 ? "bg-success/10 text-success"
                : roi >= 50 ? "bg-amber-500/10 text-amber-600"
                : "bg-error/10 text-error",
            )}>
              {roi.toFixed(0)}% fee ROI
            </span>
          )}
        </div>
      )}

      <div className="space-y-0.5">
        {perks.map((perk) => (
          <button
            key={perk.id}
            onClick={() => onTogglePerk?.(perk.id, { isUsed: !perk.isUsed })}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-background-secondary/30 transition-colors text-left"
          >
            <span
              className={cn(
                "material-symbols-rounded flex-shrink-0",
                perk.isUsed ? "text-success" : "text-foreground-muted/40",
              )}
              style={{ fontSize: 20 }}
            >
              {perk.isUsed ? "check_box" : "check_box_outline_blank"}
            </span>
            <span className={cn(
              "text-sm flex-1 min-w-0 truncate",
              perk.isUsed ? "font-medium text-foreground" : "text-foreground-muted",
            )}>
              {perk.perkName}
            </span>
            {perk.perkType === "limited" && perk.maxValue > 0 && (
              <span className="text-xs font-data tabular-nums text-foreground-muted flex-shrink-0">
                {formatCurrency(perk.maxValue)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
