"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  useCreditCards, useFinanceAccounts, useCardRewardRates,
  useLiabilities, useAISettings, useCardPerks, useToggleCardPerk,
} from "@/hooks/use-finance"
import { useAutoEnrichCards } from "@/hooks/finance/use-card-enrichment"
import { formatCurrency } from "@/lib/utils"
import { detectIssuer } from "@/components/finance/credit-card-visual"
import { CardEditModal } from "@/components/finance/card-edit-modal"
import { CATEGORY_ICONS } from "@/components/finance/cards/card-detail-constants"
import { CardDetailHero } from "@/components/finance/cards/card-detail-hero"
import {
  CardAILoadingSkeleton, CardPaymentDetails,
  CardRewardMultipliers, CardTransferPartners,
  CardBenefitsAI, CardStatementCredits,
} from "@/components/finance/cards/card-detail-sections"
import { cn } from "@/lib/utils"
import type { CardAIEnrichedData } from "@/app/api/finance/cards/ai-enrich/route"
import { CardChat } from "@/components/finance/cards/card-chat"
import { CardPerksChecklist } from "@/components/finance/card-perks-checklist"

export default function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const { data: cards } = useCreditCards()
  const { data: institutions } = useFinanceAccounts()

  const { data: rewardRates } = useCardRewardRates(id)
  const { data: liabilities } = useLiabilities()
  const { data: perks } = useCardPerks(id)
  const togglePerk = useToggleCardPerk()
  const autoEnrich = useAutoEnrichCards()
  const { data: aiSettings } = useAISettings()
  const [aiError, setAiError] = useState<string | null>(null)
  const [noProvider, setNoProvider] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const hasAIProvider = (aiSettings?.providers ?? []).some((p) => p.verified)
  const card = cards?.find((c) => c.id === id)

  const account = useMemo(() => {
    if (!card || !institutions) return null
    for (const inst of institutions) {
      const acct = inst.accounts.find((a) => a.id === card.accountId)
      if (acct) return { ...acct, institutionName: inst.institutionName }
    }
    return null
  }, [card, institutions])

  const liability = useMemo(() => {
    if (!card || !liabilities?.creditCards) return null
    return liabilities.creditCards.find((l: any) => l.accountId === card.accountId) ?? null // eslint-disable-line @typescript-eslint/no-explicit-any
  }, [card, liabilities])

  const issuer = card ? detectIssuer(account?.institutionName ?? "", card.cardName) : "Other"

  const aiData = useMemo((): CardAIEnrichedData | null => {
    if (!card?.aiEnrichedData) return null
    return card.aiEnrichedData as unknown as CardAIEnrichedData
  }, [card])

  const bonusCategories = useMemo(() => {
    if (!card?.bonusCategories) return []
    return (Array.isArray(card.bonusCategories) ? card.bonusCategories : []) as Array<{
      category: string; rate: number; rotating?: boolean; activationRequired?: boolean
    }>
  }, [card])

  // Combine bonus categories + reward rates + AI multipliers
  const multipliers = useMemo(() => {
    const result: Array<{ category: string; rate: number; unit: string; description?: string; icon: string }> = []
    const seen = new Set<string>()
    for (const bc of bonusCategories) {
      const catKey = bc.category.toLowerCase()
      seen.add(catKey)
      result.push({
        category: bc.category, rate: bc.rate,
        unit: card?.rewardType === "cashback" ? "Cash Back" : "Points",
        description: bc.rotating ? `Rotating category${bc.activationRequired ? " (activation required)" : ""}` : undefined,
        icon: CATEGORY_ICONS[catKey] ?? "credit_card",
      })
    }
    for (const rr of (rewardRates ?? [])) {
      const catKey = rr.spendingCategory.toLowerCase()
      if (!seen.has(catKey)) {
        seen.add(catKey)
        result.push({ category: rr.spendingCategory, rate: rr.rewardRate, unit: rr.rewardType === "cashback" ? "Cash Back" : "Points", icon: CATEGORY_ICONS[catKey] ?? "credit_card" })
      }
    }
    if (aiData?.rewardMultipliers) {
      for (const m of aiData.rewardMultipliers) {
        const catKey = m.category.toLowerCase()
        if (!seen.has(catKey)) {
          seen.add(catKey)
          result.push({ category: m.category, rate: m.rate, unit: m.unit, description: m.description, icon: CATEGORY_ICONS[catKey] ?? "credit_card" })
        }
      }
    }
    return result
  }, [bonusCategories, rewardRates, aiData, card])

  const transferPartners = useMemo(() => {
    const dbPartners = (card?.transferPartners && Array.isArray(card.transferPartners))
      ? card.transferPartners as Array<{ name: string; ratio?: string; shortCode?: string }>
      : []
    return dbPartners.length > 0 ? dbPartners : (aiData?.transferPartners ?? [])
  }, [card, aiData])

  const benefits = aiData?.benefits ?? null

  const balance = Math.abs(account?.currentBalance ?? 0)
  const creditLimit = account?.creditLimit ?? 0
  const mask = account?.mask ?? null
  const rewardsValue = card?.rewardType === "cashback" ? formatCurrency(card.cashbackBalance ?? 0) : (card?.pointsBalance ?? 0).toLocaleString()
  const rewardsLabel = card?.rewardType === "cashback" ? "Cash Back" : "Rewards"

  const handleAIRefresh = () => {
    if (!card) return
    if (!hasAIProvider) { setNoProvider(true); return }
    setAiError(null); setNoProvider(false)
    autoEnrich.mutate({ unenriched: [card.id], needsApply: [] }, {
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "AI enrichment failed"
        if (msg.includes("NO_AI_PROVIDER")) setNoProvider(true)
        else setAiError(msg)
      },
    })
  }

  const autoEnrichTriggered = useRef(false)
  useEffect(() => {
    if (card && !card.aiEnrichedData && hasAIProvider && !autoEnrichTriggered.current && !autoEnrich.isPending) {
      autoEnrichTriggered.current = true
      handleAIRefresh()
    }
  }, [card, hasAIProvider]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="material-symbols-rounded text-foreground-muted mb-4" style={{ fontSize: 48 }}>credit_card_off</span>
        <p className="text-foreground-muted text-sm">Card not found</p>
        <Link href="/finance/cards" className="text-primary text-sm font-medium mt-2 hover:underline">Back to Card Gallery</Link>
      </div>
    )
  }

  const statementCredits = card.statementCredits && Array.isArray(card.statementCredits) && (card.statementCredits as unknown[]).length > 0
    ? card.statementCredits as Array<{ name: string; amount: number; frequency: string; used?: boolean }>
    : null

  const refreshLabel = autoEnrich.isPending
    ? "Refreshing..."
    : noProvider
      ? "Configure AI"
      : "Refresh with AI"

  const lastRefreshedText = card.aiEnrichedAt
    ? `Updated ${new Date(card.aiEnrichedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${new Date(card.aiEnrichedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : null

  return (
    <div className="space-y-8 pb-12">
      {/* Top bar: Back + Refresh */}
      <div className="flex items-center justify-between">
        <Link href="/finance/cards" className="inline-flex items-center gap-1.5 text-primary hover:text-primary-hover transition-colors text-sm font-medium">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_back</span>
          Back to Gallery
        </Link>
        <div className="flex items-center gap-3">
          {lastRefreshedText && (
            <span className="text-[10px] text-foreground-muted">{lastRefreshedText}</span>
          )}
          {noProvider ? (
            <Link
              href="/finance/settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition-all"
            >
              Configure AI
            </Link>
          ) : (
            <button
              onClick={handleAIRefresh}
              disabled={autoEnrich.isPending}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                autoEnrich.isPending
                  ? "bg-card-elevated text-foreground-muted cursor-not-allowed"
                  : "bg-primary/10 text-primary hover:bg-primary/20 active:scale-95",
              )}
            >
              <span className={cn("material-symbols-rounded", autoEnrich.isPending && "animate-spin")} style={{ fontSize: 14 }}>
                {autoEnrich.isPending ? "progress_activity" : "refresh"}
              </span>
              {refreshLabel}
            </button>
          )}
        </div>
      </div>
      {aiError && <p className="text-error text-xs -mt-6">{aiError}</p>}

      <CardDetailHero
        card={card} issuer={issuer} mask={mask} balance={balance}
        rewardsValue={rewardsValue} rewardsLabel={rewardsLabel}
        creditLimit={creditLimit} aiData={aiData} onEditClick={() => setEditOpen(true)}
      />

      {autoEnrich.isPending && !aiData && <CardAILoadingSkeleton />}

      {liability ? (
        <CardPaymentDetails liability={liability} />
      ) : card.paymentDueDay ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 20 }}>calendar_today</span>
            <h3 className="text-sm font-semibold text-foreground">Payment Details</h3>
          </div>
          <div className="p-4 rounded-xl bg-card border border-card-border">
            <p className="text-foreground-muted text-[10px] font-medium uppercase tracking-widest">Payment Due Day</p>
            <p className="text-foreground text-lg font-bold mt-1">{ordinal(card.paymentDueDay)} of each month</p>
          </div>
        </section>
      ) : null}

      {perks && perks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 20 }}>card_giftcard</span>
            <h3 className="text-sm font-semibold text-foreground">Card Perks</h3>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <CardPerksChecklist
              cardName={card.cardName}
              annualFee={card.annualFee ?? 0}
              perks={perks.map((p) => ({
                id: p.id,
                perkName: p.name,
                perkType: p.perkType,
                maxValue: p.maxValue,
                isUsed: p.isUsed,
              }))}
              onTogglePerk={(perkId, data) => togglePerk.mutate({ perkId, ...data })}
            />
          </div>
        </section>
      )}

      <CardRewardMultipliers multipliers={multipliers} />
      <CardTransferPartners partners={transferPartners} />
      <CardChat cardId={id} cardName={card.cardName} aiData={aiData} />
      {benefits && benefits.length > 0 && <CardBenefitsAI benefits={benefits} />}
      {statementCredits && <CardStatementCredits credits={statementCredits} />}

      <CardEditModal open={editOpen} onClose={() => setEditOpen(false)} card={card} />
    </div>
  )
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
