/**
 * Saved route hooks for the travel module.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { travelFetch, travelKeys } from "./shared"

// Mirrors ROUTE_SELECT in the saved-routes API route exactly (userId/updatedAt
// are intentionally not returned to the client).
export interface SavedRoute {
  id: string
  origin: string
  destination: string
  departureDate: string
  returnDate: string | null
  tripType: "one_way" | "round_trip"
  searchClass: string
  alertThreshold: number | null
  thresholdType: "cash" | "points"
  active: boolean
  lastPrice: number | null
  lastCheckedAt: string | null
  createdAt: string
}

export function useSavedRoutes() {
  return useQuery({
    queryKey: travelKeys.savedRoutes(),
    queryFn: () => travelFetch<{ routes: SavedRoute[] }>("/saved-routes"),
  })
}

export function useCreateSavedRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      origin: string
      destination: string
      departureDate: string
      returnDate?: string
      tripType?: "one_way" | "round_trip"
      searchClass?: string
      alertThreshold?: number
      thresholdType?: "cash" | "points"
    }) =>
      travelFetch<{ route: SavedRoute }>("/saved-routes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: travelKeys.savedRoutes() }),
  })
}

export function useDeleteSavedRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      travelFetch<{ deleted: boolean }>(`/saved-routes?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: travelKeys.savedRoutes() }),
  })
}
