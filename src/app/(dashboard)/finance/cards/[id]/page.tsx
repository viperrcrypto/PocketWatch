"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  useCreditCards, useFinanceAccounts, useCardPerks, useCardRewardRates,
  useLiabilities, useCardAIEnrich, useAISettings,
} from "@/hooks/use-finance"
import { formatCurrency } from "@/lib/utils"
import { detectIssuer } from "@/components/finance/credit-card-visual"
import { CardEditModal } from "@/components/finance/card-edit-modal"
import { CATEGORY_ICONS } from "@/components/finance/cards/card-detail-constants"
import { CardDetailHero } from "@/components/finance/cards/card-detail-hero"
import {
  CardAILoadingSkeleton, CardSignupBonus, CardPaymentDetails,
  CardRewardMultipliers, CardTransferPartners, CardBenefitsDB,
  CardBenefitsAI, CardHighlights, CardStatementCredits, CardAIRefreshSection,
} from "@/components/finance/cards/card-detail-sections"
import type { CardAIEnrichedData } from "@/app/api/finance/cards/ai-enrich/route"

export default function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const { data: cards } = useCreditCards()
  const { data: institutions } = useFinanceAccounts()
  const { data: perks } = useCardPerks(id)
  const { data: rewardRates } = useCardRewardRates(id)
  const { data: liabilities } = useLiabilities()
  const aiEnrich = useCardAIEnrich()
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

  const benefits = useMemo(() => {
    if (perks && perks.length > 0) return null
    return aiData?.benefits ?? null
  }, [perks, aiData])

  const balance = Math.abs(account?.currentBalance ?? 0)
  const creditLimit = account?.creditLimit ?? 0
  const mask = account?.mask ?? null
  const rewardsValue = card?.rewardType === "cashback" ? formatCurrency(card.cashbackBalance ?? 0) : (card?.pointsBalance ?? 0).toLocaleString()
  const rewardsLabel = card?.rewardType === "cashback" ? "Cash Back" : "Rewards"

  const handleAIRefresh = () => {
    if (!card) return
    if (!hasAIProvider) { setNoProvider(true); return }
    setAiError(null); setNoProvider(false)
    aiEnrich.mutate({ cardProfileId: card.id }, {
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "AI enrichment failed"
        if (msg.includes("NO_AI_PROVIDER")) setNoProvider(true)
        else setAiError(msg)
      },
    })
  }

  const autoEnrichTriggered = useRef(false)
  useEffect(() => {
    if (card && !card.aiEnrichedData && hasAIProvider && !autoEnrichTriggered.current && !aiEnrich.isPending) {
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

  return (
    <div className="space-y-8 pb-12">
      <Link href="/finance/cards" className="inline-flex items-center gap-1.5 text-primary hover:text-primary-hover transition-colors text-sm font-medium">
        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_back</span>
        Back to Gallery
      </Link>

      <CardDetailHero
        card={card} issuer={issuer} mask={mask} balance={balance}
        rewardsValue={rewardsValue} rewardsLabel={rewardsLabel}
        creditLimit={creditLimit} aiData={aiData} onEditClick={() => setEditOpen(true)}
      />

      {aiEnrich.isPending && !aiData && <CardAILoadingSkeleton />}
      {aiData?.signupBonus && <CardSignupBonus bonus={aiData.signupBonus} />}
      {liability && <CardPaymentDetails liability={liability} />}
      <CardRewardMultipliers multipliers={multipliers} />
      <CardTransferPartners partners={transferPartners} />
      {perks && perks.length > 0 && <CardBenefitsDB perks={perks} />}
      {benefits && benefits.length > 0 && <CardBenefitsAI benefits={benefits} />}
      {aiData?.cardHighlights && aiData.cardHighlights.length > 0 && <CardHighlights highlights={aiData.cardHighlights} />}
      {statementCredits && <CardStatementCredits credits={statementCredits} />}

      <CardAIRefreshSection
        aiEnrichedAt={card.aiEnrichedAt} noProvider={noProvider}
        isPending={aiEnrich.isPending} aiError={aiError} onRefresh={handleAIRefresh}
      />

      <CardEditModal open={editOpen} onClose={() => setEditOpen(false)} card={card} />
    </div>
  )
}
