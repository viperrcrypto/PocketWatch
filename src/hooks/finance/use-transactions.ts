/**
 * Transaction query, categorization, and bulk operation hooks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"
import type { TxFilters } from "./shared"

export type { TxFilters }

// ─── Types ──────────────────────────────────────────────────────

interface TxResponse {
  transactions: Array<{
    id: string
    accountId: string
    date: string
    name: string
    merchantName: string | null
    amount: number
    currency: string
    category: string | null
    subcategory: string | null
    isPending: boolean
    isExcluded: boolean
    notes: string | null
    tags: string[]
    account: { name: string; mask: string | null }
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface UncategorizedTransaction {
  id: string
  merchantName: string | null
  name: string
  cleanedName: string
  amount: number
  date: string
  logoUrl: string | null
  accountName: string | null
  accountMask: string | null
  suggestedCategories: Array<{
    category: string
    subcategory: string | null
    source: string
    confidence: "high" | "medium" | "low"
  }>
}

interface UncategorizedResponse {
  transactions: UncategorizedTransaction[]
  total: number
  hasMore: boolean
}

interface AICategorizeResponse {
  suggestions: Array<{
    merchantName: string
    transactionIds: string[]
    suggestedCategory: string
    suggestedSubcategory: string | null
    confidence: "high" | "medium" | "low"
    reasoning: string
    transactionCount: number
  }>
  provider: string
  providerLabel: string
}

interface ApplyAIResult {
  applied: number
  rulesCreated: number
  remaining: number
}

interface AIAuditSuggestion {
  merchantName: string
  transactionIds: string[]
  currentCategory: string
  suggestedCategory: string
  suggestedSubcategory: string | null
  confidence: "high" | "medium" | "low"
  reasoning: string
}

interface AIAuditResponse {
  suggestions: AIAuditSuggestion[]
  provider: string
  providerLabel: string
}

// ─── Transaction Hooks ──────────────────────────────────────────

export function useFinanceTransactions(filters: TxFilters = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v))
  }

  return useQuery({
    queryKey: financeKeys.transactions(filters),
    queryFn: () =>
      financeFetch<TxResponse>(`/transactions?${params.toString()}`),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      transactionId: string
      category?: string
      subcategory?: string
      notes?: string
      tags?: string[]
      isExcluded?: boolean
    }) => financeFetch("/transactions", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}

export function useUpdateTransactionCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      transactionId: string
      category: string
      subcategory?: string
      nickname?: string
      createRule?: boolean
    }) =>
      financeFetch(`/transactions/${data.transactionId}/category`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

export function useBulkCategorize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      transactionIds: string[]
      category?: string
      subcategory?: string
      isExcluded?: boolean
      tags?: string[]
    }) => financeFetch("/transactions/bulk", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

export function useAutoCategorize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<{ categorized: number; remaining: number; aiCategorized: number }> => {
      // Step 1: Rule-based categorization
      const ruleResult = await financeFetch<{ categorized: number; remaining: number }>(
        "/transactions/categorize",
        { method: "POST" }
      )

      if (ruleResult.remaining === 0) {
        return { ...ruleResult, aiCategorized: 0 }
      }

      // Step 2: AI categorization for remaining
      let aiCategorized = 0
      try {
        const aiResult = await financeFetch<AICategorizeResponse>(
          "/transactions/ai-categorize",
          { method: "POST" }
        )

        if (aiResult.suggestions.length > 0) {
          // Step 3: Auto-apply all AI suggestions with rule creation
          const applyResult = await financeFetch<ApplyAIResult>(
            "/transactions/ai-categorize/apply",
            {
              method: "POST",
              body: JSON.stringify({
                accepted: aiResult.suggestions.map((s) => ({
                  transactionIds: s.transactionIds,
                  category: s.suggestedCategory,
                  subcategory: s.suggestedSubcategory ?? undefined,
                  createRule: true,
                  merchantName: s.merchantName,
                })),
              }),
            }
          )
          aiCategorized = applyResult.applied
        }
      } catch {
        // AI failed — still return rule-based results
      }

      return {
        categorized: ruleResult.categorized + aiCategorized,
        remaining: ruleResult.remaining - aiCategorized,
        aiCategorized,
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

export function useUncategorizedTransactions(offset = 0) {
  return useQuery({
    queryKey: [...financeKeys.uncategorized(), offset] as const,
    queryFn: () =>
      financeFetch<UncategorizedResponse>(
        `/transactions/uncategorized?limit=20&offset=${offset}`
      ),
    refetchOnMount: "always",
  })
}

// ─── AI Categorize Hooks ────────────────────────────────────────

export function useAICategorize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      financeFetch<AICategorizeResponse>(
        "/transactions/ai-categorize",
        { method: "POST" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.aiCategorize() }),
  })
}

export function useApplyAISuggestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      accepted: Array<{
        transactionIds: string[]
        category: string
        subcategory?: string
        createRule?: boolean
        merchantName: string
      }>
    }) =>
      financeFetch<ApplyAIResult>(
        "/transactions/ai-categorize/apply",
        { method: "POST", body: JSON.stringify(data) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

// ─── AI Audit Hooks ────────────────────────────────────────────

export function useAIAudit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      financeFetch<AIAuditResponse>(
        "/transactions/ai-audit",
        { method: "POST" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.aiAudit() }),
  })
}

export function useApplyAIAudit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      accepted: Array<{
        transactionIds: string[]
        category: string
        subcategory?: string
        createRule?: boolean
        merchantName: string
      }>
    }) =>
      financeFetch<ApplyAIResult>(
        "/transactions/ai-categorize/apply",
        { method: "POST", body: JSON.stringify(data) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  })
}
