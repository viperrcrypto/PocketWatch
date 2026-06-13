/**
 * PocketLLM trip / saved-route / profile tool executors.
 *
 * Mirrors the validation in the matching API routes (zod schemas, ISO-date
 * checks, the saved-route LOCATION_PATTERN + 100 cap, the traveler-profile
 * masking + merge-on-absent). Every write resolves userId from the dispatcher's
 * server session — never from tool args — and every db query is scoped by it.
 */

import { db } from "@/lib/db"
import { ISO_DATE_PATTERN, isRealIsoDate } from "@/lib/iso-date"
import { tripSpendSummary } from "@/lib/finance/trip-expenses"
import { buildTravelDayBriefing, type BriefingSegment } from "@/lib/travel/travel-day"
import { loadPointsBalances } from "@/lib/travel/search-credentials"
import {
  loadTravelerProfile,
  saveTravelerProfile,
  SEAT_PREFERENCES,
  CABIN_PREFERENCES,
  type TravelerProfile,
} from "@/lib/travel/traveler-profile"
import { cleanText, cleanTextOrNull } from "./sanitize"
import { z } from "zod/v4"

type ToolInput = Record<string, unknown>

const TRIP_SELECT = {
  id: true, name: true, destination: true, startDate: true,
  endDate: true, status: true, notes: true, createdAt: true, updatedAt: true,
} as const

// ─── Validation (mirrors the API routes) ────────────────────────

const isoDate = z.string().regex(ISO_DATE_PATTERN, "Date must be YYYY-MM-DD").refine(isRealIsoDate, "Must be a real calendar date")

const createTripSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    destination: z.string().trim().max(120).optional(),
    startDate: isoDate,
    endDate: isoDate.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, { message: "End date must be on or after start date", path: ["endDate"] })

