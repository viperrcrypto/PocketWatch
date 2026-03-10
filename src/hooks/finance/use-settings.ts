/**
 * Finance settings, credentials, income, and AI provider hooks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { FinanceVerificationState, PlaidVerifyCode } from "@/lib/finance/verification-types"
import { financeFetch, financeKeys } from "./shared"

// ─── Types ──────────────────────────────────────────────────────

export interface FinanceSettingsService {
  service: string
  maskedKey: string
  environment: string
  updatedAt: string
  verified?: boolean
  verificationState?: FinanceVerificationState
  verifyCode?: PlaidVerifyCode
  verifyError?: string | null
}

export interface FinanceCredentialVerificationResponse {
  saved?: boolean
  service: string
  verified: boolean
  verificationState: FinanceVerificationState
  verifyCode: PlaidVerifyCode
  verifyError: string | null
}

interface IncomeData {
  override: number | null
  estimated: number
  effective: number
}

interface AIProviderData {
  providers: Array<{
    provider: string
    name: string
    verified: boolean
    verifyError: string | null
    updatedAt: string
  }>
}

// ─── Finance Settings Hooks ───────────────────────────────────────

export function useFinanceSettings() {
  return useQuery({
    queryKey: financeKeys.settings(),
    queryFn: () =>
      financeFetch<{ services: FinanceSettingsService[] }>("/settings"),
  })
}

export function useSaveFinanceCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      service: string
      clientId: string
      secret: string
      environment: string
    }) =>
      financeFetch<FinanceCredentialVerificationResponse>("/settings", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.settings() }),
  })
}

export function useVerifyFinanceCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { service: "plaid" }) =>
      financeFetch<FinanceCredentialVerificationResponse>("/settings/verify", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.settings() }),
  })
}

export function useDeleteFinanceCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (service: string) =>
      financeFetch(`/settings?service=${service}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.settings() }),
  })
}

// ─── Income Hooks ───────────────────────────────────────────────

export function useFinanceIncome() {
  return useQuery({
    queryKey: financeKeys.income(),
    queryFn: () => financeFetch<IncomeData>("/income"),
  })
}

export function useSetIncomeOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (monthlyIncome: number | null) =>
      financeFetch<{ monthlyIncomeOverride: number | null }>("/income", {
        method: "POST",
        body: JSON.stringify({ monthlyIncome }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.income() })
    },
  })
}

// ─── AI Provider Settings Hooks ──────────────────────────────────

export function useAISettings() {
  return useQuery({
    queryKey: financeKeys.aiSettings(),
    queryFn: () => financeFetch<AIProviderData>("/ai/settings"),
  })
}

export function useSaveAIProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { provider: string; apiKey?: string }) =>
      financeFetch<{ provider: string; verified: boolean; verifyError: string | null }>(
        "/ai/settings",
        { method: "POST", body: JSON.stringify(data) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.aiSettings() })
      qc.invalidateQueries({ queryKey: financeKeys.aiInsights() })
    },
  })
}

export function useDeleteAIProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (provider: string) =>
      financeFetch(`/ai/settings?provider=${provider}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.aiSettings() })
      qc.invalidateQueries({ queryKey: financeKeys.aiInsights() })
    },
  })
}
