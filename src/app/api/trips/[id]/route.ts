/**
 * Single-trip API — fetch (with segments + tagged-spend summary), update, delete.
 * Every query is scoped to the authenticated user (Trip.userId).
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { tripSpendSummary, tripTaggedTransactions } from "@/lib/finance/trip-expenses"
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
  segments: {
    select: {
      id: true,
      type: true,
      title: true,
      startAt: true,
      endAt: true,
      location: true,
      details: true,
      createdAt: true,
    },
    orderBy: { startAt: "asc" },
    take: 200,
  },
} as const

const patchSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120).optional(),
    destination: z.string().trim().max(120).nullable().optional(),
    startDate: z
      .string()
      .regex(ISO_DATE_PATTERN, "Start date must be YYYY-MM-DD")
      .refine(isRealIsoDate, "Start date must be a real calendar date")
      .optional(),
    endDate: z
      .string()
      .regex(ISO_DATE_PATTERN, "End date must be YYYY-MM-DD")
      .refine(isRealIsoDate, "End date must be a real calendar date")
      .nullable()
      .optional(),
    status: z.enum(["upcoming", "active", "past"]).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" })

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return apiError("TP920", "Authentication required", 401)

  const { id } = await params

  try {
    const trip = await db.trip.findFirst({
      where: { id, userId: user.id },
      select: TRIP_SELECT,
    })
    if (!trip) return apiError("TP921", "Trip not found", 404)

    // Reuse the shared summary (outflows only, excludes excluded/duplicate/pending).
    const [spend, taggedTransactions] = await Promise.all([
      tripSpendSummary(user.id, id),
      tripTaggedTransactions(user.id, id),
    ])

    return NextResponse.json({ trip, spend, taggedTransactions })
  } catch (err) {
    return apiError("TP922", "Failed to fetch trip", 500, err)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return apiError("TP930", "Authentication required", 401)

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch (err) {
    return apiError("TP931", "Invalid JSON body", 400, err)
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("TP932", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  try {
    const { count } = await db.trip.updateMany({
      where: { id, userId: user.id },
      data: parsed.data,
    })
    if (count === 0) return apiError("TP933", "Trip not found", 404)

    const trip = await db.trip.findFirst({
      where: { id, userId: user.id },
      select: TRIP_SELECT,
    })

    return NextResponse.json({ trip })
  } catch (err) {
    return apiError("TP934", "Failed to update trip", 500, err)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return apiError("TP940", "Authentication required", 401)

  const { id } = await params

  try {
    const { count } = await db.trip.deleteMany({
      where: { id, userId: user.id },
    })
    if (count === 0) return apiError("TP941", "Trip not found", 404)

    return NextResponse.json({ deleted: true })
  } catch (err) {
    return apiError("TP942", "Failed to delete trip", 500, err)
  }
}