const updateTripSchema = z
  .object({
    tripId: z.string().min(1),
    name: z.string().trim().min(1).max(120).optional(),
    destination: z.string().trim().max(120).nullable().optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.nullable().optional(),
    status: z.enum(["upcoming", "active", "past"]).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 1, { message: "No fields to update" })

// Airport code or city name: Unicode letter first, then letters + space/dot/
// apostrophe/slash/hyphen, 2-40 chars (mirrors the saved-routes route).
const LOCATION_PATTERN = /^\p{L}[\p{L} .'’/-]{1,39}$/u
const MAX_SAVED_ROUTES = 100

const createRouteSchema = z
  .object({
    origin: z.string().trim().min(1).regex(LOCATION_PATTERN, "Origin must be an airport code or city name"),
    destination: z.string().trim().min(1).regex(LOCATION_PATTERN, "Destination must be an airport code or city name"),
    departureDate: isoDate,
    returnDate: isoDate.optional(),
    tripType: z.enum(["one_way", "round_trip"]).default("one_way"),
    searchClass: z.enum(["ECON", "PREM_ECON", "BIZ", "FIRST", "both"]).default("ECON"),
    alertThreshold: z.number().positive().optional(),
    thresholdType: z.enum(["cash", "points"]).default("cash"),
  })
  .refine((d) => d.tripType !== "round_trip" || !!d.returnDate, { message: "Return date is required for round trips", path: ["returnDate"] })

function fail(message: string): string {
  return JSON.stringify({ error: message })
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input"
}

// ─── Trips ──────────────────────────────────────────────────────

export async function listTrips(userId: string): Promise<string> {
  const trips = await db.trip.findMany({
    where: { userId }, select: TRIP_SELECT, orderBy: { startDate: "desc" }, take: 200,
  })
  return JSON.stringify({ count: trips.length, trips })
}

export async function createTrip(userId: string, input: ToolInput): Promise<string> {
  const parsed = createTripSchema.safeParse(input)
  if (!parsed.success) return fail(firstIssue(parsed.error))
  const trip = await db.trip.create({ data: { ...parsed.data, userId }, select: TRIP_SELECT })
  return JSON.stringify({ created: true, trip })
}

export async function updateTrip(userId: string, input: ToolInput): Promise<string> {
  const parsed = updateTripSchema.safeParse(input)
  if (!parsed.success) return fail(firstIssue(parsed.error))
  const { tripId, ...data } = parsed.data
  const { count } = await db.trip.updateMany({ where: { id: tripId, userId }, data })
  if (count === 0) return fail("Trip not found")
  const trip = await db.trip.findFirst({ where: { id: tripId, userId }, select: TRIP_SELECT })
  return JSON.stringify({ updated: true, trip })
}

export async function deleteTrip(userId: string, input: ToolInput): Promise<string> {
  const tripId = String(input.tripId ?? "")
  if (!tripId) return fail("tripId is required")
  const { count } = await db.trip.deleteMany({ where: { id: tripId, userId } })
  if (count === 0) return fail("Trip not found")
  return JSON.stringify({ deleted: true, tripId })
}

export async function getTripExpenses(userId: string, input: ToolInput): Promise<string> {
  const tripId = String(input.tripId ?? "")
  if (!tripId) return fail("tripId is required")
  const trip = await db.trip.findFirst({ where: { id: tripId, userId }, select: { id: true } })
  if (!trip) return fail("Trip not found")
  const spend = await tripSpendSummary(userId, tripId)
  return JSON.stringify({ tripId, spend })
}

export async function getTripBriefing(userId: string, input: ToolInput): Promise<string> {
  const tripId = String(input.tripId ?? "")
  if (!tripId) return fail("tripId is required")

  const trip = await db.trip.findFirst({
    where: { id: tripId, userId },
    select: {
      destination: true, startDate: true,
      segments: {
        select: { type: true, title: true, startAt: true, endAt: true, location: true },
        orderBy: { startAt: "asc" }, take: 200,
      },
    },
  })
  if (!trip) return fail("Trip not found")

  const segments: BriefingSegment[] = trip.segments.map((s) => ({
    type: s.type,
    title: s.title,
    startAt: s.startAt ? s.startAt.toISOString() : null,
    endAt: s.endAt ? s.endAt.toISOString() : null,
    location: s.location,
  }))

  const briefing = await buildTravelDayBriefing({ destination: trip.destination, startDate: trip.startDate, segments })

  // WeatherAPI `condition` and segment-derived flight title/location are
  // external strings — neutralize them before they enter the model context.
  const safeBriefing = {
    weather: briefing.weather
      ? { ...briefing.weather, condition: cleanText(briefing.weather.condition) }
      : null,
    nextFlight: briefing.nextFlight
      ? {
          ...briefing.nextFlight,
          title: cleanText(briefing.nextFlight.title),
          location: cleanTextOrNull(briefing.nextFlight.location),
        }
      : null,
    tips: briefing.tips,
  }
  return JSON.stringify({ tripId, briefing: safeBriefing })
}

// ─── Saved routes (price tracking) ──────────────────────────────

const ROUTE_SELECT = {
  id: true, origin: true, destination: true, departureDate: true, returnDate: true,
  tripType: true, searchClass: true, alertThreshold: true, thresholdType: true,
  active: true, lastPrice: true, lastCheckedAt: true, createdAt: true,
} as const

export async function listSavedRoutes(userId: string): Promise<string> {
  const routes = await db.savedRoute.findMany({
    where: { userId }, select: ROUTE_SELECT, orderBy: { createdAt: "desc" }, take: MAX_SAVED_ROUTES,
  })
  return JSON.stringify({ count: routes.length, routes })
}

export async function createSavedRoute(userId: string, input: ToolInput): Promise<string> {
  const parsed = createRouteSchema.safeParse(input)
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const existing = await db.savedRoute.count({ where: { userId } })
  if (existing >= MAX_SAVED_ROUTES) {
    return fail(`Saved route limit reached (${MAX_SAVED_ROUTES}). Delete a route before adding more.`)
  }

  const route = await db.savedRoute.create({ data: { ...parsed.data, userId }, select: ROUTE_SELECT })
  return JSON.stringify({ created: true, route })
}

export async function deleteSavedRoute(userId: string, input: ToolInput): Promise<string> {
  const routeId = String(input.routeId ?? "")
  if (!routeId) return fail("routeId is required")
  const { count } = await db.savedRoute.deleteMany({ where: { id: routeId, userId } })
  if (count === 0) return fail("Route not found")
  return JSON.stringify({ deleted: true, routeId })
}

// ─── Points balances ────────────────────────────────────────────

export async function getPointsBalances(userId: string): Promise<string> {
  const balances = await loadPointsBalances(userId)
  return JSON.stringify({
    count: balances.length,
    balances: balances.map((b) => ({
      program: cleanText(b.program),
      balance: b.balance,
      display: cleanText(b.displayBalance),
    })),
  })
}

// ─── Traveler profile ───────────────────────────────────────────

function maskLast4(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.length <= 4) return "••••"
  return `••••${value.slice(-4)}`
}

function maskProfile(profile: TravelerProfile) {
  return {
    loyaltyPrograms: profile.loyaltyPrograms,
    knownTravelerNumber: maskLast4(profile.knownTravelerNumber),
    passportNumber: maskLast4(profile.passportNumber),
    passportExpiry: profile.passportExpiry,
    seatPreference: profile.seatPreference,
    cabinPreference: profile.cabinPreference,
    hasKnownTravelerNumber: Boolean(profile.knownTravelerNumber),
    hasPassportNumber: Boolean(profile.passportNumber),
  }
}

const profileSchema = z.object({
  loyaltyPrograms: z
    .array(z.object({ program: z.string().trim().max(200), number: z.string().trim().max(200) }))
    .max(50)
    .optional(),
  knownTravelerNumber: z.string().trim().max(200).optional(),
  passportNumber: z.string().trim().max(200).optional(),
  passportExpiry: isoDate.optional(),
  seatPreference: z.enum(SEAT_PREFERENCES).optional(),
  cabinPreference: z.enum(CABIN_PREFERENCES).optional(),
})

export async function getTravelerProfile(userId: string): Promise<string> {
  const profile = await loadTravelerProfile(userId)
  return JSON.stringify({ profile: maskProfile(profile) })
}

export async function updateTravelerProfile(userId: string, input: ToolInput): Promise<string> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return fail(firstIssue(parsed.error))
  // saveTravelerProfile merges on absent: a blank/omitted passport/KTN keeps the
  // stored secret instead of clearing it, so partial updates are safe.
  const saved = await saveTravelerProfile(userId, parsed.data)
  return JSON.stringify({ saved: true, profile: maskProfile(saved) })
}
