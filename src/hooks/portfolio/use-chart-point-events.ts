"use client"

import { useQuery } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"

interface ChartPointEvent {
  txHash: string
  chain: string
  direction: "in" | "out"
  symbol: string | null
  amount: number | null
  usdValue: number | null
  classification: string | null
  timestamp: number
}

interface ChartPointEventsResponse {
  events: ChartPointEvent[]
  total: number
}

const HALF_DAY_SEC = 12 * 60 * 60

/**
 * Fetch transactions within ±12h of a chart point timestamp.
 * Groups them by classification for the detail panel.
 */
export function useChartPointEvents(timestamp: number | null) {
  const from = timestamp ? timestamp - HALF_DAY_SEC : 0
  const to = timestamp ? timestamp + HALF_DAY_SEC : 0

  return useQuery({
    queryKey: [...portfolioKeys.historyEvents({ from_timestamp: from, to_timestamp: to }), "chartPoint"],
    queryFn: () =>
      portfolioFetch<ChartPointEventsResponse>(
        `/history/events?from_timestamp=${from}&to_timestamp=${to}&limit=100`
      ),
    enabled: timestamp !== null && timestamp > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export type { ChartPointEvent, ChartPointEventsResponse }
