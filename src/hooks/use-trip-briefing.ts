/**
 * Travel-day briefing hook — weather + next flight for a single trip.
 * Reuses the trips query-key factory; mirrors the useTrip fetch pattern.
 */

import { useQuery } from "@tanstack/react-query"
import { csrfHeaders } from "@/lib/csrf-client"
import { tripKeys } from "@/hooks/use-trips"

export interface BriefingWeather {
  tempF: number
  condition: string
  forecastHigh: number
  forecastLow: number
  chanceOfRain: number
}

export interface BriefingNextFlight {
  title: string
  startAt: string
  location: string | null
}

export interface TravelDayBriefing {
  weather: BriefingWeather | null
  nextFlight: BriefingNextFlight | null
  tips: string[]
}

async function fetchBriefing(id: string): Promise<TravelDayBriefing> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(`/api/trips/${id}/briefing`, {
      credentials: "include",
      headers: csrfHeaders({ "Content-Type": "application/json" }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }

    const data = (await res.json()) as { briefing: TravelDayBriefing }
    return data.briefing
  } finally {
    clearTimeout(timeout)
  }
}

export function useTripBriefing(id: string) {
  return useQuery({
    queryKey: [...tripKeys.detail(id), "briefing"] as const,
    queryFn: () => fetchBriefing(id),
    enabled: !!id,
    // Weather for a destination doesn't change per focus — don't burn the metered
    // WeatherAPI free-tier quota on every mount/refocus.
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
