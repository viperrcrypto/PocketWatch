/**
 * Hooks for the pattern review flow.
 * Manages review queue, confirm/change/skip actions, and badge count.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"

// ─── Types ──────────────────────────────────────────────────────

export interface ReviewTransaction {
  id: string
  merchantName: string | null
  name: string
  cleanedName: string
  amount: number
  date: string
  currentCategory: string | null
  currentSubcategory: string | null
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

interface ReviewResponse {
  transactions: ReviewTransaction[]
  total: number
  hasMore: boolean
}

interface ReviewCountResponse {
  count: number
}

// ─── Hooks ──────────────────────────────────────────────────────

/** Sidebar badge count — polls every 60s */
export function useReviewCount() {
  return useQuery({
    queryKey: financeKeys.reviewCount(),
    queryFn: () => financeFetch<ReviewCountResponse>("/transactions/review?countOnly=true"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** Paginated review queue */
export function useReviewQueue(offset = 0) {
  return useQuery({
    queryKey: financeKeys.reviewQueue(offset),
    queryFn: () => financeFetch<ReviewResponse>(`/transactions/review?limit=20&offset=${offset}`),
    staleTime: 15_000,
  })
}

/** Confirm a review decision (accept/change/skip) */
export function useConfirmReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      transactionId: string
      action: "accept" | "change" | "skip"
      category?: string
      subcategory?: string
    }) => financeFetch<{ action: string; confidence?: number; category?: string }>(
      "/transactions/review/confirm",
      { method: "POST", body: JSON.stringify(data) }
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.reviewCount() })
      qc.invalidateQueries({ queryKey: financeKeys.reviewQueue() })
    },
  })
}
