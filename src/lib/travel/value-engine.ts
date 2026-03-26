/**
 * Value Engine — scores flights with CPP analysis, sweet spot detection,
 * and transfer path awareness.
 */

import type {
  UnifiedFlightResult,
  ValueScoredFlight,
  ValueInsight,
  SweetSpotMatch,
  FundingPath,
  CppRating,
} from "@/types/travel"
import { matchSweetSpots, getSweetSpotsForRoute } from "./sweet-spots"
import { findFundingPaths, canAfford } from "./transfer-partners"

// ─── CPP Thresholds by Cabin ─────────────────────────────────────

const CPP_THRESHOLDS: Record<string, { exceptional: number; great: number; good: number; fair: number }> = {
  economy:         { exceptional: 2.5, great: 1.8, good: 1.4, fair: 1.0 },
  premium_economy: { exceptional: 3.5, great: 2.5, good: 1.8, fair: 1.2 },
  business:        { exceptional: 5.0, great: 3.5, good: 2.5, fair: 1.5 },
  first:           { exceptional: 8.0, great: 5.0, good: 3.5, fair: 2.0 },
}

function rateCpp(cpp: number, cabin: string): CppRating {
  const thresholds = CPP_THRESHOLDS[cabin] || CPP_THRESHOLDS.economy!
  if (cpp >= thresholds.exceptional) return "exceptional"
  if (cpp >= thresholds.great) return "great"
  if (cpp >= thresholds.good) return "good"
  if (cpp >= thresholds.fair) return "fair"
  return "poor"
}

// ─── Cash Price Matching ─────────────────────────────────────────

interface CashPriceBucket {
  cabin: string
  stops: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  prices: number[]
}

function buildCashPriceLookup(flights: UnifiedFlightResult[]): Map<string, CashPriceBucket> {
  const buckets = new Map<string, CashPriceBucket>()
  const cashFlights = flights.filter(f => f.type === "cash" && f.cashPrice && f.cashPrice > 0)

  for (const f of cashFlights) {
    const stopBucket = f.stops === 0 ? 0 : 1
    const key = `${f.cabinClass}:${stopBucket}`

    if (!buckets.has(key)) {
      buckets.set(key, { cabin: f.cabinClass, stops: stopBucket, minPrice: Infinity, maxPrice: 0, avgPrice: 0, prices: [] })
    }

    const bucket = buckets.get(key)!
    bucket.prices.push(f.cashPrice!)
    bucket.minPrice = Math.min(bucket.minPrice, f.cashPrice!)
    bucket.maxPrice = Math.max(bucket.maxPrice, f.cashPrice!)
    bucket.avgPrice = bucket.prices.reduce((a, b) => a + b, 0) / bucket.prices.length
  }

  return buckets
}

function findCashComparable(
  award: UnifiedFlightResult,
  cashFlights: UnifiedFlightResult[],
  cashBuckets: Map<string, CashPriceBucket>,
): { price: number; source: "exact-match" | "same-cabin" | "estimated" } {
  // 1. Exact match: same airline(s), cabin, stops
  const exactMatches = cashFlights.filter(f =>
    f.type === "cash" &&
    f.cashPrice && f.cashPrice > 0 &&
    f.cabinClass === award.cabinClass &&
    f.stops === award.stops &&
    f.operatingAirlines.some(a => award.operatingAirlines.includes(a))
  )

  if (exactMatches.length > 0) {
    const sorted = exactMatches.map(f => f.cashPrice!).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]!
    return { price: median, source: "exact-match" }
  }

  // 2. Same cabin bucket
  const stopBucket = award.stops === 0 ? 0 : 1
  const bucket = cashBuckets.get(`${award.cabinClass}:${stopBucket}`)

  if (bucket && bucket.prices.length > 0) {
    return { price: Math.round(bucket.avgPrice), source: "same-cabin" }
  }

  // 3. Any cabin bucket as last resort
  const anyBucket = cashBuckets.get(`${award.cabinClass}:0`) ||
                    cashBuckets.get(`${award.cabinClass}:1`)

  if (anyBucket) {
    return { price: Math.round(anyBucket.avgPrice), source: "same-cabin" }
  }

  // 4. Fallback estimates
  const CABIN_ESTIMATES: Record<string, number> = {
    economy: 600,
    premium_economy: 1200,
    business: 4000,
    first: 8000,
  }

  return { price: CABIN_ESTIMATES[award.cabinClass] || 600, source: "estimated" }
}

