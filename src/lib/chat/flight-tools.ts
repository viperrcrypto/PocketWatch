/**
 * PocketLLM flight tool executors — read from DB-persisted flight search results.
 */

import { db } from "@/lib/db"
import { cleanText, cleanTextOrNull, cleanUrl, cleanList } from "./sanitize"
import type { DashboardResults } from "@/types/travel"

type ToolInput = Record<string, unknown>

const NO_FLIGHTS = JSON.stringify({ error: "No recent flight search found. The user needs to search for flights first." })

async function loadFlightResults(userId: string): Promise<DashboardResults | null> {
  const row = await db.flightSearchResult.findUnique({ where: { userId } })
  return row ? (row.results as unknown as DashboardResults) : null
}

export async function getFlightSearchSummary(userId: string): Promise<string> {
  const data = await loadFlightResults(userId)
  if (!data) return NO_FLIGHTS

  const flights = data.flights
  const cabinCounts: Record<string, number> = {}
  const airlineSet = new Set<string>()
  let awardCount = 0
  let cashCount = 0
  let minPoints = Infinity
  let maxPoints = -Infinity
  let minCash = Infinity
  let maxCash = -Infinity

  for (const f of flights) {
    const cabin = cleanText(f.cabinClass)
    cabinCounts[cabin] = (cabinCounts[cabin] ?? 0) + 1
    airlineSet.add(cleanText(f.airline))
    if (f.type === "award") {
      awardCount++
      if (f.points != null) {
        if (f.points < minPoints) minPoints = f.points
        if (f.points > maxPoints) maxPoints = f.points
      }
    } else {
      cashCount++
      if (f.cashPrice != null) {
        if (f.cashPrice < minCash) minCash = f.cashPrice
        if (f.cashPrice > maxCash) maxCash = f.cashPrice
      }
    }
  }

  return JSON.stringify({
    route: `${cleanText(data.meta.origin)} → ${cleanText(data.meta.destination)}`,
    departureDate: cleanText(data.meta.departureDate),
    searchedAt: cleanText(data.meta.searchedAt),
    sources: cleanList(data.meta.sources),
    totalFlights: flights.length,
    awardFlights: awardCount,
    cashFlights: cashCount,
    cabinBreakdown: cabinCounts,
    airlines: [...airlineSet].sort(),
    pointsRange: awardCount > 0 && isFinite(minPoints) ? { min: minPoints, max: maxPoints } : null,
    cashRange: cashCount > 0 && isFinite(minCash) ? { min: minCash, max: maxCash } : null,
    recommendations: data.recommendations.map((r) => ({
      title: cleanText(r.title),
      subtitle: cleanText(r.subtitle),
      totalCost: cleanText(r.totalCost),
      cppValue: cleanTextOrNull(r.cppValue),
    })),
    insights: data.insights.map((i) => ({
      type: cleanText(i.type),
      priority: cleanText(i.priority),
      title: cleanText(i.title),
      detail: cleanText(i.detail),
    })),
    routeSweetSpots: data.routeSweetSpots.map((s) => ({
      program: cleanText(s.program),
      cabin: cleanText(s.cabin),
      maxPoints: s.maxPoints,
      description: cleanText(s.description),
    })),
    balances: data.balances.map((b) => ({
      program: cleanText(b.program),
      balance: b.balance,
      display: cleanText(b.displayBalance),
    })),
    warnings: cleanList(data.warnings),
  })
}

