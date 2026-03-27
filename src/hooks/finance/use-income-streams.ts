/**
 * Hook for the recurring income stream manager.
 */

import { useQuery } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"

export interface IncomeStream {
  merchantName: string
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "quarterly" | "irregular"
  avgAmount: number
  lastAmount: number
  lastDate: string
  nextExpected: string | null
  monthCount: number
  totalReceived: number
  consistency: number
  status: "on_track" | "late" | "missed" | "new"
}

interface IncomeStreamsResponse {
  streams: IncomeStream[]
  summary: {
    totalSources: number
    recurringSources: number
    monthlyEstimate: number
    totalReceived6mo: number
    lateOrMissed: number
  }
}

export function useIncomeStreams() {
  return useQuery({
    queryKey: financeKeys.incomeStreams(),
    queryFn: () => financeFetch<IncomeStreamsResponse>("/income/streams"),
    staleTime: 5 * 60 * 1000,
  })
}
