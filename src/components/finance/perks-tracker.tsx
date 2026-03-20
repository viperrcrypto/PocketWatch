"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { getKnownCardImage } from "./card-image-map"
import { CardPerksChecklist } from "./card-perks-checklist"
import { computeAnnualizedValue } from "@/lib/finance/perk-periods"
import type { PerkPeriod } from "@/types/card-perks"

interface Perk {
  id: string
  perkName: string
  perkValue: number | null
  perkType: "limited" | "unlimited"
  period: "monthly" | "quarterly" | "annual" | "one_time"
  maxValue: number
  usedValue: number
  daysRemaining: number | null
  percentUsed: number
  periodEnd: string | null
  periodLabel: string
  annualizedValue: number
  isUsed: boolean
}

interface CardPerks {
  cardId: string
  cardName: string
  annualFee: number
  cardImageUrl?: string | null
  issuer?: string
  perks: Perk[]
}

interface PerksTrackerProps {
  cards: CardPerks[]
  onTogglePerk?: (cardId: string, perkId: string, data: { addAmount?: number; setUsedValue?: number; isUsed?: boolean }) => void
}

export function PerksTracker({ cards, onTogglePerk }: PerksTrackerProps) {
  const cardsWithPerks = useMemo(() => cards.filter((c) => c.perks.length > 0), [cards])

  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const hasAutoExpanded = useRef(false)
  useEffect(() => {
    if (!hasAutoExpanded.current && cardsWithPerks.length === 1) {
      hasAutoExpanded.current = true
      setExpandedCard(cardsWithPerks[0].cardId)
    }
  }, [cardsWithPerks])

  // Aggregate across all cards
  const agg = useMemo(() => {
    let totalFees = 0, totalAnnualized = 0, totalUsedAnnualized = 0
    for (const card of cardsWithPerks) {
      totalFees += card.annualFee
      for (const p of card.perks) {
        if (p.perkType !== "limited" || p.maxValue <= 0) continue
        const annual = computeAnnualizedValue(p.maxValue, p.period)
        const usedAnnual = computeAnnualizedValue(p.usedValue, p.period)
        totalAnnualized += annual
        totalUsedAnnualized += usedAnnual
      }
    }
    const roi = totalFees > 0 ? (totalUsedAnnualized / totalFees) * 100 : 0
    return { totalFees, totalAnnualized, totalUsedAnnualized, roi, remaining: totalFees - totalUsedAnnualized }
  }, [cardsWithPerks])

  // Count urgent perks (expiring within 7 days and not fully used)
  const urgentCount = useMemo(() => {
    let count = 0
    for (const card of cardsWithPerks) {
      for (const p of card.perks) {
        if (p.perkType === "limited" && p.daysRemaining !== null && p.daysRemaining <= 7 && !p.isUsed) count++
      }
    }
    return count
  }, [cardsWithPerks])

  if (cardsWithPerks.length === 0) {
    return (
      <div className="text-center py-8 px-5">
        <span className="material-symbols-rounded text-foreground-muted/30 mb-2 block" style={{ fontSize: 32 }}>card_giftcard</span>
        <p className="text-sm text-foreground-muted">No card perks tracked</p>
        <p className="text-[10px] text-foreground-muted/60 mt-1">Enrich your cards to detect perks</p>
      </div>
    )
  }

  return (
    <div>
      {/* Aggregate ROI Hero */}
      {agg.totalFees > 0 && (
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-foreground-muted">Annual Fee Offset</p>
                {urgentCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-error/10 text-error text-[9px] font-semibold rounded-full animate-pulse">
                    <span className="material-symbols-rounded" style={{ fontSize: 10 }}>warning</span>
                    {urgentCount} expiring soon
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-data text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(agg.totalUsedAnnualized)}
                </span>
                <span className="text-[10px] text-foreground-muted">
                  of {formatCurrency(agg.totalFees)} in fees
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/finance/cards/perks-calendar"
                download="pocketwatch-perks.ics"
                className="p-1.5 text-foreground-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                title="Add perk reminders to calendar"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>calendar_add_on</span>
              </a>
              <div className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-data font-bold tabular-nums",
                agg.roi >= 100 ? "bg-success/10 text-success"
                  : agg.roi >= 50 ? "bg-amber-500/10 text-amber-600"
                  : "bg-error/10 text-error"
              )}>
                {agg.roi.toFixed(0)}% ROI
              </div>
            </div>
          </div>

          {/* Aggregate progress bar */}
          <div className="h-2 rounded-full bg-background-secondary overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                agg.roi >= 100 ? "bg-success" : agg.roi >= 50 ? "bg-amber-500" : "bg-error"
              )}
              style={{ width: `${Math.min(agg.roi, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-foreground-muted mt-1.5 text-right tabular-nums">
            {agg.remaining > 0
              ? `${formatCurrency(agg.remaining)} to break even`
              : `+${formatCurrency(Math.abs(agg.remaining))} profit`}
          </p>
        </div>
      )}

      {/* Per-Card Sections */}
      <div className="divide-y divide-card-border/30">
        {cardsWithPerks.map((card) => (
          <CardPerksSection
            key={card.cardId}
            card={card}
            isExpanded={expandedCard === card.cardId}
            onToggleExpand={() => setExpandedCard(expandedCard === card.cardId ? null : card.cardId)}
            onTogglePerk={onTogglePerk}
          />
        ))}
      </div>
    </div>
  )
}

function CardPerksSection({ card, isExpanded, onToggleExpand, onTogglePerk }: {
  card: CardPerks
  isExpanded: boolean
  onToggleExpand: () => void
  onTogglePerk?: (cardId: string, perkId: string, data: { addAmount?: number; setUsedValue?: number; isUsed?: boolean }) => void
}) {
  const limited = card.perks.filter((p) => p.perkType === "limited" && p.maxValue > 0)
  const unlimited = card.perks.filter((p) => p.perkType === "unlimited")
  const usedAnnual = limited.reduce((s, p) => s + computeAnnualizedValue(p.usedValue, p.period), 0)
  const totalAnnual = limited.reduce((s, p) => s + computeAnnualizedValue(p.maxValue, p.period), 0)
  const roi = card.annualFee > 0 ? (usedAnnual / card.annualFee) * 100 : 0
  const creditPct = totalAnnual > 0 ? (usedAnnual / totalAnnual) * 100 : 0
  const urgentPerks = limited.filter((p) => p.daysRemaining !== null && p.daysRemaining <= 7 && !p.isUsed)

  return (
    <div>
      <button onClick={onToggleExpand} className="w-full px-5 py-3.5 text-left hover:bg-background-secondary/30 transition-colors">
        <div className="flex items-center gap-3">
          <CardThumbnail cardName={card.cardName} imageUrl={card.cardImageUrl} issuer={card.issuer} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">{card.cardName}</p>
              {urgentPerks.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-error animate-pulse flex-shrink-0" />
              )}
              <span className={cn("material-symbols-rounded text-foreground-muted transition-transform flex-shrink-0", isExpanded && "rotate-180")} style={{ fontSize: 16 }}>expand_more</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {limited.length > 0 && (
                <span className="text-[10px] text-foreground-muted tabular-nums">
                  {formatCurrency(usedAnnual)} of {formatCurrency(totalAnnual)}/yr
                </span>
              )}
              {unlimited.length > 0 && (
                <>
                  {limited.length > 0 && <span className="w-1 h-1 rounded-full bg-foreground-muted/30" />}
                  <span className="text-[10px] text-foreground-muted">{unlimited.length} benefit{unlimited.length !== 1 ? "s" : ""}</span>
                </>
              )}
            </div>
          </div>
          {card.annualFee > 0 && limited.length > 0 && (
            <span className={cn("text-[10px] font-data font-semibold tabular-nums flex-shrink-0", roi >= 100 ? "text-success" : roi >= 50 ? "text-amber-500" : "text-error")}>
              {roi.toFixed(0)}% ROI
            </span>
          )}
        </div>

        {limited.length > 0 && (
          <div className="mt-2 h-1.5 rounded-full bg-background-secondary overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300", card.annualFee === 0 ? "bg-primary" : roi >= 100 ? "bg-success" : roi >= 50 ? "bg-amber-500" : "bg-error")}
              style={{ width: `${Math.max(creditPct, usedAnnual > 0 ? 4 : 0)}%` }}
            />
          </div>
        )}
      </button>

      {isExpanded && (
        <div className="px-5 pb-4 animate-in slide-in-from-top-1 duration-150">
          <CardPerksChecklist
            cardName={card.cardName}
            annualFee={card.annualFee}
            perks={card.perks}
            onTogglePerk={(perkId, data) => onTogglePerk?.(card.cardId, perkId, data)}
            showHeader={false}
          />
          {card.annualFee > 0 && limited.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-card-border/30 flex items-center justify-between">
              <span className="text-[10px] text-foreground-muted">{formatCurrency(usedAnnual)} of {formatCurrency(totalAnnual)} annualized</span>
              <span className={cn("text-[10px] font-data font-semibold tabular-nums", usedAnnual >= card.annualFee ? "text-success" : "text-foreground")}>
                {usedAnnual >= card.annualFee ? `+${formatCurrency(usedAnnual - card.annualFee)} profit` : `${formatCurrency(card.annualFee - usedAnnual)} to break even`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getIssuerColor(cardName: string, issuer?: string): string {
  const combined = `${issuer ?? ""} ${cardName}`.toLowerCase()
  if (combined.includes("chase") || combined.includes("sapphire")) return "#0A3263"
  if (combined.includes("amex") || combined.includes("american express") || combined.includes("platinum card") || combined.includes("blue business")) return "#006FCF"
  if (combined.includes("citi") || combined.includes("strata")) return "#003B70"
  if (combined.includes("capital one") || combined.includes("venture")) return "#D12028"
  if (combined.includes("discover")) return "#FF6000"
  if (combined.includes("amazon")) return "#FF9900"
  if (combined.includes("bank of america")) return "#012169"
  return "#6366f1"
}

function CardThumbnail({ cardName, imageUrl, issuer }: { cardName: string; imageUrl?: string | null; issuer?: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const resolvedUrl = getKnownCardImage(cardName, issuer) ?? imageUrl
  if (resolvedUrl && !imgFailed) {
    return (
      <div className="w-10 h-6 rounded overflow-hidden flex-shrink-0 bg-background-secondary">
        <img src={resolvedUrl} alt={cardName} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
      </div>
    )
  }
  const color = getIssuerColor(cardName, issuer)
  return (
    <div className="w-10 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
      <span className="material-symbols-rounded text-white" style={{ fontSize: 14 }}>credit_card</span>
    </div>
  )
}
