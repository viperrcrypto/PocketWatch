"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  useCreditCards, useCardRecommendations, useFinanceAccounts,
  useSaveCreditCard, useCardStrategy, useToggleCardPerk,
  useUpcomingBills, useFinanceSubscriptions, useLiabilities,
  useAutoIdentifyCards,
} from "@/hooks/use-finance"
import { formatCurrency, cn } from "@/lib/utils"
import { FinanceHeroCard } from "@/components/finance/finance-hero-card"
import { GalleryHeader } from "@/components/finance/gallery-header"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { BillsCalendar } from "@/components/finance/bills-calendar"
import { IssuerGroup } from "@/components/finance/issuer-group"
import { WalletStrategyGrid } from "@/components/finance/wallet-strategy-grid"
import { PerksTracker } from "@/components/finance/perks-tracker"
import { PointsPortfolio } from "@/components/finance/points-portfolio"
import { detectIssuer } from "@/components/finance/credit-card-visual"
import { looksLikePersonName, deriveCardName } from "@/components/finance/cards-page-helpers"

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

  // Get credit accounts from institutions
  const creditAccounts = useMemo(() => {
    return institutions?.flatMap((inst) =>
      inst.accounts
        .filter((a) => a.type === "credit" || a.type === "business_credit")
        .map((a) => ({ ...a, institutionName: inst.institutionName }))
    ) ?? []
  }, [institutions])

  // Merge card profiles with credit account data
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
      const acct = creditAccounts.find((a) => a.id === c.accountId)
      const liab = creditCardLiabilities.find((l: { accountId: string }) => l.accountId === c.accountId)
      const instName = acct?.institutionName ?? ""

      // Re-derive card name at display time to fix stored bad names
      // (e.g. cardholder names like "Z. KAL" or generic "Credit Card")
      const storedName = c.cardName
      const needsRename = looksLikePersonName(storedName) || /^credit\s*card$/i.test(storedName)
      const displayName = needsRename
        ? deriveCardName({ name: acct?.name ?? storedName, officialName: acct?.officialName, mask: acct?.mask, institutionName: instName })
        : storedName

      return {
        ...c,
        cardName: displayName,
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
  }, [cards, creditAccounts, liabilities])

  // Auto-identify unidentified cards (generic names like "Chase Card ••••3132")
  const identifyTriggered = useRef(false)
  const hasUnidentified = mergedCards.some((c) => /card\s*••••\d{4}$/i.test(c.cardName))
  useEffect(() => {
    if (hasUnidentified && !identifyTriggered.current && !autoIdentify.isPending) {
      identifyTriggered.current = true
      autoIdentify.mutate()
    }
  }, [hasUnidentified]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const upcomingCount = billsData?.bills.length ?? 0
  const upcomingTotal = billsData?.bills.reduce((s, b) => s + b.amount, 0) ?? 0
  const nextDue = billsData?.bills[0]

  // Wallet strategy
  const walletStrategy = (strategy?.walletStrategy ?? []).map((s: { category: string; bestCard: string; bestRate: number }) => ({
    category: s.category,
    cardName: s.bestCard,
    rewardRate: s.bestRate,
    rewardUnit: "x",
  }))
  const pointsRaw = strategy?.pointsValuation ?? []
  const pointsValuation = {
    programs: (Array.isArray(pointsRaw) ? pointsRaw : []).map((p: { program: string; balance: number; valuePerPoint: number; totalValue: number }) => ({
      programName: p.program,
      balance: p.balance,
      centsPerPoint: p.valuePerPoint * 100,
      totalValue: p.totalValue,
    })),
    totalValue: (Array.isArray(pointsRaw) ? pointsRaw : []).reduce((s: number, p: { totalValue: number }) => s + p.totalValue, 0),
  }

  const cardPerksData = useMemo(() => {
    return (cards ?? []).map((c) => ({
      cardId: c.id,
      cardName: c.cardName,
      annualFee: c.annualFee ?? 0,
      perks: [] as Array<{ id: string; perkName: string; perkValue: number | null; isUsed: boolean }>,
    }))
  }, [cards])

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
    <div className="space-y-8">
      {/* Gallery Header with Summary Stats */}
      <GalleryHeader
        totalBalance={totalBalance}
        totalLimit={totalLimit}
        utilization={utilization}
        issuerCount={issuerCount}
      />

      {/* Tab Selector */}
      <div className="flex gap-1 bg-gray-100 dark:bg-background-secondary rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-white dark:bg-card text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" && (
        <>
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
            <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Credit accounts without card profiles</p>
                <p className="text-xs text-foreground-muted">Add card details to get reward optimization recommendations</p>
              </div>
              <button
                onClick={() => {
                  for (const acct of creditAccounts) {
                    const hasProfile = cards?.some((c) => c.accountId === acct.id)
                    if (!hasProfile) {
                      saveCreditCard.mutate({
                        accountId: acct.id,
                        cardName: deriveCardName(acct),
                        cardNetwork: "visa",
                        rewardType: "cashback",
                      })
                    }
                  }
                }}
                disabled={saveCreditCard.isPending}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/10 transition-colors"
              >
                Auto-detect
              </button>
            </div>
          )}

          {/* Bills Section */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>receipt_long</span>
              Upcoming Bills
            </h3>
            <FinanceHeroCard
              label="Coming Up"
              value={`${upcomingCount} charge${upcomingCount !== 1 ? "s" : ""} · ${formatCurrency(upcomingTotal)}`}
              footerStats={[
                { label: "Monthly Bills", value: formatCurrency(monthlyBillsTotal) },
                { label: "Credit Balance", value: formatCurrency(totalBalance) },
                {
                  label: "Next Due",
                  value: nextDue
                    ? (nextDue.daysUntil === 0 ? "Today" : nextDue.daysUntil === 1 ? "Tomorrow" : `${nextDue.daysUntil} days`)
                    : "\u2014",
                },
              ]}
            />
          </div>

          {/* Bills Calendar + Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-card-border rounded-xl p-5">
              <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-4 block">
                Bills Calendar
              </span>
              <BillsCalendar bills={billsData?.bills ?? []} />
            </div>
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-card-border/50">
                <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                  Upcoming Bills
                </span>
              </div>
              <div className="divide-y divide-card-border/30 max-h-[400px] overflow-y-auto">
                {billsData?.bills.slice(0, 10).map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        bill.daysUntil <= 3 ? "bg-amber-500" : bill.daysUntil <= 7 ? "bg-blue-400" : "bg-foreground-muted/20"
                      )} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{bill.merchantName}</p>
                        <p className="text-[10px] text-foreground-muted">
                          {bill.daysUntil === 0 ? "Due today" : bill.daysUntil === 1 ? "Tomorrow" : `In ${bill.daysUntil} days`}
                        </p>
                      </div>
                    </div>
                    <span className="font-data text-sm font-semibold text-foreground tabular-nums">
                      {formatCurrency(bill.amount)}
                    </span>
                  </div>
                )) ?? (
                  <p className="text-sm text-foreground-muted text-center py-8">No upcoming bills</p>
                )}
              </div>
            </div>
          </div>

        </>
      )}

      {activeTab === "Card Strategy" && (
        <>
          {/* Wallet Strategy */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Wallet Strategy</h3>
            <p className="text-xs text-foreground-muted mb-4">Best card to use for each spending category</p>
            <WalletStrategyGrid strategies={walletStrategy} />
          </div>

          {/* Two-Column: Perks Tracker + Points Portfolio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-card-border/50">
                <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                  Perks Tracker
                </span>
              </div>
              <PerksTracker
                cards={cardPerksData}
                onTogglePerk={(_cardId, perkId, isUsed) =>
                  togglePerk.mutate({ perkId, isUsed })
                }
              />
            </div>
            <div className="bg-card border border-card-border rounded-xl p-5">
              <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-4 block">
                Points Portfolio
              </span>
              <PointsPortfolio
                programs={pointsValuation.programs}
                totalValue={pointsValuation.totalValue}
              />
            </div>
          </div>

          {/* Category Comparison */}
          {recs && recs.recommendations.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-card-border/50">
                <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                  Card Comparison by Category
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border/50">
                      <th className="text-left px-5 py-2 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Category</th>
                      <th className="text-left px-5 py-2 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Best Card</th>
                      <th className="text-right px-5 py-2 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border/30">
                    {recs.recommendations.map((r) => (
                      <tr key={r.category}>
                        <td className="px-5 py-2 font-medium text-foreground">{r.category}</td>
                        <td className="px-5 py-2 text-foreground-muted">{r.bestCard}</td>
                        <td className="px-5 py-2 text-right font-data font-semibold text-primary tabular-nums">
                          {r.bestRate}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