export async function getFlightResults(userId: string, input: ToolInput): Promise<string> {
  const data = await loadFlightResults(userId)
  if (!data) return NO_FLIGHTS

  let flights = [...data.flights]

  // Apply filters
  if (input.cabin) {
    const cabin = (input.cabin as string).toLowerCase()
    flights = flights.filter((f) => f.cabinClass.toLowerCase() === cabin)
  }
  if (input.airline) {
    const airline = (input.airline as string).toLowerCase()
    flights = flights.filter((f) =>
      f.airline.toLowerCase().includes(airline) ||
      f.operatingAirlines.some((a) => a.toLowerCase().includes(airline))
    )
  }
  if (input.type) {
    flights = flights.filter((f) => f.type === input.type)
  }
  if (input.stops != null) {
    const maxStops = input.stops as number
    flights = flights.filter((f) => f.stops <= maxStops)
  }
  if (input.max_points != null) {
    const max = input.max_points as number
    flights = flights.filter((f) => f.points != null && f.points <= max)
  }
  if (input.min_value_score != null) {
    const min = input.min_value_score as number
    flights = flights.filter((f) => f.valueScore >= min)
  }

  // Sort
  const sortBy = (input.sort_by as string) || "value_score"
  const sortFns: Record<string, (a: typeof flights[0], b: typeof flights[0]) => number> = {
    value_score: (a, b) => b.valueScore - a.valueScore,
    points: (a, b) => (a.points ?? Infinity) - (b.points ?? Infinity),
    cash_price: (a, b) => (a.cashPrice ?? Infinity) - (b.cashPrice ?? Infinity),
    duration: (a, b) => a.durationMinutes - b.durationMinutes,
    cpp: (a, b) => (b.realCpp ?? 0) - (a.realCpp ?? 0),
  }
  if (sortFns[sortBy]) flights.sort(sortFns[sortBy])

  const total = flights.length
  const limit = Math.min((input.limit as number) || 10, 30)
  let shown = flights.slice(0, limit)

  // Guarantee nonstop visibility. value_score rewards cheap/award value, so a
  // (pricier) NONSTOP can rank below the cut even though users specifically want
  // direct options. When sorting by value and no explicit stops filter is set,
  // if no nonstop made the cut, surface the best 1-2 nonstops alongside the rest.
  if (sortBy === "value_score" && input.stops == null && !shown.some((f) => f.stops === 0)) {
    const bestNonstops = flights.filter((f) => f.stops === 0).slice(0, 2)
    if (bestNonstops.length > 0) {
      shown = [...bestNonstops, ...shown].slice(0, Math.min(limit + bestNonstops.length, 30))
    }
  }
  flights = shown

  // `type` discriminator lets the chat renderer detect this payload and swap raw
  // JSON for rich flight cards (see components/chat/result-payload.ts).
  return JSON.stringify({
    type: "flights",
    total,
    showing: flights.length,
    flights: flights.map((f) => ({
      airline: cleanText(f.airline),
      flightNumbers: cleanList(f.flightNumbers),
      route: `${cleanText(f.origin)} → ${cleanText(f.destination)}`,
      airports: cleanList(f.airports),
      stops: f.stops,
      duration: `${Math.floor(f.durationMinutes / 60)}h${f.durationMinutes % 60}m`,
      cabin: cleanText(f.cabinClass),
      type: f.type,
      points: f.points,
      program: cleanTextOrNull(f.pointsProgram),
      taxes: f.taxes,
      cashPrice: f.cashPrice,
      valueScore: f.valueScore,
      cppValue: f.realCpp,
      cppRating: f.cppRating,
      canAfford: f.canAfford,
      affordDetails: cleanText(f.affordDetails),
      sweetSpot: f.sweetSpotMatch ? cleanText(f.sweetSpotMatch.label) : null,
      departureTime: cleanText(f.departureTime),
      arrivalTime: cleanText(f.arrivalTime),
      bookingUrl: cleanUrl(f.bookingUrl),
    })),
  })
}

/**
 * Generate a price match / negotiation email based on flight search results.
 * Finds the cheapest option and drafts a persuasive email to competing airlines.
 */
