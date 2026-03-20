/**
 * Credit card CRUD, rewards, perks, and AI enrichment hooks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"

// ─── Types ──────────────────────────────────────────────────────

interface CreditCardProfile {
  id: string
  accountId: string
  cardNetwork: string
  cardName: string
  annualFee: number
  rewardType: string
  rewardProgram: string | null
  pointsBalance: number | null
  pointValue: number | null
  cashbackBalance: number | null
  totalEarned: number
  totalRedeemed: number
  baseRewardRate: number
  bonusCategories: unknown
  statementCredits: unknown
  annualFeeDate: string | null
  paymentDueDay: number | null
  transferPartners: unknown
  cardImageUrl: string | null
  aiEnrichedData: unknown
  aiEnrichedAt: string | null
}

interface CardRecommendation {
  category: string
  monthlySpend: number
  bestCard: string
  bestRate: number
  monthlyReward: number
}

interface CardPerk {
  id: string
  name: string
  value: number
  maxValue: number
  usedValue: number
  perkType: "limited" | "unlimited"
  period: "monthly" | "quarterly" | "annual" | "one_time"
  periodResetDay: number
  currentPeriodStart: string | null
  description: string | null
  isUsed: boolean
  usedDate: string | null
  percentUsed: number
  daysRemaining: number | null
  periodEnd: string | null
  periodLabel: string
  annualizedValue: number
}

interface CardRewardRate {
  id: string
  spendingCategory: string
  rewardRate: number
  rewardType: string
}

interface WalletStrategyItem {
  category: string
  bestCard: string
  bestRate: number
  monthlySpend: number
  monthlyReward: number
}

interface CardStrategyData {
  walletStrategy: WalletStrategyItem[]
  totalOptimalRewards: number
  totalActualRewards: number
  gapAmount: number
  pointsValuation: Array<{
    program: string
    balance: number
    valuePerPoint: number
    totalValue: number
  }>
}

// ─── Card Hooks ──────────────────────────────────────────────────

export function useCreditCards() {
  return useQuery({
    queryKey: financeKeys.cards(),
    queryFn: () => financeFetch<CreditCardProfile[]>("/cards"),
  })
}

export function useSaveCreditCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      accountId: string
      cardNetwork: string
      cardName: string
      annualFee?: number
      rewardType: string
      baseRewardRate?: number
      bonusCategories?: unknown
      statementCredits?: unknown
      rewardProgram?: string
      pointsBalance?: number
      pointValue?: number
      cashbackBalance?: number
      totalEarned?: number
      totalRedeemed?: number
      cardImageUrl?: string
      annualFeeDate?: string
    }) => financeFetch("/cards", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.cards() }),
  })
}

export function useCardRecommendations() {
  return useQuery({
    queryKey: financeKeys.cardRecommendations(),
    queryFn: () =>
      financeFetch<{ recommendations: CardRecommendation[]; totalOptimalRewards: number }>(
        "/cards/recommend"
      ),
  })
}

export function useCardStrategy() {
  return useQuery({
    queryKey: financeKeys.cardStrategy(),
    queryFn: () => financeFetch<CardStrategyData>("/cards/strategy"),
  })
}

// ─── Card Perks Hook ────────────────────────────────────────────

export function useCardPerks(cardId: string) {
  return useQuery({
    queryKey: financeKeys.cardPerks(cardId),
    queryFn: () => financeFetch<CardPerk[]>(`/cards/perks?cardId=${cardId}`),
    enabled: !!cardId,
  })
}

export function useSaveCardPerk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { cardProfileId: string; name: string; value: number; isUsed?: boolean }) =>
      financeFetch("/cards/perks", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

export function useToggleCardPerk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { perkId: string; addAmount?: number; setUsedValue?: number; isUsed?: boolean; note?: string }) =>
      financeFetch("/cards/perks", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

// ─── Card Reward Rates Hook ─────────────────────────────────────

export function useCardRewardRates(cardId: string) {
  return useQuery({
    queryKey: financeKeys.cardRewardRates(cardId),
    queryFn: () => financeFetch<CardRewardRate[]>(`/cards/reward-rates?cardId=${cardId}`),
    enabled: !!cardId,
  })
}

export function useSaveCardRewardRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      cardProfileId: string; spendingCategory: string; rewardRate: number; rewardType: string
    }) => financeFetch("/cards/reward-rates", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

// ─── Card Auto-Identify Hook ───────────────────────────────────

export function useAutoIdentifyCards() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      financeFetch<{ identified: number; total: number; cards: Array<{ id: string; oldName: string; newName: string; confidence: string }> }>(
        "/cards/auto-identify", { method: "POST" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.cards() }),
  })
}

// ─── Card AI Ask Hook ──────────────────────────────────────────

export function useCardAsk() {
  return useMutation({
    mutationFn: (data: {
      cardProfileId: string
      question: string
      history?: Array<{ role: "user" | "assistant"; content: string }>
    }) => financeFetch<{ answer: string }>("/cards/ask", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  })
}

// ─── Card AI Enrich Hook ────────────────────────────────────────

export function useCardAIEnrich() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { cardProfileId: string }) =>
      financeFetch<{ enrichedData: unknown; aiEnrichedAt: string }>("/cards/ai-enrich", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.cards() }),
  })
}
