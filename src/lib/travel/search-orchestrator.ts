/**
 * Search Orchestrator — runs Roame + Google Flights in parallel,
 * scores results with value engine, generates recommendations.
 */

import type {
  SearchConfig,
  RoameCredentials,
  PointsBalance,
  DashboardResults,
  Recommendation,
  UnifiedFlightResult,
  ValueScoredFlight,
} from "@/types/travel"
import { searchRoame, roameFaresToUnified } from "./roame-client"
import { searchGoogleFlights } from "./google-flights-client"
import { searchATF } from "./atf-client"
import { searchPointMe } from "./pointme-client"
import { scoreFlights } from "./value-engine"
import { getSweetSpotsForRoute } from "./sweet-spots"
import { expandFlexDates, tagResults, generateWarnings } from "./search-helpers"

// ─── Progress Callback ──────────────────────────────────────────

export interface SearchProgress {
  source: string
  status: "searching" | "complete" | "failed"
  flights?: number
  error?: string
}

interface SearchCredentials {
  roameSession?: RoameCredentials
  serpApiKey?: string
  atfApiKey?: string
  pointmeToken?: string
}

// ─── Response Cache ─────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const responseCache = new Map<string, { data: DashboardResults; expiry: number }>()

function getFlightCacheKey(config: SearchConfig): string {
  const rt = config.tripType === "round_trip" ? `:rt:${config.returnDate}` : ""
  const origins = config.origins?.join(",") || config.origin
  const dests = config.destinations?.join(",") || config.destination
  const flex = config.flexDates ? ":flex" : ""
  return `flight:${origins}:${dests}:${config.departureDate}:${config.searchClass}${rt}${flex}`
}

// ─── Recommendation Engine ──────────────────────────────────────

