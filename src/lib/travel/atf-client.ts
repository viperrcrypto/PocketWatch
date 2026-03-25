/**
 * Award Travel Finder (ATF) REST API client.
 * Searches 19+ airlines for award availability, returns UnifiedFlightResult[].
 *
 * Ported from /Projects/flight-search-agent/atf-scraper.ts — no CLI,
 * no filesystem access, API key passed as parameter.
 */

import type { UnifiedFlightResult } from "@/types/travel"

const ATF_BASE_URL = "https://awardtravelfinder.com/api/v1"

// ─── Supported Airlines ─────────────────────────────────────────

export const ATF_AIRLINES = [
  "british_airways",
  "qatar_airways",
  "cathay_pacific",
  "virgin_atlantic",
  "iberia",
  "emirates",
  "united",
  "american",
  "alaska",
  "jetblue",
  "etihad",
  "jal",
  "singapore",
  "qantas",
  "hawaiian",
  "latam",
  "tap",
  "icelandair",
  "aer_lingus",
  "el_al",
  "condor",
  "cape_air",
] as const

export type ATFAirline = (typeof ATF_AIRLINES)[number]

// ─── Airline Metadata ───────────────────────────────────────────

export const ATF_AIRLINE_META: Record<ATFAirline, { name: string; programKey: string; programName: string }> = {
  british_airways:  { name: "British Airways",  programKey: "BRITISH_AIRWAYS",  programName: "BA Avios" },
  qatar_airways:    { name: "Qatar Airways",     programKey: "QATAR",            programName: "Qatar Privilege Club" },
  cathay_pacific:   { name: "Cathay Pacific",    programKey: "CATHAY",           programName: "Asia Miles" },
  virgin_atlantic:  { name: "Virgin Atlantic",   programKey: "VIRGIN_ATLANTIC",  programName: "Virgin Points" },
  iberia:           { name: "Iberia",            programKey: "IBERIA",           programName: "Iberia Plus" },
  emirates:         { name: "Emirates",          programKey: "EMIRATES",         programName: "Emirates Skywards" },
  united:           { name: "United Airlines",   programKey: "UNITED",           programName: "MileagePlus" },
  american:         { name: "American Airlines", programKey: "AMERICAN",         programName: "AAdvantage" },
  alaska:           { name: "Alaska Airlines",   programKey: "ALASKA",           programName: "Mileage Plan" },
  jetblue:          { name: "JetBlue",           programKey: "JETBLUE",          programName: "TrueBlue" },
  etihad:           { name: "Etihad Airways",    programKey: "ETIHAD",           programName: "Etihad Guest" },
  jal:              { name: "Japan Airlines",    programKey: "JAL",              programName: "JAL Mileage Bank" },
  singapore:        { name: "Singapore Airlines", programKey: "SINGAPORE",       programName: "KrisFlyer" },
  qantas:           { name: "Qantas",            programKey: "QANTAS",           programName: "Qantas Frequent Flyer" },
  hawaiian:         { name: "Hawaiian Airlines",  programKey: "HAWAIIAN",        programName: "HawaiianMiles" },
  latam:            { name: "LATAM Airlines",     programKey: "LATAM",           programName: "LATAM Pass" },
  tap:              { name: "TAP Air Portugal",   programKey: "TAP",             programName: "TAP Miles&Go" },
  icelandair:       { name: "Icelandair",         programKey: "ICELANDAIR",      programName: "Icelandair Saga Club" },
  aer_lingus:       { name: "Aer Lingus",         programKey: "AER_LINGUS",      programName: "AerClub" },
  el_al:            { name: "El Al",              programKey: "EL_AL",           programName: "Matmid Club" },
  condor:           { name: "Condor",             programKey: "CONDOR",          programName: "Miles & More" },
  cape_air:         { name: "Cape Air",            programKey: "CAPE_AIR",       programName: "Cape Air" },
}

// ─── Types ──────────────────────────────────────────────────────

interface ATFCabin {
  available: boolean
  seats: number
  points?: number
  taxes?: number
  taxes_currency?: string
}

interface ATFAvailability {
  date: string
  cabins: {
    economy?: ATFCabin
    premium_economy?: ATFCabin
    business?: ATFCabin
    first?: ATFCabin
  }
}

interface ATFData {
  route: string
  search_date: string
  response_type: string
  availability: ATFAvailability
}

interface ATFUsage {
  tier: string
  remaining_calls: number
  monthly_limit: number
}

interface ATFResponse {
  success: boolean
  data: ATFData
  usage: ATFUsage
}

export interface ATFResult {
  airline: ATFAirline
  origin: string
  destination: string
  date: string
  response: ATFResponse | null
  error?: string
}

