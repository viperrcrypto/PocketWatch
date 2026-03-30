import { useQuery } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"
import type { LocationsResponse } from "@/components/finance/where-ive-been-types"

export function useTransactionLocations() {
  return useQuery({
    queryKey: financeKeys.locations(),
    queryFn: () => financeFetch<LocationsResponse>("/locations"),
    staleTime: 5 * 60 * 1000,
  })
}
