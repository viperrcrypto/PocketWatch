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
import { searchAtfAwards } from "./atf-mcp-client"
import { searchPointMe } from "./pointme-client"
import { searchSkiplaggedFlights } from "./skiplagged-client"
import { searchKiwiFlights } from "./kiwi-client"
import { scoreFlights, deduplicateFlights } from "./value-engine"
import { getSweetSpotsForRoute } from "./sweet-spots"
import { expandFlexDates, tagResults, generateWarnings } from "./search-helpers"
import { generateRecommendations } from "./recommendation-engine"

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
  /** ATF now uses OAuth: pass the userId; the MCP client loads/refreshes the token. */
  atfUserId?: string
  pointmeToken?: string
  /** Keyless Skiplagged MCP (cash + hidden-city). Set only on the primary combo. */
  skiplagged?: boolean
  /** Keyless Kiwi MCP (cash, incl. budget carriers). Set only on the primary combo. */
  kiwi?: boolean
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
    const classes = searchClass === "both" ? ["ECON", "PREM"] : [searchClass === "BIZ" || searchClass === "FIRST" ? "PREM" : searchClass]
    for (const cls of classes) {
      promises.push(
        (async () => {
          onProgress?.({ source: `${prefix}roame`, status: "searching" })
          const { fares, percentCompleted } = await searchRoame(
            credentials.roameSession!, origin, destination, date, cls,
          )
          console.log(`[travel] Roame ${origin}→${destination} ${date} (${cls}): ${fares.length} raw fares, ${percentCompleted}% complete`)
          const unified = roameFaresToUnified(fares, cls)
          if (leg) unified.forEach(f => f.leg = leg)
          allFlights.push(...unified)
          completionPct[`${prefix}roame`] = percentCompleted
          onProgress?.({ source: `${prefix}roame`, status: "complete", flights: unified.length })
        })().catch(err => {
          console.error(`[travel] Roame search failed (${origin}→${destination} ${date}):`, (err as Error).message)
          completionPct[`${prefix}roame`] = 0
          onProgress?.({ source: `${prefix}roame`, status: "failed", error: (err as Error).message })
        })
      )
    }
  }

  // Google Flights — keyless direct client first, SerpAPI fallback.
  // Outbound legs price round-trips natively (RT config → outbound candidates
  // with RT pricing); return legs now run too, as one-way searches via the
  // direct client only (SerpAPI never covered return legs, so its fallback
  // stays outbound-only behind the key gate).
  {
    const googleSource = `${prefix}google`
    const serpFallbackKey = leg === "return" ? undefined : credentials.serpApiKey
    promises.push(
      (async () => {
        onProgress?.({ source: googleSource, status: "searching" })
        const flights = await searchGoogleFlights(serpFallbackKey, googleConfig || {
          origin, destination, departureDate: date, searchClass,
        })
        if (leg) flights.forEach(f => f.leg = leg)
        allFlights.push(...flights)
        completionPct[googleSource] = flights.length > 0 ? 100 : 0
        onProgress?.({ source: googleSource, status: "complete", flights: flights.length })
      })().catch(err => {
        console.error(`[travel] Google Flights failed (${origin}→${destination} ${date}):`, (err as Error).message)
        completionPct[googleSource] = 0
        onProgress?.({ source: googleSource, status: "failed", error: (err as Error).message })
      })
    )
  }

  // ATF (Award Travel Finder) — OAuth Bearer MCP; returns [] if not connected.
  if (credentials.atfUserId) {
    promises.push(
      (async () => {
        onProgress?.({ source: `${prefix}atf`, status: "searching" })
        const flights = await searchAtfAwards(credentials.atfUserId!, origin, destination, date)
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
        console.error(`[travel] ATF search failed (${origin}→${destination} ${date}):`, (err as Error).message)
        completionPct[`${prefix}atf`] = 0
        onProgress?.({ source: `${prefix}atf`, status: "failed", error: (err as Error).message })
      })
    )
  }

  // point.me search (split "both" into ECON + PREM like Roame)
  if (credentials.pointmeToken) {
    const pmClasses = searchClass === "both" ? ["ECON", "PREM"] : [searchClass === "BIZ" || searchClass === "FIRST" ? "PREM" : searchClass]
    for (const cls of pmClasses) {
      promises.push(
        (async () => {
          onProgress?.({ source: `${prefix}pointme`, status: "searching" })
          const flights = await searchPointMe(
            credentials.pointmeToken!, origin, destination, date, cls,
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
  }

  // Skiplagged (keyless MCP) — cash + hidden-city inventory. One-way per leg,
  // so it runs on return legs too. Gated to the primary combo (the flag is only
  // set on the full credentials object, never on the stripped comboCreds).
  if (credentials.skiplagged) {
    promises.push(
      (async () => {
        onProgress?.({ source: `${prefix}skiplagged`, status: "searching" })
        const flights = await searchSkiplaggedFlights({ origin, destination, departureDate: date, searchClass })
        if (leg) flights.forEach(f => f.leg = leg)
        allFlights.push(...flights)
        completionPct[`${prefix}skiplagged`] = flights.length > 0 ? 100 : 0
        onProgress?.({ source: `${prefix}skiplagged`, status: "complete", flights: flights.length })
      })().catch(err => {
        console.error(`[travel] Skiplagged failed (${origin}→${destination} ${date}):`, (err as Error).message)
        completionPct[`${prefix}skiplagged`] = 0
        onProgress?.({ source: `${prefix}skiplagged`, status: "failed", error: (err as Error).message })
      })
    )
  }

  // Kiwi (keyless MCP) — cash inventory incl. budget carriers SerpAPI misses.
  // One-way per leg, primary-combo only (same gating as Skiplagged).
  if (credentials.kiwi) {
    promises.push(
      (async () => {
        onProgress?.({ source: `${prefix}kiwi`, status: "searching" })
        const flights = await searchKiwiFlights({ origin, destination, departureDate: date, searchClass })
        if (leg) flights.forEach(f => f.leg = leg)
        allFlights.push(...flights)
        completionPct[`${prefix}kiwi`] = flights.length > 0 ? 100 : 0
        onProgress?.({ source: `${prefix}kiwi`, status: "complete", flights: flights.length })
      })().catch(err => {
        console.error(`[travel] Kiwi failed (${origin}→${destination} ${date}):`, (err as Error).message)
        completionPct[`${prefix}kiwi`] = 0
        onProgress?.({ source: `${prefix}kiwi`, status: "failed", error: (err as Error).message })
      })
    )
  }

  await Promise.allSettled(promises)
  console.log(`[travel] searchOneLeg ${origin}→${destination} ${date}: ${allFlights.length} total flights (roame=${allFlights.filter(f => f.source === "roame").length}, google=${allFlights.filter(f => f.source === "google").length}, atf=${allFlights.filter(f => f.source === "atf").length})`)
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

  // Run value engine + deduplicate cross-provider results
  const { scored, insights } = scoreFlights(allFlights, balances, config.origin, config.destination)
  scored.sort((a, b) => b.valueScore - a.valueScore)
  const deduped = deduplicateFlights(scored)

  const recommendations = generateRecommendations(deduped, balances)
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
    flights: deduped,
    recommendations,
    insights,
    routeSweetSpots,
    warnings,
  }

  // Cache the result (balances may change so we re-attach on cache hit)
  responseCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS })

  return result
}
