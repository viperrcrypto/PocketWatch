/**
 * Travel credential management hooks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { travelFetch, travelKeys } from "./shared"
import type { TravelCredentialInfo } from "@/types/travel"

export function useTravelCredentials() {
  return useQuery({
    queryKey: travelKeys.credentials(),
    queryFn: () => travelFetch<{ services: TravelCredentialInfo[] }>("/credentials"),
  })
}

export function useSaveTravelCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { service: "roame" | "serpapi" | "atf" | "roame_refresh" | "pointme"; key: string }) =>
      travelFetch<{ saved: boolean }>("/credentials", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: travelKeys.credentials() }),
  })
}

export function useDeleteTravelCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (service: "roame" | "serpapi" | "atf" | "roame_refresh" | "pointme" | "atf_oauth") =>
      travelFetch<{ deleted: boolean }>(`/credentials?service=${service}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: travelKeys.credentials() }),
  })
}