export async function generatePriceMatchEmail(userId: string, input: ToolInput): Promise<string> {
  const data = await loadFlightResults(userId)
  if (!data) return NO_FLIGHTS

  const targetAirline = (input.airline as string)?.toLowerCase() || ""
  const flights = data.flights

  // Find cheapest cash flight as the price-match reference
  const cashFlights = flights
    .filter(f => f.type === "cash" && f.cashPrice && f.cashPrice > 0)
    .sort((a, b) => (a.cashPrice || Infinity) - (b.cashPrice || Infinity))

  if (cashFlights.length === 0) {
    return JSON.stringify({ error: "No cash flights found to use as price reference." })
  }

  const cheapest = cashFlights[0]!
  const origin = cleanText(data.meta.origin)
  const destination = cleanText(data.meta.destination)
  const route = `${origin} → ${destination}`
  const date = cleanText(data.meta.departureDate)

  // Find the target airline's flights (or the most expensive one)
  const targetFlights = targetAirline
    ? flights.filter(f => f.type === "cash" && f.airline.toLowerCase().includes(targetAirline))
    : cashFlights.filter(f => f.cashPrice && f.cashPrice > cheapest.cashPrice!)

  const target = targetFlights[0]
  const priceDiff = target?.cashPrice ? target.cashPrice - (cheapest.cashPrice || 0) : 0

  const cheapestAirline = cleanText(cheapest.airline)
  const cheapestCabin = cleanText(cheapest.cabinClass)
  const targetName = target ? cleanText(target.airline) : null

  return JSON.stringify({
    route,
    date,
    cheapestFlight: {
      airline: cheapestAirline,
      price: cheapest.cashPrice,
      cabin: cheapestCabin,
      stops: cheapest.stops,
    },
    targetFlight: target ? {
      airline: targetName,
      price: target.cashPrice,
      cabin: cleanText(target.cabinClass),
      priceDifference: priceDiff,
    } : null,
    emailTemplate: [
      `Subject: Price Match Request — ${route} on ${date}`,
      "",
      `Dear ${targetName || "[Airline]"} Customer Service,`,
      "",
      `I am writing to request a price match for my upcoming flight from ${origin} to ${destination} on ${date}.`,
      "",
      `I found a comparable ${cheapestCabin} class fare on ${cheapestAirline} for $${cheapest.cashPrice}, which is $${priceDiff} less than your current fare of $${target?.cashPrice || "[your price]"}.`,
      "",
      `As a loyal customer, I would prefer to fly with ${targetName || "[your airline]"} and would appreciate if you could match or come close to this competitor pricing.`,
      "",
      `Competitor details:`,
      `- Airline: ${cheapestAirline}`,
      `- Route: ${route}`,
      `- Date: ${date}`,
      `- Price: $${cheapest.cashPrice}`,
      `- Cabin: ${cheapestCabin}`,
      `- Stops: ${cheapest.stops === 0 ? "Nonstop" : `${cheapest.stops} stop(s)`}`,
      "",
      `I would be happy to provide a screenshot of the competitor fare if needed.`,
      "",
      `Thank you for your time and consideration.`,
      "",
      `Best regards`,
    ].join("\n"),
    tip: "Most airlines have a price match window of 24-48 hours after booking. Some airlines (Southwest, JetBlue) have more flexible price match policies than legacy carriers.",
  })
}

/**
 * Analyze fare flexibility and estimated fees for a specific flight.
 */
export async function analyzeFareDetails(userId: string, input: ToolInput): Promise<string> {
  const data = await loadFlightResults(userId)
  if (!data) return NO_FLIGHTS

  const { analyzeFareFlexibility, extractAirlineCode } = await import("@/lib/travel/fare-flexibility")
  const { estimateAirlineFees, extractFirstIATA } = await import("@/lib/travel/airline-fees")

  const airline = (input.airline as string)?.toLowerCase() || ""
  const cabin = (input.cabin as string)?.toLowerCase() || ""

  let flights = data.flights
  if (airline) flights = flights.filter(f => f.airline.toLowerCase().includes(airline))
  if (cabin) flights = flights.filter(f => f.cabinClass.toLowerCase() === cabin)

  const analyzed = flights.slice(0, 10).map(f => {
    const flex = analyzeFareFlexibility(f.fareClass, extractAirlineCode(f.airline))
    const iata = extractFirstIATA(f.operatingAirlines, f.airline)
    const fees = f.type === "cash" ? estimateAirlineFees(iata) : null

    return {
      airline: cleanText(f.airline),
      fareClass: cleanText(f.fareClass),
      cabin: cleanText(f.cabinClass),
      type: f.type,
      price: f.type === "cash" ? `$${f.cashPrice}` : `${f.points?.toLocaleString()} pts`,
      flexibility: flex ? {
        level: flex.level,
        label: flex.label,
        refundable: flex.refundable,
        changeable: flex.changeable,
        changeFee: flex.changeFeeTier,
      } : "Unknown fare class",
      estimatedFees: fees && fees.total > 0 ? {
        checkedBag: fees.checkedBag ? `$${fees.checkedBag}` : "Free",
        carryOn: fees.carryOn ? `$${fees.carryOn}` : "Free",
        seatSelection: fees.seatSelection ? `$${fees.seatSelection}` : "Included",
        totalExtra: `$${fees.total}`,
      } : "No additional fees expected",
    }
  })

  return JSON.stringify({ count: analyzed.length, flights: analyzed })
}
