"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"

// ─── Address Book ───

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

// ─── Add Address Book Entry ───

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

