/**
 * Google Flights client via SerpAPI — fetches cash prices for CPP comparison.
 */

import type { UnifiedFlightResult, SearchConfig } from "@/types/travel"
import { buildCashBookingUrl } from "./constants"

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

export async function searchGoogleFlights(
  apiKey: string,
  config: SearchConfig,
): Promise<UnifiedFlightResult[]> {
  const cabinMap: Record<string, number> = { ECON: 1, PREM: 2, both: 1 }
  const cabinNames: Record<number, string> = { 1: "economy", 2: "business" }
  const classesToSearch = config.searchClass === "both" ? [1, 2] : [cabinMap[config.searchClass] || 1]
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
