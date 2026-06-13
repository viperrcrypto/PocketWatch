/**
 * Trips collection API — list and create trips.
 * Every query is scoped to the authenticated user (Trip.userId).
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { ISO_DATE_PATTERN, isRealIsoDate } from "@/lib/iso-date"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const TRIP_SELECT = {
  id: true,
  name: true,
  destination: true,
  startDate: true,
  endDate: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const

const createSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    destination: z.string().trim().max(120).optional(),
    startDate: z
      .string()
      .regex(ISO_DATE_PATTERN, "Start date must be YYYY-MM-DD")
      .refine(isRealIsoDate, "Start date must be a real calendar date"),
    endDate: z
      .string()
      .regex(ISO_DATE_PATTERN, "End date must be YYYY-MM-DD")
      .refine(isRealIsoDate, "End date must be a real calendar date")
      .optional(),
    status: z.enum(["upcoming", "active", "past"]).default("upcoming"),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  })

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("TP901", "Authentication required", 401)

  try {
    const trips = await db.trip.findMany({
      where: { userId: user.id },
      select: TRIP_SELECT,
      orderBy: { startDate: "desc" },
      take: 200,
    })

    return NextResponse.json({ trips })
  } catch (err) {
    return apiError("TP902", "Failed to fetch trips", 500, err)
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("TP910", "Authentication required", 401)

  let body: unknown
  try {
    body = await req.json()
  } catch (err) {
    return apiError("TP911", "Invalid JSON body", 400, err)
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("TP912", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  try {
    const trip = await db.trip.create({
      data: { ...parsed.data, userId: user.id },
      select: TRIP_SELECT,
    })

    return NextResponse.json({ trip })
  } catch (err) {
    return apiError("TP913", "Failed to create trip", 500, err)
  }
}
