"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"
import { useExternalServices } from "./use-services"
import { useTrackedAccounts } from "./use-accounts"

// ─── 1. Status ───

export function usePortfolioStatus() {
  return useQuery({
    queryKey: portfolioKeys.status(),
    queryFn: () => portfolioFetch<any>("/status"),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ─── 2. Provision ───

export function usePortfolioProvision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<any>("/provision", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.status() })
    },
  })
}

// ─── 28. Onboarding Status ───

export function useOnboardingStatus() {
  const { data: status, isLoading: statusLoading, isError: statusError } = usePortfolioStatus()
  const { data: services, isLoading: servicesLoading, isError: servicesError } = useExternalServices()
  const { data: accounts, isLoading: accountsLoading, isError: accountsError } = useTrackedAccounts()

  const isProvisioned = !!status?.isProvisioned
  // hasSharedKey = admin configured a platform-level ZERION_API_KEY — users don't need their own
  const hasSharedKey = !!status?.hasSharedKey
  // API returns { services: [{name, api_key, ...}] } — unwrap the array
  const serviceList = Array.isArray(services?.services) ? services.services : []
  const hasApiKeys = serviceList.length > 0 || hasSharedKey
  // API returns { ETH: [...], OPTIMISM: [...] } — check if any chain has accounts
  const hasAccounts = accounts && typeof accounts === "object"
    ? Object.values(accounts).some(
        (chainAccounts) => Array.isArray(chainAccounts) && chainAccounts.length > 0
      )
    : false

  return {
    isProvisioned,
    hasApiKeys,
    hasSharedKey,
    hasAccounts,
    // Show the dashboard as soon as the user has at least one wallet tracked.
    // The dashboard handles missing Zerion API keys with its own empty state
    // ("Zerion API Key Required"), so there's no need to gate on hasApiKeys here.
    // Without this, users who skip the API key step in the wizard get stuck
    // seeing the wizard on every subsequent page load (wizardCompleted resets).
    isComplete: hasAccounts,
    isLoading: statusLoading || servicesLoading || accountsLoading,
    isError: statusError || servicesError || accountsError,
    // If shared key exists, skip straight to wallet step. Otherwise start at API key step.
    // Start at step 1 (Welcome) only when neither key nor wallets are configured.
    suggestedStep: !hasApiKeys && !hasAccounts ? 1 : !hasApiKeys ? 2 : !hasAccounts ? 3 : 4,
  }
}
