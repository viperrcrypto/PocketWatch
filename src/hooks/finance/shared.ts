/**
 * Shared fetch helper, query key factory, and shared types
 * for the Finance (fiat) React Query hooks.
 */

// ─── Shared Types ────────────────────────────────────────────────

export interface TxFilters {
  page?: number
  limit?: number
  startDate?: string
  endDate?: string
  category?: string
  accountId?: string
  search?: string
  minAmount?: string
  maxAmount?: string
  sort?: string
  order?: string
  txType?: string
}

// ─── Fetch Helper ───────────────────────────────────────────────

import { csrfHeaders } from "@/lib/csrf-client"

export async function financeFetch<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs = 60_000, ...fetchOptions } = options ?? {}
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`/api/finance${path}`, {
      ...fetchOptions,
      credentials: "include",
      headers: csrfHeaders({
        "Content-Type": "application/json",
        ...fetchOptions?.headers,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }

    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Query Key Factory ──────────────────────────────────────────

export const financeKeys = {
  all: ["finance"] as const,
  accounts: () => [...financeKeys.all, "accounts"] as const,
  transactions: (filters: TxFilters) =>
    [...financeKeys.all, "transactions", filters] as const,
  budgets: () => [...financeKeys.all, "budgets"] as const,
  subscriptions: () => [...financeKeys.all, "subscriptions"] as const,
  cards: () => [...financeKeys.all, "cards"] as const,
  cardRecommendations: () => [...financeKeys.all, "card-recs"] as const,
  insights: () => [...financeKeys.all, "insights"] as const,
  deepInsights: () => [...financeKeys.all, "deep-insights"] as const,
  netWorth: (range: string, includeInvestments = true) =>
    [...financeKeys.all, "net-worth", range, includeInvestments] as const,
  categoryRules: () => [...financeKeys.all, "category-rules"] as const,
  settings: () => [...financeKeys.all, "settings"] as const,
  trends: (months: number) => [...financeKeys.all, "trends", months] as const,
  bills: () => [...financeKeys.all, "bills"] as const,
  cardPerks: (cardId: string) => [...financeKeys.all, "card-perks", cardId] as const,
  cardRewardRates: (cardId: string) => [...financeKeys.all, "card-reward-rates", cardId] as const,
  cardStrategy: () => [...financeKeys.all, "card-strategy"] as const,
  accountSpending: (period: string) =>
    [...financeKeys.all, "account-spending", period] as const,
  investments: () => [...financeKeys.all, "investments"] as const,
  liabilities: () => [...financeKeys.all, "liabilities"] as const,
  investmentHoldings: () => [...financeKeys.all, "investment-holdings"] as const,
  investmentHistory: (range: string) =>
    [...financeKeys.all, "investment-history", range] as const,
  investmentTransactions: (filters: Record<string, unknown>) =>
    [...financeKeys.all, "investment-txs", filters] as const,
  cancelGuide: () => [...financeKeys.all, "cancel-guide"] as const,
  recurring: () => [...financeKeys.all, "recurring"] as const,
  identity: () => [...financeKeys.all, "identity"] as const,
  plaidSyncStatus: () => [...financeKeys.all, "plaid-status"] as const,
  income: () => [...financeKeys.all, "income"] as const,
  incomeStreams: () => [...financeKeys.all, "incomeStreams"] as const,
  aiInsights: () => [...financeKeys.all, "ai-insights"] as const,
  aiSettings: () => [...financeKeys.all, "ai-settings"] as const,
  budgetSuggestions: () => [...financeKeys.all, "budget-suggestions"] as const,
  budgetAI: () => [...financeKeys.all, "budget-ai"] as const,
  categories: () => [...financeKeys.all, "categories"] as const,
  uncategorized: () => [...financeKeys.all, "uncategorized"] as const,
  aiCategorize: () => [...financeKeys.all, "ai-categorize"] as const,
  aiAudit: () => [...financeKeys.all, "ai-audit"] as const,
  spendingByMonth: (month?: string) =>
    [...financeKeys.all, "spending-by-month", month] as const,
  coverage: () => [...financeKeys.all, "coverage"] as const,
  bonusTrackers: () => [...financeKeys.all, "bonus-trackers"] as const,
  bonusSearch: (q: string) => [...financeKeys.all, "bonus-search", q] as const,
  reviewQueue: (offset?: number) => [...financeKeys.all, "review-queue", offset] as const,
  reviewCount: () => [...financeKeys.all, "review-count"] as const,
  aiRebuild: () => [...financeKeys.all, "ai-rebuild"] as const,
}