function generateRecommendations(
  flights: ValueScoredFlight[],
  _balances: PointsBalance[],
): Recommendation[] {
  const recommendations: Recommendation[] = []

  // #1: Best value award
  const bestValueAwards = flights
    .filter(f => f.type === "award" && f.realCpp !== null && f.realCpp > 0 && f.canAfford)
    .sort((a, b) => (b.realCpp || 0) - (a.realCpp || 0))

  if (bestValueAwards.length > 0) {
    const best = bestValueAwards[0]!
    const cppLabel = best.cashSource === "exact-match" ? "(vs actual cash)" :
                     best.cashSource === "same-cabin" ? "(vs avg cash)" : "(est.)"
    const sweetSpotTag = best.sweetSpotMatch ? " SWEET SPOT" : ""

    recommendations.push({
      rank: 1,
      title: `${best.pointsProgram} → ${best.airline}${sweetSpotTag}`,
      subtitle: `${best.cabinClass} class via ${best.airports.join("→")}`,
      details: [
        `${best.flightNumbers.join(" / ")}`,
        `${Math.floor(best.durationMinutes / 60)}h${best.durationMinutes % 60}m, ${best.stops} stop${best.stops !== 1 ? "s" : ""}`,
        `Cash comparable: $${best.cashComparable?.toLocaleString()} ${cppLabel}`,
        best.affordDetails,
        ...(best.sweetSpotMatch ? [best.sweetSpotMatch.spot.description.slice(0, 80)] : []),
      ],
      totalCost: `${(best.points || 0).toLocaleString()} pts + $${best.taxes}`,
      cppValue: `${best.realCpp}c/pt`,
      bookingUrl: best.bookingUrl,
      badgeText: "#1 BEST VALUE",
      badgeColor: "emerald",
    })
  }

  // #2: Best product (premium cabin + high value score)
  const alreadyUsed = bestValueAwards[0]?.id
  const bestPremium = flights
    .filter(f =>
      f.type === "award" &&
      (f.cabinClass === "business" || f.cabinClass === "first") &&
      f.canAfford &&
      f.id !== alreadyUsed
    )
    .sort((a, b) => b.valueScore - a.valueScore)[0]

  if (bestPremium) {
    recommendations.push({
      rank: 2,
      title: `${bestPremium.pointsProgram} → ${bestPremium.airline}`,
      subtitle: `${bestPremium.cabinClass} class • ${bestPremium.airports.join("→")}`,
      details: [
        bestPremium.flightNumbers.join(" / "),
        `Value Score: ${bestPremium.valueScore}/100`,
        bestPremium.realCpp ? `${bestPremium.realCpp}c/pt vs $${bestPremium.cashComparable?.toLocaleString()} cash` : "",
        `${Math.floor(bestPremium.durationMinutes / 60)}h${bestPremium.durationMinutes % 60}m`,
      ].filter(Boolean),
      totalCost: `${(bestPremium.points || 0).toLocaleString()} pts + $${bestPremium.taxes}`,
      cppValue: bestPremium.realCpp ? `${bestPremium.realCpp}c/pt` : null,
      bookingUrl: bestPremium.bookingUrl,
      badgeText: "#2 BEST PRODUCT",
      badgeColor: "accent",
    })
  }

  // #3: Cash option
  const cheapestCash = flights
    .filter(f => f.type === "cash" && f.cashPrice && f.cashPrice > 0)
    .sort((a, b) => (a.cashPrice || Infinity) - (b.cashPrice || Infinity))[0]

  if (cheapestCash) {
    const bestAwardCpp = bestValueAwards[0]?.realCpp || 0
    const cashWins = bestAwardCpp < 1.5

    recommendations.push({
      rank: 3,
      title: `Cash ${cheapestCash.cabinClass} at $${cheapestCash.cashPrice?.toLocaleString()}`,
      subtitle: `${cheapestCash.airline} • ${cheapestCash.stops === 0 ? "Nonstop" : `${cheapestCash.stops} stop`}`,
      details: [
        cheapestCash.flightNumbers.join(" / "),
        cashWins
          ? `Cash wins — best award is only ${bestAwardCpp}c/pt, save points for a better route`
          : `Points get ${bestAwardCpp}c/pt value here — use them`,
      ],
      totalCost: `$${cheapestCash.cashPrice?.toLocaleString()}`,
      cppValue: null,
      bookingUrl: cheapestCash.bookingUrl,
      badgeText: cashWins ? "#3 CASH WINS" : "#3 SAVE POINTS",
      badgeColor: "gold",
    })
  }

  return recommendations
}

// ─── Single-Leg Search ──────────────────────────────────────────

interface LegSearchParams {
  origin: string
  destination: string
  date: string
  searchClass: SearchConfig["searchClass"]
  leg?: "outbound" | "return"
  /** For Google Flights round-trip, pass the full config */
  googleConfig?: SearchConfig
}

