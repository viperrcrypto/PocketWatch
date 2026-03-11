"use client"

import type { ExternalServiceVerificationState } from "@/lib/portfolio/verification"

// ─── Fetch Helper ───

const CLIENT_TIMEOUT_MS = 60_000 // 60s — above proxy's 55s timeout to let it finish

export async function portfolioFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/portfolio${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    signal: options?.signal ?? AbortSignal.timeout(CLIENT_TIMEOUT_MS),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ─── Shared Types ───

export interface ExternalServiceResponseItem {
  id?: string
  name: string
  label?: string | null
  api_key: string
  configured: boolean
  verified: boolean
  verificationState?: ExternalServiceVerificationState
  verifyError?: string | null
  consecutive429?: number
  lastUsedAt?: string | null
  multiKeyEnabled?: boolean
  keyCount?: number
  isExchange?: boolean
  exchangeId?: string
  exchangeLabel?: string
  exchangeDomain?: string
}

export interface ExternalServicesResponse {
  services?: ExternalServiceResponseItem[]
  result?: {
    services?: ExternalServiceResponseItem[]
  }
}

export interface ExternalServiceMutationResult {
  success: boolean
  name?: string
  serviceName?: string
  isExchange?: boolean
  verified: boolean
  verificationState?: ExternalServiceVerificationState
  verifyCode?: string
  verifyError?: string | null
  disabledChains?: string[]
}

// ─── Query Key Factory ───

export const portfolioKeys = {
  all: ["portfolio"] as const,
  status: () => [...portfolioKeys.all, "status"] as const,
  overview: () => [...portfolioKeys.all, "overview"] as const,
  balances: () => [...portfolioKeys.all, "balances"] as const,
  blockchainBalances: (chain?: string) => [...portfolioKeys.all, "balances", "blockchain", chain] as const,
  exchangeBalances: () => [...portfolioKeys.all, "balances", "exchange"] as const,
  manualBalances: () => [...portfolioKeys.all, "balances", "manual"] as const,
  accounts: () => [...portfolioKeys.all, "accounts"] as const,
  historyEvents: (params: Record<string, unknown>) => [...portfolioKeys.all, "history", "events", params] as const,
  netValueHistory: (range = "ALL", scope = "total") =>
    [...portfolioKeys.all, "history", "snapshots", range, scope] as const,
  assets: () => [...portfolioKeys.all, "assets"] as const,
  prices: () => [...portfolioKeys.all, "prices"] as const,
  settings: () => [...portfolioKeys.all, "settings"] as const,
  externalServices: () => [...portfolioKeys.all, "external-services"] as const,
  task: (taskId: string | null) => [...portfolioKeys.all, "tasks", taskId] as const,
  addressBook: () => [...portfolioKeys.all, "address-book"] as const,
  assetMappings: (ids: string[]) => [...portfolioKeys.all, "asset-mappings", ...ids.sort()] as const,
  staking: () => [...portfolioKeys.all, "staking"] as const,
  stakingHistoryRoot: () => [...portfolioKeys.all, "staking", "history"] as const,
  stakingHistory: (params?: { year?: number; range?: string; positionKey?: string; protocol?: string }) =>
    [
      ...portfolioKeys.stakingHistoryRoot(),
      params?.year ?? null,
      params?.range ?? "all",
      params?.positionKey ?? null,
      params?.protocol ?? null,
    ] as const,
  classify: (params: Record<string, unknown>) => [...portfolioKeys.all, "history", "classify", params] as const,
  exchangeTransactions: () => [...portfolioKeys.all, "history", "exchange"] as const,
  syncProgress: (params = "") => [...portfolioKeys.all, "history", "sync-progress", params] as const,
  repairSummary: () => [...portfolioKeys.all, "history", "repair-summary"] as const,
  lpPositions: () => [...portfolioKeys.all, "balances", "lp"] as const,
}
