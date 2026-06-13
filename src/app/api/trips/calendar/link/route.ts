/**
 * GET /api/trips/calendar/link
 *
 * Session-authed: returns the per-user iCalendar subscribe URL (with the
 * capability token) so the UI can show/copy it. The token itself is derived from
 * the user's calendarTokenVersion — incrementing that column rotates the link.
 */

import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { tripIcsToken } from "@/lib/travel/trip-ics"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("T6101", "Authentication required", 401)

  try {
    const row = await db.user.findUnique({
      where: { id: user.id },
      select: { calendarTokenVersion: true },
    })
    const token = tripIcsToken(user.id, row?.calendarTokenVersion ?? 1)

    const host = req.nextUrl.host
    const path = `/api/trips/calendar?token=${token}`
    return NextResponse.json({
      // webcal:// makes Apple/Google Calendar offer to subscribe in one click.
      webcalUrl: `webcal://${host}${path}`,
      httpsUrl: `${req.nextUrl.origin}${path}`,
    })
  } catch (err) {
    return apiError("T6102", "Failed to build calendar link", 500, err)
  }
}
