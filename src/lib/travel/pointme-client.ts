/**
 * point.me API client — searches award availability via point.me's
 * two-step SSE search flow: initiateSearch → subscribeToSearch.
 *
 * Auth: Auth0 JWT (Bearer token) + x-cobrand: default header.
 * Token stored encrypted in financeCredential (service: "pointme").
 */

import type { UnifiedFlightResult } from "@/types/travel"
import { buildProgramBookingUrl } from "./constants"

const API_BASE = "https://api.point.me/api"

// ─── point.me API Types ─────────────────────────────────────────

interface PointMeSearchRequest {
  arrivals: string[]
  cabins: string[]
  departures: string[]
  departure_date: { flexibility: string; when: string }
  return_date: { flexibility: string; when: string } | null
  passengers: string
  airlines: string[]
  currencies: string[]
  max_stops: string
}

interface PointMeSearchInitResponse {
  user_search_request_id: string
  search_key: string
  fsr_request_id: number
}

interface PointMeRoute {
  ulid: string
  directionality: string
  num_stops: number
  times: { flight: string; layover: string }
  fares: PointMeFare[]
  pricings: PointMePricing[]
  connections: PointMeConnection[]
  tickets: number
  premium_cabin_percentage: number
}

interface PointMeFare {
  miles: number
  program: string
  program_key: string
  score: number
  payment: { currency: string; taxes: number; fees: number }
  transfer: PointMeTransfer[]
  is_roundtrip_only_miles: boolean
  deal_indicator?: { type: string; points_value: number; reference_price: number }
  calculation_method: string
}

interface PointMeTransfer {
  program: string
  program_key: string
  miles: number
  is_discount_applied: boolean
  actual_miles: number
  increment: number
  deal_indicator?: { type: string; points_value: number; reference_price: number }
}

interface PointMePricing {
  currency: string
  base_price: number
  taxes: number
  fees: number
  price: number
  portal_price: number
}

interface PointMeConnection {
  departure: { when: string; airport: string; airport_info: { name: string; city: string; iata: string } }
  arrival: { when: string; airport: string; airport_info: { name: string; city: string; iata: string } }
  airline: string
  flight: string[]
  cabin: string
  times: { flight: string; layover: string }
  aircraft: { model: string; manufacturer: string }
}

interface PointMeSearchData {
  request_id: number
  routes: PointMeRoute[]
  metrics: unknown
  status: string
  user_ref: string
}

// ─── Program Key Mapping ────────────────────────────────────────

const POINTME_TO_PW_PROGRAM: Record<string, string> = {
  // Airline programs
  FLYINGBLUE: "FLYING_BLUE",
  DELTA_SKYMILES: "DELTA",
  TURKISH_MILES_AND_SMILES: "TURKISH",
  AMERICAN_AADVANTAGE: "AMERICAN",
  UNITED_MILEAGEPLUS: "UNITED",
  ANA_MILEAGE_CLUB: "ANA",
  BRITISH_AIRWAYS_CLUB: "BRITISH_AIRWAYS",
  QATAR_PRIVILEGE_CLUB: "QATAR",
  EMIRATES_SKYWARDS: "EMIRATES",
  SINGAPORE_KRISFLYER: "SINGAPORE",
  VIRGIN_ATLANTIC_FLYING_CLUB: "VIRGIN_ATLANTIC",
  CATHAY_ASIA_MILES: "CATHAY",
  ETIHAD_GUEST: "ETIHAD",
  AEROPLAN: "AEROPLAN",
  QANTAS_FREQUENT_FLYER: "QANTAS",
  ALASKA_MILEAGE_PLAN: "ALASKA",
  AVIANCA_LIFEMILES: "AVIANCA",
  JAL_MILEAGE_BANK: "JAL",
  HAWAIIAN_MILES: "HAWAIIAN",
  JETBLUE_TRUEBLUE: "JETBLUE",
  TAP_MILESGO: "TAP",
  IBERIA_PLUS: "IBERIA",
  LATAM_PASS: "LATAM",
  ICELANDAIR_SAGA: "ICELANDAIR",
  AER_LINGUS_AERCLUB: "AER_LINGUS",
  VIRGIN_AUSTRALIA_VELOCITY: "VIRGIN_AUSTRALIA",
  // Bank/card transfer programs → map to the underlying airline program
  // These are transfer partners, not airline programs — the booking happens
  // on the airline side, so we link to the airline's booking page
  CITI_THANKYOU: "CITI_THANKYOU",
  AMEX_MEMBERSHIP_REWARDS: "AMEX_MR",
  CHASE_ULTIMATE_REWARDS: "CHASE_UR",
  CAPITAL_ONE: "CAPITAL_ONE",
  BILT_REWARDS: "BILT",
  ATMOS_REWARDS: "ATMOS",
}