// ─── Value Scoring ───────────────────────────────────────────────

function calculateValueScore(
  flight: UnifiedFlightResult,
  realCpp: number | null,
  cppRating: string | null,
  sweetSpot: SweetSpotMatch | null,
  affordable: boolean,
  roameScore: number | null,
  allFlights: UnifiedFlightResult[],
): number {
  let score = 0

  // CPP value (0-40 points)
  if (realCpp !== null && cppRating) {
    const cppScores: Record<string, number> = {
      exceptional: 40, great: 32, good: 24, fair: 16, poor: 8,
    }
    score += cppScores[cppRating] || 8
  }

  // Sweet spot (0-20 points)
  if (sweetSpot) {
    score += Math.round(sweetSpot.matchScore * 0.2)
  }

  // Affordability (0-15 points)
  score += affordable ? 15 : 5

  // Product quality (0-15 points)
  if (roameScore) {
    score += Math.round(Math.min(roameScore / 100, 1) * 15)
  } else if (flight.cabinClass === "first") {
    score += 13
  } else if (flight.cabinClass === "business") {
    score += 10
  }

  // Convenience (0-10 points)
  if (flight.stops === 0) {
    score += 10
  } else if (flight.stops === 1) {
    score += 6
  } else {
    score += 2
  }

  // Cash flights scored differently
  if (flight.type === "cash") {
    const cashFlightsInCabin = allFlights.filter(f =>
      f.type === "cash" && f.cabinClass === flight.cabinClass && f.cashPrice
    )
    if (cashFlightsInCabin.length > 0) {
      const prices = cashFlightsInCabin.map(f => f.cashPrice!).sort((a, b) => a - b)
      const rank = prices.indexOf(flight.cashPrice!) / prices.length
      score = Math.round((1 - rank) * 50)
    }
  }

  return Math.min(100, Math.max(0, score))
}

// ─── Main Value Engine ───────────────────────────────────────────

