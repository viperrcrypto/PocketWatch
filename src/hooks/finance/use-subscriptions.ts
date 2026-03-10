/**
 * Subscription detection and management hooks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { financeFetch, financeKeys } from "./shared"

// ─── Types ──────────────────────────────────────────────────────

export interface SubscriptionItem {
  id: string
  source: "detected" | "plaid" | "merged"
  detectionMethod: "auto" | "verified" | "manual"
  merchantName: string
  nickname: string | null
  amount: number
  averageAmount: number | null
  frequency: string
  category: string | null
  accountId: string | null
  lastChargeDate: string | null
  nextChargeDate: string | null
  status: string
  isWanted: boolean
  notes: string | null
  logoUrl: string | null
  plaidStreamId: string | null
  isActive: boolean
  accountName: string | null
  accountMask: string | null
  accountType: string | null
  institutionName: string | null
  recentTransactions: Array<{ amount: number; date: string; name: string }>
  billType: string | null
  classificationReason: string | null
  originalMerchantName: string | null
}

interface SubscriptionResponse {
  subscriptions: SubscriptionItem[]
  monthlyTotal: number
  yearlyTotal: number
  inflows?: Array<{
    streamId: string
    merchantName: string
    amount: number
    averageAmount: number | null
    frequency: string
    isActive: boolean
  }>
}

interface CancelGuidanceResponse {
  available: boolean
  reason?: string
  guidance?: {
    steps: Array<{ step: number; instruction: string; url?: string }>
    estimatedTime: string
    difficulty: "easy" | "medium" | "hard"
    tips: string[]
  }
  provider?: string
}

// ─── Subscription Hooks ─────────────────────────────────────────

export function useFinanceSubscriptions() {
  return useQuery({
    queryKey: financeKeys.subscriptions(),
    queryFn: () => financeFetch<SubscriptionResponse>("/subscriptions"),
  })
}

export function useUpdateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      subscriptionId: string
      status?: string
      isWanted?: boolean
      notes?: string
      nickname?: string | null
      frequency?: string
      category?: string | null
    }) => financeFetch("/subscriptions", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.subscriptions() }),
    onError: () => { toast.error("Failed to update subscription") },
  })
}

export function useDetectSubscriptions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      financeFetch<{ detected: number; newlyAdded: number; updated: number }>(
        "/subscriptions/detect",
        { method: "POST" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.subscriptions() }),
  })
}

export function useCancelGuidance() {
  return useMutation({
    mutationFn: (data: { merchantName: string; amount: number; frequency: string }) =>
      financeFetch<CancelGuidanceResponse>("/subscriptions/cancel-guide", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  })
}

// ─── Recurring Streams Hook ──────────────────────────────────────

export function useRecurringStreams() {
  return useQuery({
    queryKey: financeKeys.recurring(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => financeFetch<{
      inflows: Array<any>
      outflows: Array<any>
      totalMonthlyInflow: number
      totalMonthlyOutflow: number
    }>("/recurring"),
  })
}
