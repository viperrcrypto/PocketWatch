"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"

// ─── 25. Airdrops ───

export function useAirdrops() {
  return useQuery({
    queryKey: portfolioKeys.airdrops(),
    queryFn: () => portfolioFetch<unknown>("/airdrops"),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ─── 25b. Scan Airdrops (force-refresh) ───

export function useScanAirdrops() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<unknown>("/airdrops", { method: "POST" }),
    onSuccess: (data) => {
      // Replace the cached query data with fresh scan results
      qc.setQueryData(portfolioKeys.airdrops(), data)
    },
  })
}

// ─── 25c. Vesting Claims ───

export function useVestingClaims() {
  return useQuery({
    queryKey: portfolioKeys.vestingClaims(),
    queryFn: () => portfolioFetch<unknown>("/vesting-claims"),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ─── 25d. Scan Vesting Claims (force-refresh) ───

export function useScanVestingClaims() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      portfolioFetch<unknown>("/vesting-claims", { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(portfolioKeys.vestingClaims(), data)
    },
  })
}

// ─── 26. Address Book ───

export function useAddressBook() {
  return useQuery({
    queryKey: portfolioKeys.addressBook(),
    queryFn: () => portfolioFetch<any>("/address-book"),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  })
}

// ─── 26b. Add Address Book Entry ───

export function useAddAddressBookEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { address: string; name: string; blockchain: string }) =>
      portfolioFetch<any>("/address-book", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.addressBook() })
      qc.invalidateQueries({ queryKey: portfolioKeys.historyEvents({}) })
    },
  })
}

// ─── 26c. Delete Address Book Entry ───

export function useDeleteAddressBookEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { address: string; blockchain: string }) =>
      portfolioFetch<any>("/address-book", {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.addressBook() })
      qc.invalidateQueries({ queryKey: portfolioKeys.historyEvents({}) })
    },
  })
}