const DEAL_TYPE_TO_TAGS: Record<string, string> = {
  GREAT_DEAL: "great-deal",
  GOOD_DEAL: "good-deal",
  NORMAL_DEAL: "normal-deal",
  BAD_DEAL: "bad-deal",
}

// ─── Cabin Mapping ──────────────────────────────────────────────

function mapCabinClass(searchClass: string): string {
  if (searchClass === "ECON") return "ECONOMY"
  return "BUSINESS"
}

function normalizeCabin(cabin: string): string {
  const lower = cabin.toLowerCase()
  if (lower === "first" || lower.includes("first")) return "first"
  if (lower === "business" || lower.includes("business")) return "business"
  if (lower.includes("premium")) return "premium_economy"
  return "economy"
}

// ─── Duration Parsing ───────────────────────────────────────────

function parseTimeString(time: string): number {
  const parts = time.split(":")
  const hours = parseInt(parts[0] || "0", 10)
  const mins = parseInt(parts[1] || "0", 10)
  return hours * 60 + mins
}

// ─── API Calls ──────────────────────────────────────────────────

async function initiateSearch(
  token: string,
  origin: string,
  destination: string,
  date: string,
  cabin: string,
  passengers: number = 1,
): Promise<PointMeSearchInitResponse> {
  const body: PointMeSearchRequest = {
    arrivals: [destination],
    cabins: [cabin],
    departures: [origin],
    departure_date: { flexibility: "0", when: date },
    return_date: null,
    passengers: String(passengers),
    airlines: ["ALL"],
    currencies: ["USD"],
    max_stops: "5",
  }

  const resp = await fetch(`${API_BASE}/initiateSearch`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "x-cobrand": "default",
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => "")
    throw new Error(`point.me initiateSearch HTTP ${resp.status}: ${text.slice(0, 200)}`)
  }

  return resp.json() as Promise<PointMeSearchInitResponse>
}