// ─── API Client ─────────────────────────────────────────────────

async function fetchATFAirline(
  apiKey: string,
  airline: ATFAirline,
  origin: string,
  destination: string,
  date: string,
): Promise<ATFResult> {
  const url = `${ATF_BASE_URL}/${airline}/availability?departure_code=${origin}&arrival_code=${destination}&date=${date}`

  try {
    const resp = await fetch(url, {
      headers: { "X-API-Key": apiKey, "Accept": "application/json" },
    })

    if (!resp.ok) {
      const body = await resp.text().catch(() => "")
      return { airline, origin, destination, date, response: null, error: `HTTP ${resp.status}: ${body.slice(0, 200)}` }
    }

    const data = (await resp.json()) as ATFResponse
    return { airline, origin, destination, date, response: data }
  } catch (err) {
    return { airline, origin, destination, date, response: null, error: (err as Error).message }
  }
}

// ─── Booking URLs ───────────────────────────────────────────────

function buildATFBookingUrl(airline: ATFAirline, origin: string, destination: string, date: string, cabin: string): string {
  switch (airline) {
    case "british_airways":
      return `https://www.britishairways.com/travel/redeem/execclub/_gf/en_us?from=${origin}&to=${destination}&depDate=${date}&cabin=${cabin === "first" ? "F" : cabin === "business" ? "C" : "M"}&ad=1`
    case "qatar_airways":
      return `https://booking.qatarairways.com/nsp/views/showBooking.action?bookingClass=${cabin === "first" ? "F" : cabin === "business" ? "C" : "E"}&from=${origin}&to=${destination}&departing=${date}&adult=1&bookAward=true`
    case "cathay_pacific":
      return `https://www.cathaypacific.com/cx/en_HK/book-a-trip/redeem-flights/redeem-flight-awards.html?origin=${origin}&destination=${destination}&departDate=${date}`
    case "virgin_atlantic":
      return `https://www.virginatlantic.com/flight-search/select-flights?origin=${origin}&destination=${destination}&awardSearch=true&departureDate=${date}&adult=1`
    case "iberia":
      return `https://www.iberia.com/vuelos/ofertas/avios/?origin=${origin}&destination=${destination}&departureDate=${date}&passengers=1&type=OW`
    default:
      return `https://awardtravelfinder.com`
  }
}

// ─── Convert to Unified Format ──────────────────────────────────

export function atfToUnified(atfResults: ATFResult[]): UnifiedFlightResult[] {
  const unified: UnifiedFlightResult[] = []

  for (const result of atfResults) {
    if (result.error || !result.response?.success || !result.response.data) continue

    const { airline, origin, destination, date } = result
    const meta = ATF_AIRLINE_META[airline]
    const availability = result.response.data.availability
    const cabinEntries = Object.entries(availability.cabins) as [string, ATFCabin][]

    for (const [cabinKey, cabin] of cabinEntries) {
      if (!cabin.available || !cabin.points) continue

      let taxesUSD = cabin.taxes || 0
      if (cabin.taxes_currency === "GBP") {
        taxesUSD = Math.round((cabin.taxes || 0) * 1.27)
      }

      unified.push({
        id: `atf-${airline}-${cabinKey}-${origin}-${destination}-${date}`,
        source: "atf",
        type: "award",
        origin,
        destination,
        airline: meta.name,
        operatingAirlines: [meta.name],
        flightNumbers: [],
        stops: 0,
        durationMinutes: 0,
        departureTime: date,
        arrivalTime: date,
        airports: [origin, destination],
        cabinClass: cabinKey,
        equipment: [],
        points: cabin.points,
        pointsProgram: meta.programKey,
        cashPrice: null,
        taxes: taxesUSD,
        currency: "USD",
        cppValue: null,
        roameScore: null,
        availableSeats: cabin.seats || null,
        bookingUrl: buildATFBookingUrl(airline, origin, destination, date, cabinKey),
        fareClass: `atf:${meta.programKey}:${cabinKey}`,
        travelDate: date,
      })
    }
  }

  return unified
}

// ─── Main Search ────────────────────────────────────────────────

/**
 * Search all ATF airlines in parallel for a single route + date.
 * Each airline = 1 API call. Budget: 150/month.
 */
export async function searchATF(
  apiKey: string,
  origin: string,
  destination: string,
  date: string,
): Promise<UnifiedFlightResult[]> {
  const results = await Promise.all(
    ATF_AIRLINES.map((airline) => fetchATFAirline(apiKey, airline, origin, destination, date)),
  )
  return atfToUnified(results)
}
