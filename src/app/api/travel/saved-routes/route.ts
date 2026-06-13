/**
 * Saved travel routes CRUD — tracks routes the user wants price alerts on.
 * Every query is scoped to the authenticated user (userId).
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { ISO_DATE_PATTERN, isRealIsoDate } from "@/lib/iso-date"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const ROUTE_SELECT = {
  id: true,
  origin: true,
  destination: true,
  departureDate: true,
  returnDate: true,
  tripType: true,
  searchClass: true,
  alertThreshold: true,
  thresholdType: true,
  active: true,
  lastPrice: true,
  lastCheckedAt: true,
  createdAt: true,
} as const

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("T3401", "Authentication required", 401)

  try {
    const routes = await db.savedRoute.findMany({
      where: { userId: user.id },
      select: ROUTE_SELECT,
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return NextResponse.json({ routes })
  } catch (err) {
    return apiError("T3402", "Failed to fetch saved routes", 500, err)
  }
}

// Airport code or city name: a Unicode letter first, then letters plus
// space/dot/apostrophe/slash/hyphen, 2-40 chars — accepts O'Hare, Zürich,
// São Paulo, Dallas/Fort Worth, St. Louis while still blocking markup/control.
const LOCATION_PATTERN = /^\p{L}[\p{L} .'’/-]{1,39}$/u
const MAX_SAVED_ROUTES = 100

const createSchema = z
  .object({
    origin: z
      .string()
      .trim()
      .min(1, "Origin is required")
      .regex(LOCATION_PATTERN, "Origin must be an airport code or city name"),
    destination: z
      .string()
      .trim()
      .min(1, "Destination is required")
      .regex(LOCATION_PATTERN, "Destination must be an airport code or city name"),
    departureDate: z
      .string()
      .regex(ISO_DATE_PATTERN, "Departure date must be YYYY-MM-DD")
      .refine(isRealIsoDate, "Departure date must be a real calendar date"),
    returnDate: z
      .string()
      .regex(ISO_DATE_PATTERN, "Return date must be YYYY-MM-DD")
      .refine(isRealIsoDate, "Return date must be a real calendar date")
      .optional(),
    tripType: z.enum(["one_way", "round_trip"]).default("one_way"),
    searchClass: z.enum(["ECON", "PREM_ECON", "BIZ", "FIRST", "both"]).default("ECON"),
    alertThreshold: z.number().positive().optional(),
    thresholdType: z.enum(["cash", "points"]).default("cash"),
  })
  .refine((d) => d.tripType !== "round_trip" || !!d.returnDate, {
    message: "Return date is required for round trips",
    path: ["returnDate"],
  })

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("T3410", "Authentication required", 401)

  let body: unknown
  try {
    body = await req.json()
  } catch (err) {
    return apiError("T3411", "Invalid JSON body", 400, err)
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("T3412", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  try {
    const existing = await db.savedRoute.count({ where: { userId: user.id } })
    if (existing >= MAX_SAVED_ROUTES) {
      return apiError(
        "T3414",
        `Saved route limit reached (${MAX_SAVED_ROUTES}). Delete a route before adding more.`,
        400
      )
    }

    const route = await db.savedRoute.create({
      data: { ...parsed.data, userId: user.id },
      select: ROUTE_SELECT,
    })

    return NextResponse.json({ route })
  } catch (err) {
    return apiError("T3413", "Failed to create saved route", 500, err)
  }
}

async function resolveDeleteId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get("id")
  if (fromQuery) return fromQuery

  try {
    const body = (await req.json()) as { id?: unknown }
    return typeof body.id === "string" ? body.id : null
  } catch {
    return null
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("T3420", "Authentication required", 401)

  const id = await resolveDeleteId(req)
  if (!id) return apiError("T3421", "Route id is required", 400)

  try {
    const { count } = await db.savedRoute.deleteMany({
      where: { id, userId: user.id },
    })
    if (count === 0) return apiError("T3423", "Route not found", 404)

    return NextResponse.json({ deleted: true })
  } catch (err) {
    return apiError("T3422", "Failed to delete saved route", 500, err)
  }
}
