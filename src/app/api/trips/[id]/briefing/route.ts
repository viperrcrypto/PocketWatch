/**
 * Travel-day briefing API — destination weather + next flight for one trip.
 * Scoped to the authenticated user (Trip.userId). Never throws to the client.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { buildTravelDayBriefing, type BriefingSegment } from "@/lib/travel/travel-day"
import { NextResponse, type NextRequest } from "next/server"

const BRIEFING_SELECT = {
  destination: true,
  startDate: true,
  segments: {
    select: {
      type: true,
      title: true,
      startAt: true,
      endAt: true,
      location: true,
    },
    orderBy: { startAt: "asc" },
    take: 200,
  },
} as const

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return apiError("TB701", "Authentication required", 401)

  const { id } = await params

  try {
    const trip = await db.trip.findFirst({
      where: { id, userId: user.id },
      select: BRIEFING_SELECT,
    })
    if (!trip) return apiError("TB702", "Trip not found", 404)

    const segments: BriefingSegment[] = trip.segments.map((s) => ({
      type: s.type,
      title: s.title,
      startAt: s.startAt ? s.startAt.toISOString() : null,
      endAt: s.endAt ? s.endAt.toISOString() : null,
      location: s.location,
    }))

    const briefing = await buildTravelDayBriefing({
      destination: trip.destination,
      startDate: trip.startDate,
      segments,
    })

    return NextResponse.json({ briefing })
  } catch (err) {
    return apiError("TB703", "Failed to build briefing", 500, err)
  }
}