async function searchOneLeg(
  params: LegSearchParams,
  credentials: SearchCredentials,
  completionPct: Record<string, number>,
  onProgress?: (progress: SearchProgress) => void,
): Promise<UnifiedFlightResult[]> {
  const { origin, destination, date, searchClass, leg, googleConfig } = params
  const allFlights: UnifiedFlightResult[] = []
  const promises: Promise<void>[] = []
  const prefix = leg === "return" ? "return:" : ""

  // Roame search
  if (credentials.roameSession) {
    const classes = searchClass === "both" ? ["ECON", "PREM"] : [searchClass]
    for (const cls of classes) {
      promises.push(
        (async () => {
          onProgress?.({ source: `${prefix}roame`, status: "searching" })
          const { fares, percentCompleted } = await searchRoame(
            credentials.roameSession!, origin, destination, date, cls,
          )
          const unified = roameFaresToUnified(fares, cls)
          if (leg) unified.forEach(f => f.leg = leg)
          allFlights.push(...unified)
          completionPct[`${prefix}roame`] = percentCompleted
          onProgress?.({ source: `${prefix}roame`, status: "complete", flights: unified.length })
        })().catch(err => {
          completionPct[`${prefix}roame`] = 0
          onProgress?.({ source: `${prefix}roame`, status: "failed", error: (err as Error).message })
        })
      )
    }
  }

  // Google Flights via SerpAPI (only for outbound — SerpAPI handles RT natively)
  if (credentials.serpApiKey && leg !== "return") {
    promises.push(
      (async () => {
        onProgress?.({ source: "google", status: "searching" })
        const flights = await searchGoogleFlights(credentials.serpApiKey!, googleConfig || {
          origin, destination, departureDate: date, searchClass,
        })
        if (leg) flights.forEach(f => f.leg = leg)
        allFlights.push(...flights)
        completionPct["google"] = flights.length > 0 ? 100 : 0
        onProgress?.({ source: "google", status: "complete", flights: flights.length })
      })().catch(err => {
        completionPct["google"] = 0
        onProgress?.({ source: "google", status: "failed", error: (err as Error).message })
      })
    )
  }

  // ATF (Award Travel Finder)
  if (credentials.atfApiKey) {
    promises.push(
      (async () => {
        onProgress?.({ source: `${prefix}atf`, status: "searching" })
        const flights = await searchATF(credentials.atfApiKey!, origin, destination, date)
        for (const f of flights) {
          const roameMatch = allFlights.find(
            r => r.source === "roame" &&
              r.pointsProgram === f.pointsProgram &&
              r.cabinClass === f.cabinClass &&
              r.travelDate === f.travelDate
          )
          f.tags = roameMatch ? ["cross-verified"] : ["ATF-exclusive"]
        }
        if (leg) flights.forEach(f => f.leg = leg)
        allFlights.push(...flights)
        completionPct[`${prefix}atf`] = flights.length > 0 ? 100 : 0
        onProgress?.({ source: `${prefix}atf`, status: "complete", flights: flights.length })
      })().catch(err => {
        completionPct[`${prefix}atf`] = 0
        onProgress?.({ source: `${prefix}atf`, status: "failed", error: (err as Error).message })
      })
    )
  }

  // point.me search
  if (credentials.pointmeToken) {
    promises.push(
      (async () => {
        onProgress?.({ source: `${prefix}pointme`, status: "searching" })
        const flights = await searchPointMe(
          credentials.pointmeToken!, origin, destination, date, searchClass,
        )
        if (leg) flights.forEach(f => f.leg = leg)
        allFlights.push(...flights)
        completionPct[`${prefix}pointme`] = flights.length > 0 ? 100 : 0
        onProgress?.({ source: `${prefix}pointme`, status: "complete", flights: flights.length })
      })().catch(err => {
        completionPct[`${prefix}pointme`] = 0
        onProgress?.({ source: `${prefix}pointme`, status: "failed", error: (err as Error).message })
      })
    )
  }

  await Promise.allSettled(promises)
  return allFlights
}

// ─── Main Orchestrator ──────────────────────────────────────────

