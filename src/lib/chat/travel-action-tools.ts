/**
 * PocketLLM live-search tool executors — run real flight/hotel searches.
 *
 * Calls the orchestrators directly (no HTTP self-call) with credentials the
 * shared loader resolves for the given userId. All provider-sourced strings and
 * URLs are sanitized before being serialized into the LLM tool result.
 *
 * userId is always supplied by the dispatcher from the server session, never
 * from tool input. Every DB query underneath is scoped by that userId.
 */

import { runSearch } from "@/lib/travel/search-orchestrator"
import { searchHotels } from "@/lib/travel/hotel-orchestrator"
import { loadSearchCredentials, loadPointsBalances } from "@/lib/travel/search-credentials"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { isRealIsoDate } from "@/lib/iso-date"
import { sanitizeExternalUrl } from "@/lib/travel/url-safety"
import { cleanText, cleanTextOrNull } from "./sanitize"
import type { SearchConfig } from "@/types/travel"

type ToolInput = Record<string, unknown>

const IATA = /^[A-Z]{3}$/
const MAX_FLIGHTS = 8
const MAX_HOTELS = 8
const MAX_HOTEL_QUERY = 100

const SEARCH_CLASSES = ["ECON", "PREM_ECON", "BIZ", "FIRST", "both"] as const
type SearchClass = (typeof SEARCH_CLASSES)[number]

function err(message: string): string {
  return JSON.stringify({ error: message })
}

function normalizeClass(value: unknown): SearchClass {
  return SEARCH_CLASSES.includes(value as SearchClass) ? (value as SearchClass) : "BIZ"
}

function durationLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${minutes % 60}m`
}

export async function searchFlightsLive(userId: string, input: ToolInput): Promise<string> {
  const origin = String(input.origin ?? "").trim().toUpperCase()
  const destination = String(input.destination ?? "").trim().toUpperCase()
  const departureDate = String(input.departureDate ?? "").trim()

  if (!IATA.test(origin) || !IATA.test(destination)) {
    return err("origin and destination must be valid 3-letter IATA codes (e.g. LAX).")
  }
  if (!isRealIsoDate(departureDate)) {
    return err("departureDate must be a real calendar date (YYYY-MM-DD).")
  }

  const tripType = input.tripType === "round_trip" ? "round_trip" : "one_way"
  const returnDate = typeof input.returnDate === "string" && isRealIsoDate(input.returnDate)
    ? input.returnDate
    : undefined
  if (tripType === "round_trip" && !returnDate) {
    return err("Round-trip search requires a valid returnDate (YYYY-MM-DD).")
  }

  const config: SearchConfig = {
    origin,
    destination,
    departureDate,
    searchClass: normalizeClass(input.searchClass),
    tripType,
    returnDate,
    flexDates: input.flexDates === true || undefined,
  }

  const { roameSession, serpApiKey, pointmeToken } = await loadSearchCredentials(userId)
  const balances = await loadPointsBalances(userId)

  const results = await runSearch(
    config,
    { roameSession, serpApiKey, atfUserId: userId, pointmeToken, skiplagged: true, kiwi: true },
    balances,
  )

  // Persist as the latest search so get_flight_results can filter it (mirrors the
  // SSE route). Best-effort: a failed persist must not fail the live search.
  const resultsJson = JSON.parse(JSON.stringify(results))
  await db.flightSearchResult
    .upsert({
      where: { userId },
      create: { userId, results: resultsJson, searchedAt: new Date() },
      update: { results: resultsJson, searchedAt: new Date() },
    })
    .catch((err) => console.warn("[chat] Failed to persist live flight results:", err))

  const top = [...results.flights]
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, MAX_FLIGHTS)

  // `type` discriminator is REQUIRED by the chat renderer (result-payload.ts)
  // to swap raw JSON for flight cards.
  return JSON.stringify({
    type: "flights",
    route: `${cleanText(results.meta.origin)} → ${cleanText(results.meta.destination)}`,
    departureDate: cleanText(results.meta.departureDate),
    tripType,
    totalFound: results.flights.length,
    showing: top.length,
    flights: top.map((f) => ({
      airline: cleanText(f.airline),
      route: `${cleanText(f.origin)} → ${cleanText(f.destination)}`,
      stops: f.stops,
      duration: durationLabel(f.durationMinutes),
      cabin: cleanText(f.cabinClass),
      type: f.type,
      points: f.points,
      program: cleanTextOrNull(f.pointsProgram),
      cashPrice: f.cashPrice,
      valueScore: f.valueScore,
      bookingUrl: sanitizeExternalUrl(f.bookingUrl),
    })),
    note: "Live search results. Saved as the latest flight search for follow-up filtering.",
  })
}

export async function searchHotelsLive(userId: string, input: ToolInput): Promise<string> {
  const query = String(input.query ?? "").trim().slice(0, MAX_HOTEL_QUERY)
  const checkIn = String(input.checkIn ?? "").trim()
  const checkOut = String(input.checkOut ?? "").trim()
  const adults = Math.min(Math.max(Number(input.adults) || 2, 1), 8)

  if (!query) return err("query (city or hotel name) is required.")
  if (!isRealIsoDate(checkIn) || !isRealIsoDate(checkOut)) {
    return err("checkIn and checkOut must be real calendar dates (YYYY-MM-DD).")
  }

  const [serpCred, atfCred] = await Promise.all([
    db.financeCredential.findUnique({ where: { userId_service: { userId, service: "serpapi" } } }),
    db.financeCredential.findUnique({ where: { userId_service: { userId, service: "atf" } } }),
  ])
  const [serpApiKey, atfApiKey] = await Promise.all([
    serpCred ? decryptCredential(serpCred.encryptedKey) : null,
    atfCred ? decryptCredential(atfCred.encryptedKey) : null,
  ])

  const results = await searchHotels(
    { query, checkInDate: checkIn, checkOutDate: checkOut, adults },
    { serpApiKey, atfApiKey, trivago: true },
  )

  const top = results.hotels.slice(0, MAX_HOTELS)

  // `type` discriminator is REQUIRED by the chat renderer (result-payload.ts)
  // to swap raw JSON for hotel cards.
  return JSON.stringify({
    type: "hotels",
    query: cleanText(results.meta.query),
    checkIn: cleanText(results.meta.checkIn),
    checkOut: cleanText(results.meta.checkOut),
    adults: results.meta.adults,
    totalFound: results.hotels.length,
    showing: top.length,
    hotels: top.map((h) => ({
      name: cleanText(h.name),
      location: cleanText(h.location),
      hotelClass: h.hotelClass,
      rating: h.overallRating,
      cashPerNight: h.cashPerNight,
      currency: cleanText(h.currency),
      pointsPerNight: h.pointsPerNight,
      pointsProgram: cleanTextOrNull(h.pointsProgram),
      brand: cleanTextOrNull(h.brand),
      bookingUrl: sanitizeExternalUrl(h.bookingLinks[0]?.link),
    })),
  })
}
