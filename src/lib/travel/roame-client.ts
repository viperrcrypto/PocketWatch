/**
 * Roame GraphQL client — searches award availability across all mileage programs.
 * Adapted from standalone roame-scraper.ts for server-side use in PocketWatch.
 */

import type { RoameFare, RoameCredentials, UnifiedFlightResult } from "@/types/travel"
import { buildProgramBookingUrl, guessCabinFromClasses, CABIN_CASH_ESTIMATES, AIRLINE_NAMES } from "./constants"

const GRAPHQL_URL = "https://roame.travel/api/graphql"

// ─── GraphQL Client ──────────────────────────────────────────────

async function graphql(
  query: string,
  variables: Record<string, unknown>,
  creds: RoameCredentials,
): Promise<Record<string, unknown>> {
  const resp = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": creds.csrfSecret
        ? `session=${creds.session}; csrfSecret=${creds.csrfSecret}`
        : `session=${creds.session}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!resp.ok) {
    throw new Error(`Roame API HTTP ${resp.status}: ${resp.statusText}`)
  }

  const json = await resp.json() as Record<string, unknown>
  const errors = json.errors as Array<{ message: string }> | undefined
  if (errors) {
    const msg = errors.map(e => e.message).join("; ")
    throw new Error(`Roame GraphQL error: ${msg}`)
  }

  return json
}

// ─── Search Functions ────────────────────────────────────────────

async function initiateSearch(
  origin: string,
  destination: string,
  date: string,
  searchClass: string,
  creds: RoameCredentials,
): Promise<string> {
  const result = await graphql(
    `mutation initiateFlightSearchMutation($flightSearchInput: FlightSearchInput!) {
      initiateFlightSearch(flightSearchInput: $flightSearchInput) { jobUUID }
    }`,
    {
      flightSearchInput: {
        origin,
        destination,
        departureDate: date,
        pax: 1,
        searchClass,
        mileagePrograms: ["ALL"],
        preSearch: false,
        daysAround: 0,
        tripLength: 0,
      },
    },
    creds,
  )

  const data = result.data as { initiateFlightSearch: { jobUUID: string } }
  return data.initiateFlightSearch.jobUUID
}

const FARE_FRAGMENT = `
  arrivalDatetime availableSeats departureDate operatingAirlines
  flightsDepartureDatetimes flightsArrivalDatetimes fareClass
  flightNumberOrder durationMinutes equipmentTypes allAirports
  numStops mileageProgram percentPremiumInt cabinClasses
  originIata destinationIata departureDateStr awardPoints
  surcharge roameScore
`

async function pollResults(
  jobUUID: string,
  creds: RoameCredentials,
  maxWaitMs: number = 90000,
  onProgress?: (pct: number, fareCount: number) => void,
): Promise<{ fares: RoameFare[]; percentCompleted: number }> {
  const start = Date.now()
  let lastPct = 0
  let lastFareCount = 0
  let staleCount = 0

  while (Date.now() - start < maxWaitMs) {
    const result = await graphql(
      `query pingSearchResultsQuery($jobUUID: String!) {
        pingSearchResults(jobUUID: $jobUUID) {
          percentCompleted
          fares { ${FARE_FRAGMENT} }
        }
      }`,
      { jobUUID },
      creds,
    )

    const data = result.data as { pingSearchResults: { percentCompleted: number; fares: RoameFare[] } }
    const { percentCompleted, fares } = data.pingSearchResults
    onProgress?.(percentCompleted, fares.length)

    if (percentCompleted >= 100) {
      return { fares, percentCompleted }
    }

    // Detect stalled search
    if (fares.length === lastFareCount && percentCompleted === lastPct) {
      staleCount++
      if (staleCount >= 4) {
        return { fares, percentCompleted }
      }
    } else {
      staleCount = 0
    }

    lastPct = percentCompleted
    lastFareCount = fares.length
    await new Promise(r => setTimeout(r, 3000))
  }

  return { fares: [], percentCompleted: lastPct }
}

// ─── Public API ──────────────────────────────────────────────────

export async function searchRoame(
  creds: RoameCredentials,
  origin: string,
  destination: string,
  date: string,
  searchClass: string = "PREM",
  onProgress?: (pct: number, fareCount: number) => void,
): Promise<{ fares: RoameFare[]; percentCompleted: number }> {
  const jobUUID = await initiateSearch(origin, destination, date, searchClass, creds)
  return pollResults(jobUUID, creds, 90000, onProgress)
}

/** Convert Roame fares to unified flight result format */
export function roameFaresToUnified(fares: RoameFare[], searchClass: string): UnifiedFlightResult[] {
  return fares.map((fare, idx) => {
    const cabin = guessCabinFromClasses(fare.cabinClasses)
    const estimatedCash = CABIN_CASH_ESTIMATES[cabin] || 800
    const cppValue = fare.awardPoints > 0
      ? ((estimatedCash - fare.surcharge) / (fare.awardPoints / 100))
      : null
    const travelDate = fare.departureDateStr || fare.departureDate || ""

    return {
      id: `roame-${fare.mileageProgram}-${fare.originIata}-${fare.destinationIata}-${travelDate}-${searchClass}-${cabin}-${idx}`,
      source: "roame" as const,
      type: "award" as const,
      origin: fare.originIata,
      destination: fare.destinationIata,
      airline: [...new Set(fare.operatingAirlines.map(c => AIRLINE_NAMES[c] || c))].join(" / "),
      operatingAirlines: fare.operatingAirlines,
      flightNumbers: fare.flightNumberOrder,
      stops: fare.numStops,
      durationMinutes: fare.durationMinutes,
      departureTime: fare.flightsDepartureDatetimes[0] || fare.departureDateStr,
      arrivalTime: fare.arrivalDatetime,
      airports: fare.allAirports.filter((a: string, i: number) => i === 0 || a !== fare.allAirports[i - 1]),
      cabinClass: cabin,
      equipment: fare.equipmentTypes,
      points: fare.awardPoints,
      pointsProgram: fare.mileageProgram,
      cashPrice: null,
      taxes: fare.surcharge,
      currency: "USD",
      cppValue: cppValue ? Math.round(cppValue * 10) / 10 : null,
      roameScore: fare.roameScore,
      availableSeats: fare.availableSeats,
      bookingUrl: buildProgramBookingUrl(fare.mileageProgram, fare.originIata, fare.destinationIata, travelDate, cabin),
      fareClass: fare.fareClass,
      travelDate,
    }
  })
}