export async function runSearch(
  config: SearchConfig,
  credentials: SearchCredentials,
  balances: PointsBalance[],
  onProgress?: (progress: SearchProgress) => void,
): Promise<DashboardResults> {
  // Check cache
  const cacheKey = getFlightCacheKey(config)
  const cached = responseCache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) {
    onProgress?.({ source: "cache", status: "complete", flights: cached.data.flights.length })
    return { ...cached.data, balances }
  }

  const completionPct: Record<string, number> = {}
  const isRoundTrip = config.tripType === "round_trip" && config.returnDate

  // Build origin/destination/date combos
  const origins = config.origins?.length ? config.origins : [config.origin]
  const dests = config.destinations?.length ? config.destinations : [config.destination]
  const dates = config.flexDates ? expandFlexDates(config.departureDate) : [config.departureDate]
  const isMulti = origins.length > 1 || dests.length > 1 || dates.length > 1

  const allFlights: UnifiedFlightResult[] = []

  // Run all outbound combos in parallel
  const outboundPromises: Promise<void>[] = []
  let comboIndex = 0

  for (const orig of origins) {
    for (const dest of dests) {
      for (const date of dates) {
        const isPrimary = comboIndex === 0
        comboIndex++
        const label = isMulti ? `${orig}-${dest}:${date}` : undefined

        outboundPromises.push(
          (async () => {
            // For non-primary combos, strip ATF to protect budget (21 calls/combo)
            // point.me is one API call so it's fine on all combos
            const comboCreds = isPrimary ? credentials : {
              roameSession: credentials.roameSession,
              serpApiKey: credentials.serpApiKey,
              pointmeToken: credentials.pointmeToken,
              // ATF only on primary combo
            }

            const flights = await searchOneLeg(
              {
                origin: orig,
                destination: dest,
                date,
                searchClass: config.searchClass,
                leg: isRoundTrip ? "outbound" : undefined,
                googleConfig: isPrimary ? config : { ...config, origin: orig, destination: dest, departureDate: date },
              },
              comboCreds,
              completionPct,
              label ? (p) => onProgress?.({ ...p, source: `${label}:${p.source}` }) : onProgress,
            )

            const tagged = tagResults(flights, orig, dest, date, isRoundTrip ? "outbound" : undefined)
            allFlights.push(...tagged)
          })()
        )
      }
    }
  }

  await Promise.allSettled(outboundPromises)

  // Return leg (round-trip only) — swapped origin/dest, uses returnDate
  if (isRoundTrip) {
    const returnDates = config.flexDates ? expandFlexDates(config.returnDate!) : [config.returnDate!]
    const returnPromises: Promise<void>[] = []
    let retCombo = 0

    for (const dest of dests) {
      for (const orig of origins) {
        for (const rDate of returnDates) {
          const isPrimary = retCombo === 0
          retCombo++
          const label = isMulti ? `ret:${dest}-${orig}:${rDate}` : undefined

          returnPromises.push(
            (async () => {
              const comboCreds = isPrimary ? credentials : {
                roameSession: credentials.roameSession,
                serpApiKey: credentials.serpApiKey,
                pointmeToken: credentials.pointmeToken,
              }

              const flights = await searchOneLeg(
                {
                  origin: dest,
                  destination: orig,
                  date: rDate,
                  searchClass: config.searchClass,
                  leg: "return",
                },
                comboCreds,
                completionPct,
                label ? (p) => onProgress?.({ ...p, source: `${label}:${p.source}` }) : onProgress,
              )

              const tagged = tagResults(flights, dest, orig, rDate, "return")
              allFlights.push(...tagged)
            })()
          )
        }
      }
    }

    await Promise.allSettled(returnPromises)
  }

  // Run value engine
  const { scored, insights } = scoreFlights(allFlights, balances, config.origin, config.destination)
  scored.sort((a, b) => b.valueScore - a.valueScore)

  const recommendations = generateRecommendations(scored, balances)
  const warnings = generateWarnings(balances)
  const routeSpots = getSweetSpotsForRoute(config.origin, config.destination)
  const routeSweetSpots = routeSpots.map(s => ({
    program: s.programName,
    cabin: s.cabin,
    maxPoints: s.maxPoints,
    description: s.description,
  }))

  const result: DashboardResults = {
    meta: {
      origin: config.origin,
      destination: config.destination,
      departureDate: config.departureDate,
      searchedAt: new Date().toISOString(),
      sources: Object.keys(completionPct),
      completionPct,
      ...(isMulti ? {
        origins: origins.length > 1 ? origins : undefined,
        destinations: dests.length > 1 ? dests : undefined,
        flexDates: config.flexDates || undefined,
      } : {}),
    },
    balances,
    flights: scored,
    recommendations,
    insights,
    routeSweetSpots,
    warnings,
  }

  // Cache the result (balances may change so we re-attach on cache hit)
  responseCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS })

  return result
}
