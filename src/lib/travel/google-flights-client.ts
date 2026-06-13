/**
 * Google Flights client — fetches cash prices for CPP comparison.
 *
 * Provider chain: direct GetShoppingResults client first (keyless, see
 * google-flights-direct/), falling back to SerpAPI when the direct client
 * throws or returns no rows AND a SerpAPI key is available.
 */

import type { UnifiedFlightResult, SearchConfig } from "@/types/travel"
import { buildCashBookingUrl } from "./constants"
import { searchGoogleFlightsDirectUnified } from "./google-flights-direct-adapter"

interface SerpApiLeg {
  airline?: string
  flight_number?: string
  duration?: number
  airplane?: string
  departure_airport?: { id?: string; time?: string }
  arrival_airport?: { id?: string; time?: string }
}

interface SerpApiItinerary {
  price?: number
  total_duration?: number
  flights?: SerpApiLeg[]
  layovers?: Array<{ id?: string; name?: string }>
  booking_token?: string
  type?: string
}

interface SerpApiResponse {
  best_flights?: SerpApiItinerary[]
  other_flights?: SerpApiItinerary[]
}

/**
 * Primary entry point: direct Google client first, SerpAPI fallback.
 * `apiKey` is the SerpAPI key — pass undefined to disable the fallback
 * (e.g. return legs, which SerpAPI never covered).
 */
export async function searchGoogleFlights(
  apiKey: string | undefined,
  config: SearchConfig,
): Promise<UnifiedFlightResult[]> {
  try {
    const direct = await searchGoogleFlightsDirectUnified(config)
    if (direct.length > 0) return direct
    console.warn(`[travel] Google direct returned 0 flights (${config.origin}→${config.destination} ${config.departureDate}); trying SerpAPI fallback`)
  } catch (error) {
    console.error("[travel] Google direct client failed, trying SerpAPI fallback:", (error as Error).message)
  }
  if (!apiKey) return []
  return searchGoogleFlightsSerp(apiKey, config)
}

/** Legacy SerpAPI path — kept verbatim as the fallback provider. */
export async function searchGoogleFlightsSerp(
  apiKey: string,
  config: SearchConfig,
): Promise<UnifiedFlightResult[]> {
  // SerpAPI travel_class: 1=Economy, 2=Premium Economy, 3=Business, 4=First
  const cabinMap: Record<string, number> = { ECON: 1, PREM_ECON: 2, BIZ: 3, FIRST: 4, PREM: 3 }
  const cabinNames: Record<number, string> = { 1: "economy", 2: "premium_economy", 3: "business", 4: "first" }
  const classesToSearch = config.searchClass === "both" ? [1, 3] : [cabinMap[config.searchClass] || 1]
  const allFlights: UnifiedFlightResult[] = []

  for (const travelClass of classesToSearch) {
    const isRoundTrip = config.tripType === "round_trip" && config.returnDate
    const params = new URLSearchParams({
      engine: "google_flights",
      departure_id: config.origin,
      arrival_id: config.destination,
      outbound_date: config.departureDate,
      type: isRoundTrip ? "1" : "2", // 1 = round-trip, 2 = one-way
      travel_class: String(travelClass),
      currency: "USD",
      hl: "en",
      api_key: apiKey,
    })
    if (isRoundTrip) {
      params.set("return_date", config.returnDate!)
    }

    const resp = await fetch(`https://serpapi.com/search?${params}`)
    if (!resp.ok) continue

    const data = (await resp.json()) as SerpApiResponse

    for (const category of ["best_flights", "other_flights"] as const) {
      for (const itinerary of data[category] || []) {
        const legs = itinerary.flights || []
        if (legs.length === 0) continue

        const firstLeg = legs[0]!
        const lastLeg = legs[legs.length - 1]!
        const airlines = [...new Set(legs.map(l => l.airline).filter(Boolean))] as string[]
        const flightNums = legs.map(l => l.flight_number).filter(Boolean) as string[]
        const layovers = itinerary.layovers || []
        const airports = [
          firstLeg.departure_airport?.id || config.origin,
          ...layovers.map(l => l.id || l.name).filter(Boolean),
          lastLeg.arrival_airport?.id || config.destination,
        ] as string[]

        const depTimeStr = firstLeg.departure_airport?.time || ""
        const extractedDate = depTimeStr && /^\d{4}-\d{2}-\d{2}/.test(depTimeStr)
          ? depTimeStr.slice(0, 10)
          : config.departureDate

        allFlights.push({
          id: `google-${firstLeg.departure_airport?.id || config.origin}-${lastLeg.arrival_airport?.id || config.destination}-${extractedDate}-${travelClass}-${allFlights.length}`,
          source: "google",
          type: "cash",
          origin: firstLeg.departure_airport?.id || config.origin,
          destination: lastLeg.arrival_airport?.id || config.destination,
          airline: airlines.join(" / ") || "Unknown",
          operatingAirlines: airlines.length > 0 ? airlines : ["Unknown"],
          flightNumbers: flightNums,
          stops: layovers.length,
          durationMinutes: itinerary.total_duration || legs.reduce((s, l) => s + (l.duration || 0), 0),
          departureTime: firstLeg.departure_airport?.time || "",
          arrivalTime: lastLeg.arrival_airport?.time || "",
          airports,
          cabinClass: cabinNames[travelClass] || "economy",
          equipment: legs.map(l => l.airplane || "").filter(Boolean),
          points: null,
          pointsProgram: null,
          cashPrice: itinerary.price || null,
          taxes: 0,
          currency: "USD",
          cppValue: null,
          roameScore: null,
          availableSeats: null,
          bookingUrl: buildCashBookingUrl(legs[0]?.airline || "", firstLeg.departure_airport?.id || config.origin, lastLeg.arrival_airport?.id || config.destination, extractedDate),
          fareClass: itinerary.type || "",
          travelDate: extractedDate,
        })
      }
    }
  }

  return allFlights
}