export function scoreFlights(
  flights: UnifiedFlightResult[],
  balances: { programKey: string; program: string; balance: number }[],
  origin: string,
  destination: string,
): { scored: ValueScoredFlight[]; insights: ValueInsight[] } {
  const cashFlights = flights.filter(f => f.type === "cash")
  const cashBuckets = buildCashPriceLookup(flights)
  const insights: ValueInsight[] = []

  const scored: ValueScoredFlight[] = flights.map(flight => {
    let realCpp: number | null = null
    let cppRating: ValueScoredFlight["cppRating"] = null
    let cashComparable: number | null = null
    let cashSource: ValueScoredFlight["cashSource"] = null
    let sweetSpotMatch: SweetSpotMatch | null = null
    let fundingPath: FundingPath | null = null
    let affordable = true
    let affordDetails = ""

    if (flight.type === "award" && flight.points && flight.points > 0) {
      const comparable = findCashComparable(flight, cashFlights, cashBuckets)
      cashComparable = comparable.price
      cashSource = comparable.source

      realCpp = cashComparable > 0 ? Math.round(((cashComparable - flight.taxes) / (flight.points / 100)) * 10) / 10 : null
      cppRating = realCpp !== null ? rateCpp(realCpp, flight.cabinClass) : null

      const sweetSpots = matchSweetSpots(
        flight.origin, flight.destination,
        flight.pointsProgram || "", flight.cabinClass,
        flight.points, cashComparable,
      )
      sweetSpotMatch = sweetSpots.length > 0 ? sweetSpots[0]! : null

      const affordability = canAfford(flight.pointsProgram || "", flight.points, balances)
      affordable = affordability.affordable
      affordDetails = affordability.details

      const paths = findFundingPaths(flight.pointsProgram || "", flight.points, balances)
      fundingPath = paths.length > 0 ? paths[0]! : null
    } else if (flight.type === "cash") {
      affordable = true
      affordDetails = `$${flight.cashPrice?.toLocaleString()} cash`
    }

    const valueScore = calculateValueScore(
      flight, realCpp, cppRating, sweetSpotMatch, affordable,
      flight.roameScore, flights,
    )

    return {
      ...flight,
      realCpp,
      cppRating,
      cashComparable,
      cashSource,
      sweetSpotMatch,
      fundingPath,
      canAfford: affordable,
      affordDetails,
      valueScore,
    }
  })

  // Generate insights

  const sweetSpotHits = scored.filter(f => f.sweetSpotMatch)
  if (sweetSpotHits.length > 0) {
    const best = sweetSpotHits.sort((a, b) => b.valueScore - a.valueScore)[0]!
    insights.push({
      type: "sweet-spot-available",
      priority: "high",
      title: `Sweet Spot Found: ${best.sweetSpotMatch!.spot.programName}`,
      detail: best.sweetSpotMatch!.spot.description,
      actionUrl: best.bookingUrl,
    })
  }

  const routeSpots = getSweetSpotsForRoute(origin, destination)
  const unmatchedSpots = routeSpots.filter(spot =>
    !sweetSpotHits.some(f => f.sweetSpotMatch?.spot.id === spot.id)
  )
  for (const spot of unmatchedSpots.slice(0, 3)) {
    insights.push({
      type: "route-tip",
      priority: "low",
      title: `Look for: ${spot.programName} ${spot.cabin}`,
      detail: `${spot.description} (up to ${spot.maxPoints.toLocaleString()} pts, ~${spot.expectedCpp}c/pt)`,
    })
  }

  const bestAward = scored
    .filter(f => f.type === "award" && f.realCpp !== null)
    .sort((a, b) => (b.realCpp || 0) - (a.realCpp || 0))[0]
  const cheapestCash = scored
    .filter(f => f.type === "cash" && f.cashPrice)
    .sort((a, b) => (a.cashPrice || Infinity) - (b.cashPrice || Infinity))[0]

  if (bestAward && cheapestCash && bestAward.realCpp !== null && bestAward.realCpp < 1.0) {
    insights.push({
      type: "cash-wins",
      priority: "high",
      title: "Cash Might Win Here",
      detail: `Best award is only ${bestAward.realCpp}c/pt. The $${cheapestCash.cashPrice?.toLocaleString()} cash fare saves your points for a better redemption.`,
    })
  }

  const exceptionals = scored.filter(f => f.cppRating === "exceptional" && f.canAfford)
  if (exceptionals.length > 0) {
    const best = exceptionals.sort((a, b) => (b.realCpp || 0) - (a.realCpp || 0))[0]!
    insights.push({
      type: "book-now",
      priority: "high",
      title: `Exceptional Value: ${best.realCpp}c/pt`,
      detail: `${best.pointsProgram} ${best.cabinClass} for ${best.points?.toLocaleString()} pts vs $${best.cashComparable?.toLocaleString()} cash. ${best.affordDetails}`,
      actionUrl: best.bookingUrl,
    })
  }

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  insights.sort((a, b) => priorityOrder[a.priority]! - priorityOrder[b.priority]!)

  return { scored, insights }
}

// ─── Cross-Provider Deduplication ──────────────────────────────

/** Merge duplicate flights across providers. Keeps the highest-scoring result per unique flight. */
export function deduplicateFlights(flights: ValueScoredFlight[]): ValueScoredFlight[] {
  const groups = new Map<string, ValueScoredFlight[]>()

  for (const f of flights) {
    const program = f.type === "award" ? (f.pointsProgram || "UNKNOWN") : "CASH"
    const date = f.travelDate || f.searchDate || ""
    const key = `${f.origin}-${f.destination}-${date}-${f.cabinClass}-${program}-${f.stops}-${f.airline}`
    const group = groups.get(key)
    if (group) {
      group.push(f)
    } else {
      groups.set(key, [f])
    }
  }

  const result: ValueScoredFlight[] = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      const single = { ...group[0]!, sources: [group[0]!.source] }
      result.push(single)
      continue
    }

    group.sort((a, b) => b.valueScore - a.valueScore)
    const best = { ...group[0]! }
    best.sources = [...new Set(group.map(f => f.source))]

    // Use lowest points cost across sources
    if (best.type === "award") {
      const pointsCosts = group.filter(f => f.points != null).map(f => f.points!)
      if (pointsCosts.length > 0) {
        const lowest = Math.min(...pointsCosts)
        if (lowest < (best.points || Infinity)) {
          best.points = lowest
        }
      }
    }

    result.push(best)
  }

  return result
}
