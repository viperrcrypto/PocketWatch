"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  useCreditCards, useCardRecommendations, useFinanceAccounts,
  useSaveCreditCard, useCardStrategy, useToggleCardPerk,
  useUpcomingBills, useFinanceSubscriptions, useLiabilities,
  useAutoIdentifyCards,
  useAutoEnrichCards, useAllCardPerks,
} from "@/hooks/use-finance"
import { cn } from "@/lib/utils"
import { GalleryHeader } from "@/components/finance/gallery-header"
import { EnrichProgressBar } from "@/components/finance/cards/enrich-progress"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { CardsBillsSection } from "@/components/finance/cards-bills-section"
import { IssuerGroup } from "@/components/finance/issuer-group"
import { CardStrategyTab } from "@/components/finance/card-strategy-tab"
import { detectIssuer } from "@/components/finance/credit-card-visual"
import { looksLikePersonName, deriveCardName } from "@/components/finance/cards-page-helpers"
import { getKnownAnnualFee } from "@/components/finance/card-image-map"

const TABS = ["Overview", "Card Strategy"] as const
type Tab = typeof TABS[number]

export default function FinanceCardsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview")

  const { data: cards, isLoading } = useCreditCards()
  const { data: recs } = useCardRecommendations()
  const { data: institutions } = useFinanceAccounts()
  const { data: strategy } = useCardStrategy()
  const { data: billsData } = useUpcomingBills()
  const { data: subs } = useFinanceSubscriptions()
  const saveCreditCard = useSaveCreditCard()
  const togglePerk = useToggleCardPerk()
  const { data: liabilities } = useLiabilities()
  const autoIdentify = useAutoIdentifyCards()
  const autoEnrich = useAutoEnrichCards()

  // All accounts indexed by ID (for balance lookups — SimpleFIN often misclassifies
  // credit cards as "checking", so we can't rely on type for account matching)
  const allAccountsMap = useMemo(() => {
    const map = new Map<string, { currentBalance: number | null; creditLimit: number | null; mask: string | null; name: string; officialName?: string | null; type: string; institutionName: string }>()
    for (const inst of institutions ?? []) {
      for (const a of inst.accounts) {
        map.set(a.id, { ...a, institutionName: inst.institutionName })
      }
    }
    return map
  }, [institutions])

  // Credit accounts for header totals — include accounts with card profiles
  // even if SimpleFIN misclassified their type
  const cardAccountIds = useMemo(() => new Set((cards ?? []).map((c) => c.accountId)), [cards])
  const creditAccounts = useMemo(() => {
    return institutions?.flatMap((inst) =>
      inst.accounts
        .filter((a) => a.type === "credit" || a.type === "business_credit" || cardAccountIds.has(a.id))
        .map((a) => ({ ...a, institutionName: inst.institutionName }))
    ) ?? []
  }, [institutions, cardAccountIds])

  // Merge card profiles with account data
  type MergedCard = {
    id: string; cardName: string; cardNetwork: string; accountId: string;
    annualFee: number; rewardType: string; rewardProgram: string | null;
    baseRewardRate: number; bonusCategories: unknown;
    pointsBalance: number | null; cashbackBalance: number | null;
    mask: string | null; balance: number; creditLimit: number;
    annualFeeDate: string | null; nextPaymentDueDate: string | null;
    institutionName: string; cardImageUrl: string | null;
    accountType: string;
  }

  const mergedCards = useMemo(() => {
    const creditCardLiabilities = liabilities?.creditCards ?? []
    return (cards ?? []).map((c): MergedCard => {
      const acct = allAccountsMap.get(c.accountId)
      const liab = creditCardLiabilities.find((l: { accountId: string }) => l.accountId === c.accountId)
      const instName = acct?.institutionName ?? ""

      // Re-derive card name at display time to fix stored bad names
      // (e.g. cardholder names like "Z. KAL" or generic "Credit Card")
      const storedName = c.cardName
      const needsRename = looksLikePersonName(storedName) || /^credit\s*card$/i.test(storedName)
      const displayName = needsRename
        ? deriveCardName({ name: acct?.name ?? storedName, officialName: acct?.officialName, mask: acct?.mask, institutionName: instName })
        : storedName

      // Resolve annual fee: known cards map > AI enriched > DB (known map is authoritative)
      const aiEnriched = c.aiEnrichedData as { annualFee?: number; cardNetwork?: string; rewardType?: string } | null
      const knownFee = getKnownAnnualFee(displayName, instName)
      const resolvedFee = knownFee ?? aiEnriched?.annualFee ?? c.annualFee ?? 0

      return {
        ...c,
        cardName: displayName,
        annualFee: resolvedFee,
        cardNetwork: aiEnriched?.cardNetwork ?? c.cardNetwork,
        rewardType: aiEnriched?.rewardType ?? c.rewardType,
        pointsBalance: c.pointsBalance ?? null,
        cashbackBalance: c.cashbackBalance ?? null,
        mask: acct?.mask ?? null,
        balance: Math.abs(acct?.currentBalance ?? 0),
        creditLimit: acct?.creditLimit ?? 0,
        annualFeeDate: c.annualFeeDate ?? null,
        nextPaymentDueDate: liab?.nextPaymentDueDate ?? null,
        institutionName: instName,
        cardImageUrl: c.cardImageUrl ?? null,
        accountType: acct?.type ?? "credit",
      }
    })
  }, [cards, allAccountsMap, liabilities])

  // Auto-identify unidentified cards (generic names like "Chase Card ••••3132")
  const identifyTriggered = useRef(false)
  const hasUnidentified = mergedCards.some((c) => /card\s*••••\d{4}$/i.test(c.cardName))
  useEffect(() => {
    if (hasUnidentified && !identifyTriggered.current && !autoIdentify.isPending) {
      identifyTriggered.current = true
      autoIdentify.mutate()
    }
  }, [hasUnidentified]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build card name lookup for progress display
  const cardNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of mergedCards) map[c.id] = c.cardName
    return map
  }, [mergedCards])

  // Auto-enrich only NEW cards (never enriched before). All other syncs are manual via Refresh button.
  const enrichTriggered = useRef(false)
  useEffect(() => {
    if (enrichTriggered.current || !cards || cards.length === 0 || autoEnrich.isPending) return
    const unenriched = cards.filter((c) => !c.aiEnrichedAt).map((c) => c.id)
    if (unenriched.length > 0) {
      enrichTriggered.current = true
      autoEnrich.mutate({ unenriched, needsApply: [], cardNames: cardNameMap })
    }
  }, [cards]) // eslint-disable-line react-hooks/exhaustive-deps

  // Group cards by issuer (institution name → canonical issuer, card name fallback)
  const cardsByIssuer = useMemo(() => {
    const groups: Record<string, MergedCard[]> = {}
    for (const card of mergedCards) {
      const issuer = detectIssuer(card.institutionName, card.cardName)
      if (!groups[issuer]) groups[issuer] = []
      groups[issuer].push(card)
    }
    return groups
  }, [mergedCards])

  // Totals
  const totalBalance = creditAccounts.reduce((sum, a) => sum + Math.abs(a.currentBalance ?? 0), 0)
  const totalLimit = creditAccounts.reduce((sum, a) => sum + (a.creditLimit ?? 0), 0)
  const utilization = totalLimit > 0 ? (totalBalance / totalLimit * 100) : 0
  const issuerCount = Object.keys(cardsByIssuer).length

  // Bills stats
  const allSubs = subs?.subscriptions ?? []
  const monthlyBillsTotal = allSubs.filter((s: { status: string }) => s.status === "active")
    .reduce((sum: number, s: { frequency: string; amount: number }) => {
      if (s.frequency === "monthly") return sum + s.amount
      if (s.frequency === "yearly") return sum + s.amount / 12
      if (s.frequency === "quarterly") return sum + s.amount / 3
      if (s.frequency === "weekly") return sum + s.amount * 4.33
      return sum
    }, 0)

  const allBills = billsData?.bills ?? []
  const upcomingBills = allBills.filter((b) => !b.isPaid)
  const paidBills = allBills.filter((b) => b.isPaid)
  const upcomingCount = upcomingBills.length
  const upcomingTotal = upcomingBills.reduce((s, b) => s + b.amount, 0)
  const nextDue = upcomingBills[0]

  // Wallet strategy
  const walletStrategy = (strategy?.walletStrategy ?? []).map((s: { category: string; bestCard: string; bestRate: number; rewardUnit?: string; monthlySpend?: number; monthlyReward?: number; actualReward?: number; gap?: number }) => ({
    category: s.category,
    cardName: s.bestCard,
    rewardRate: s.bestRate,
    rewardUnit: s.rewardUnit ?? "x",
    monthlySpend: s.monthlySpend,
    monthlyReward: s.monthlyReward,
    actualReward: s.actualReward,
    gap: s.gap,
  }))
  type PointsRawItem = {
    program: string; balance: number; valuePerPoint: number; totalValue: number;
    estimatedMonthlyReward?: number; rewardType?: string; cardNames?: string[];
    cardImageUrls?: string[]
  }
  const pointsRaw = strategy?.pointsValuation ?? []
  const pointsArr: PointsRawItem[] = Array.isArray(pointsRaw) ? pointsRaw : []
  const pointsValuation = {
    programs: pointsArr.map((p) => ({
      programName: p.program,
      balance: p.balance,
      centsPerPoint: p.valuePerPoint * 100,
      totalValue: p.totalValue,
      estimatedMonthlyReward: p.estimatedMonthlyReward ?? 0,
      rewardType: p.rewardType ?? "cashback",
      cardNames: p.cardNames ?? [],
      cardImageUrls: p.cardImageUrls ?? [],
    })),
    totalValue: pointsArr.reduce((s, p) => s + p.totalValue, 0),
    totalMonthlyReward: pointsArr.reduce((s, p) => s + (p.estimatedMonthlyReward ?? 0), 0),
  }

  // Load real perks from database for all cards
  const cardIds = useMemo(() => (cards ?? []).map((c) => c.id), [cards])
  const { data: allPerks } = useAllCardPerks(cardIds)

  const cardPerksData = useMemo(() => {
    return mergedCards.map((c) => ({
      cardId: c.id,
      cardName: c.cardName,
      annualFee: c.annualFee ?? 0,
      cardImageUrl: c.cardImageUrl ?? null,
      issuer: c.institutionName,
      perks: (allPerks?.[c.id] ?? []).map((p) => ({
        id: p.id,
        perkName: p.name,
        perkValue: p.maxValue > 0 ? p.maxValue : null,
        perkType: p.perkType,
        period: p.period,
        maxValue: p.maxValue,
        usedValue: p.usedValue,
        daysRemaining: p.daysRemaining,
        percentUsed: p.percentUsed,
        periodEnd: p.periodEnd,
        periodLabel: p.periodLabel,
        annualizedValue: p.annualizedValue,
        isUsed: p.isUsed,
      })),
    }))
  }, [mergedCards, allPerks])

  if (!isLoading && (!cards || cards.length === 0) && creditAccounts.length === 0) {
    return (
      <div className="space-y-6">
        <GalleryHeader totalBalance={0} totalLimit={0} utilization={0} issuerCount={0} />
        <FinanceEmpty
          icon="credit_card"
          title="No credit cards found"
          description="Connect your bank accounts or add credit card details manually."
          linkTo={{ label: "Connect Accounts", href: "/finance/accounts" }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Gallery Header with Summary Stats */}
      <GalleryHeader
        totalBalance={totalBalance}
        totalLimit={totalLimit}
        utilization={utilization}
        issuerCount={issuerCount}
      />

      {/* Tab Selector */}
      <div className="flex gap-1 bg-background-secondary rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-card text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" && (
        <>
          {/* Bills Section — Hero + Calendar + Timeline */}
          <CardsBillsSection
            upcomingCount={upcomingCount}
            upcomingTotal={upcomingTotal}
            monthlyBillsTotal={monthlyBillsTotal}
            totalBalance={totalBalance}
            nextDue={nextDue}
            bills={allBills}
            paidCount={paidBills.length}
          />

          {/* Card Gallery Header — Refresh + Last Synced + Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Credit Cards</h3>
              <div className="flex items-center gap-3">
                {(() => {
                  if (!cards?.length) return null
                  const dates = cards.map((c) => c.aiEnrichedAt).filter(Boolean).map((d) => new Date(d!).getTime())
                  if (dates.length === 0) return null
                  const last = new Date(Math.max(...dates))
                  return (
                    <span className="text-[11px] text-foreground-muted">
                      Last synced {last.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {last.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  )
                })()}
                <button
                  onClick={() => {
                    if (!cards?.length) return
                    autoEnrich.mutate({
                      unenriched: cards.map((c) => c.id),
                      needsApply: [],
                      cardNames: cardNameMap,
                    })
                  }}
                  disabled={autoEnrich.isPending}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                    "border border-card-border/60 text-foreground-muted",
                    "hover:bg-card hover:text-foreground hover:border-card-border",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <span
                    className={cn("material-symbols-rounded", autoEnrich.isPending && "animate-spin")}
                    style={{ fontSize: 14 }}
                  >
                    sync
                  </span>
                  {autoEnrich.isPending ? "Syncing..." : "Refresh Cards"}
                </button>
              </div>
            </div>

            {/* Sync Progress */}
            {autoEnrich.progress && <EnrichProgressBar progress={autoEnrich.progress} />}
          </div>

          {/* Card Gallery by Issuer */}
          <div className="space-y-10">
            {Object.entries(cardsByIssuer).map(([issuer, issuerCards]) => (
              <IssuerGroup
                key={issuer}
                issuerName={issuer}
                cards={issuerCards.map((c) => ({
                  id: c.id,
                  cardName: c.cardName,
                  cardNetwork: c.cardNetwork,
                  mask: c.mask,
                  balance: c.balance,
                  creditLimit: c.creditLimit,
                  annualFee: c.annualFee,
                  rewardType: c.rewardType,
                  pointsBalance: c.pointsBalance,
                  cashbackBalance: c.cashbackBalance,
                  annualFeeDate: c.annualFeeDate,
                  nextPaymentDueDate: c.nextPaymentDueDate,
                  cardImageUrl: c.cardImageUrl,
                  accountType: c.accountType,
                }))}
              />
            ))}
          </div>

          {/* Auto-detect CTA for credit accounts without card profiles */}
          {creditAccounts.length > (cards?.length ?? 0) && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Credit accounts without card profiles</p>
                <p className="text-xs text-foreground-muted">Add card details to get reward optimization recommendations</p>
              </div>
              <button
                onClick={() => {
                  for (const acct of creditAccounts) {
                    const hasProfile = cards?.some((c) => c.accountId === acct.id)
                    if (!hasProfile) {
                      const knownFee = getKnownAnnualFee(acct.name, acct.institutionName)
                      saveCreditCard.mutate({
                        accountId: acct.id,
                        cardName: deriveCardName(acct),
                        cardNetwork: "visa",
                        rewardType: "cashback",
                        annualFee: knownFee ?? 0,
                      })
                    }
                  }
                }}
                disabled={saveCreditCard.isPending}
                className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
              >
                Auto-detect
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === "Card Strategy" && (
        <CardStrategyTab
          strategy={strategy ? {
            totalOptimalRewards: strategy.totalOptimalRewards,
            totalActualRewards: strategy.totalActualRewards,
            gapAmount: strategy.gapAmount,
          } : null}
          walletStrategy={walletStrategy}
          cardPerksData={cardPerksData}
          pointsPrograms={pointsValuation.programs}
          pointsTotalValue={pointsValuation.totalValue}
          pointsMonthlyReward={pointsValuation.totalMonthlyReward}
          recommendations={recs?.recommendations ?? []}
          onTogglePerk={(_cardId, perkId, data) =>
            togglePerk.mutate({ perkId, ...data })
          }
        />
      )}
    </div>
  )
}
