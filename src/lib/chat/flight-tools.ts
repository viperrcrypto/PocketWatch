/**
 * PocketLLM flight tool executors — read from DB-persisted flight search results.
 */

import { db } from "@/lib/db"
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
    cabinCounts[f.cabinClass] = (cabinCounts[f.cabinClass] ?? 0) + 1
    airlineSet.add(f.airline)
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
    route: `${data.meta.origin} → ${data.meta.destination}`,
    departureDate: data.meta.departureDate,
    searchedAt: data.meta.searchedAt,
    sources: data.meta.sources,
    totalFlights: flights.length,
    awardFlights: awardCount,
    cashFlights: cashCount,
    cabinBreakdown: cabinCounts,
    airlines: [...airlineSet].sort(),
    pointsRange: awardCount > 0 && isFinite(minPoints) ? { min: minPoints, max: maxPoints } : null,
    cashRange: cashCount > 0 && isFinite(minCash) ? { min: minCash, max: maxCash } : null,
    recommendations: data.recommendations.map((r) => ({
      title: r.title,
      subtitle: r.subtitle,
      totalCost: r.totalCost,
      cppValue: r.cppValue,
    })),
    routeSweetSpots: data.routeSweetSpots,
    balances: data.balances.map((b) => ({
      program: b.program,
      balance: b.balance,
      display: b.displayBalance,
    })),
    warnings: data.warnings,
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
  flights = flights.slice(0, limit)

  return JSON.stringify({
    total,
    showing: flights.length,
    flights: flights.map((f) => ({
      airline: f.airline,
      flightNumbers: f.flightNumbers,
      route: `${f.origin} → ${f.destination}`,
      airports: f.airports,
      stops: f.stops,
      duration: `${Math.floor(f.durationMinutes / 60)}h${f.durationMinutes % 60}m`,
      cabin: f.cabinClass,
      type: f.type,
      points: f.points,
      program: f.pointsProgram,
      taxes: f.taxes,
      cashPrice: f.cashPrice,
      valueScore: f.valueScore,
      cppValue: f.realCpp,
      cppRating: f.cppRating,
      canAfford: f.canAfford,
      affordDetails: f.affordDetails,
      sweetSpot: f.sweetSpotMatch?.label ?? null,
      departureTime: f.departureTime,
      arrivalTime: f.arrivalTime,
      bookingUrl: f.bookingUrl,
    })),
  })
}