async function subscribeToSearch(
  token: string,
  searchKey: string,
  fsrRequestId: number,
  userSearchRequestId: string,
): Promise<PointMeRoute[]> {
  const params = new URLSearchParams({
    directionality: "outbound",
    searchKey,
    fsrRequestId: String(fsrRequestId),
    userSearchRequestId,
  })

  const resp = await fetch(`${API_BASE}/subscribeToSearch?${params}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "text/event-stream",
      "x-cobrand": "default",
    },
  })

  if (!resp.ok) {
    throw new Error(`point.me subscribeToSearch HTTP ${resp.status}`)
  }

  // Read SSE stream as text
  const reader = resp.body?.getReader()
  if (!reader) throw new Error("point.me SSE: no response body")

  const decoder = new TextDecoder()
  let fullText = ""
  const startTime = Date.now()
  const TIMEOUT_MS = 90_000 // 90 seconds max

  while (Date.now() - startTime < TIMEOUT_MS) {
    const { done, value } = await reader.read()
    if (done) break
    fullText += decoder.decode(value, { stream: true })
  }

  reader.cancel().catch(() => {})

  // Parse SSE events
  const routes: PointMeRoute[] = []
  const eventBlocks = fullText.split("\n\n").filter(b => b.trim())

  for (const block of eventBlocks) {
    const lines = block.split("\n")
    let eventType = ""
    let dataLine = ""

    for (const line of lines) {
      if (line.startsWith("event:")) eventType = line.slice(6).trim()
      else if (line.startsWith("data:")) dataLine = line.slice(5)
    }

    if (eventType === "SEARCH" && dataLine) {
      try {
        const parsed = JSON.parse(dataLine) as PointMeSearchData
        routes.push(...parsed.routes)
      } catch {
        console.warn("[pointme] Failed to parse SEARCH event data")
      }
    }
  }

  return routes
}

// ─── Convert to UnifiedFlightResult ─────────────────────────────

function routesToUnified(routes: PointMeRoute[], date: string, searchOrigin: string): UnifiedFlightResult[] {
  const results: UnifiedFlightResult[] = []
  const seenIds = new Set<string>()

  function uniqueId(base: string): string {
    let id = base
    let i = 2
    while (seenIds.has(id)) { id = `${base}-${i++}` }
    seenIds.add(id)
    return id
  }

  for (const route of routes) {
    const origin = route.connections[0]?.departure.airport || ""
    const destination = route.connections[route.connections.length - 1]?.arrival.airport || ""
    const airlines = [...new Set(route.connections.map(c => c.airline))]
    const flightNumbers = route.connections.flatMap(c => c.flight)
    const rawAirports = [
      route.connections[0]?.departure.airport,
      ...route.connections.map(c => c.arrival.airport),
    ].filter(Boolean) as string[]
    const airports = rawAirports.filter((a, i) => i === 0 || a !== rawAirports[i - 1])
    const durationMinutes = parseTimeString(route.times.flight) + parseTimeString(route.times.layover)
    const departureTime = route.connections[0]?.departure.when || ""
    const arrivalTime = route.connections[route.connections.length - 1]?.arrival.when || ""
    // Extract actual departure date from the route (not the search date)
    const actualDate = departureTime && /^\d{4}-\d{2}-\d{2}/.test(departureTime)
      ? departureTime.slice(0, 10)
      : date
    const cabinClass = normalizeCabin(
      route.connections.find(c => c.cabin.toLowerCase() !== "economy")?.cabin
        || route.connections[0]?.cabin
        || "economy"
    )
    const equipment = route.connections
      .map(c => c.aircraft.model)
      .filter(m => m.length > 0)
    const cashPrice = route.pricings[0]?.price || null

    // One UnifiedFlightResult per fare (per airline program)
    for (const fare of route.fares) {
      if (fare.is_roundtrip_only_miles) continue

      const pwProgram = POINTME_TO_PW_PROGRAM[fare.program_key] || fare.program_key
      const cppValue = fare.deal_indicator
        ? Math.round(fare.deal_indicator.points_value * 10000) / 100
        : null
      const dealTag = fare.deal_indicator
        ? DEAL_TYPE_TO_TAGS[fare.deal_indicator.type]
        : undefined
      const tags = ["point.me", ...(dealTag ? [dealTag] : [])]

      // Find cheapest transfer partner option
      const cheapestTransfer = fare.transfer.length > 0
        ? fare.transfer.reduce((min, t) => t.miles < min.miles ? t : min, fare.transfer[0]!)
        : undefined

      results.push({
        id: uniqueId(`pm-${searchOrigin}-${route.ulid}-${fare.program_key}`),
        source: "pointme",
        type: "award",
        tags,
        origin,
        destination,
        airline: airlines[0] || "",
        operatingAirlines: airlines,
        flightNumbers,
        stops: route.num_stops,
        durationMinutes,
        departureTime,
        arrivalTime,
        airports,
        cabinClass,
        equipment,
        points: fare.miles,
        pointsProgram: fare.program,
        cashPrice,
        taxes: fare.payment.taxes,
        currency: fare.payment.currency,
        cppValue,
        roameScore: null,
        availableSeats: null,
        bookingUrl: buildProgramBookingUrl(pwProgram, origin, destination, actualDate, cabinClass),
        fareClass: cabinClass,
        travelDate: actualDate,
      })

      // Also emit the cheapest credit card transfer path as a separate result
      // so the value engine can compare transfer costs
      if (cheapestTransfer && cheapestTransfer.miles !== fare.miles) {
        const transferCpp = cheapestTransfer.deal_indicator
          ? Math.round(cheapestTransfer.deal_indicator.points_value * 10000) / 100
          : cppValue

        results.push({
          id: uniqueId(`pm-${searchOrigin}-${route.ulid}-${cheapestTransfer.program_key}-via-${fare.program_key}`),
          source: "pointme",
          type: "award",
          tags: [...tags, `via-${cheapestTransfer.program}`],
          origin,
          destination,
          airline: airlines[0] || "",
          operatingAirlines: airlines,
          flightNumbers,
          stops: route.num_stops,
          durationMinutes,
          departureTime,
          arrivalTime,
          airports,
          cabinClass,
          equipment,
          points: cheapestTransfer.miles,
          pointsProgram: cheapestTransfer.program,
          cashPrice,
          taxes: fare.payment.taxes,
          currency: fare.payment.currency,
          cppValue: transferCpp,
          roameScore: null,
          availableSeats: null,
          bookingUrl: buildProgramBookingUrl(pwProgram, origin, destination, actualDate, cabinClass),
          fareClass: cabinClass,
          travelDate: actualDate,
        })
      }
    }
  }

  return results
}

// ─── Public API ─────────────────────────────────────────────────

export async function searchPointMe(
  token: string,
  origin: string,
  destination: string,
  date: string,
  searchClass: string,
): Promise<UnifiedFlightResult[]> {
  const cabin = mapCabinClass(searchClass)

  const { search_key, fsr_request_id, user_search_request_id } =
    await initiateSearch(token, origin, destination, date, cabin)

  const routes = await subscribeToSearch(
    token, search_key, fsr_request_id, user_search_request_id,
  )

  console.log(`[pointme] ${routes.length} routes received for ${origin}→${destination} on ${date}`)

  return routesToUnified(routes, date, origin)
}
