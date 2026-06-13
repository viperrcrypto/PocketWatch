/**
 * Trips iCalendar feed (text/calendar) for Apple/Google Calendar subscription.
 *
 * Calendar apps cannot send the session cookie, so this route is guarded by a
 * per-user capability token in the query string (?token=). The token is an HMAC
 * over the user id + calendarTokenVersion, keyed by an HKDF subkey of
 * ENCRYPTION_KEY (see @/lib/travel/trip-ics). Rotating the link is just
 * incrementing User.calendarTokenVersion (future "rotate calendar link" button —
 * not implemented here). We resolve the single-vault user, recompute the
 * expected token, and compare timing-safely; any mismatch is a 401.
 *
 * Subscribe URL shape:
 *   webcal://<host>/api/trips/calendar?token=<tripIcsToken(userId, version)>
 *   (https:// works too; webcal:// makes Apple/Google auto-subscribe.)
 */

import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { buildTripsIcs, verifyTripIcsToken } from "@/lib/travel/trip-ics"
import { type NextRequest } from "next/server"

const MAX_TRIPS = 500
const MAX_SEGMENTS = 100

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token")
  if (!token) return apiError("T6001", "Missing calendar token", 401)

  try {
    // Single-user vault: resolve the owner, then verify the capability token.
    // (Inside try so a missing ENCRYPTION_KEY / DB error returns a clean apiError.)
    const user = await db.user.findFirst({
      select: { id: true, calendarTokenVersion: true },
    })
    if (!user || !verifyTripIcsToken(user.id, token, user.calendarTokenVersion ?? 1)) {
      return apiError("T6002", "Invalid calendar token", 401)
    }

    const trips = await db.trip.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        destination: true,
        startDate: true,
        endDate: true,
        notes: true,
        segments: {
          select: {
            type: true,
            title: true,
            startAt: true,
            endAt: true,
            location: true,
          },
          orderBy: { startAt: "asc" },
          take: MAX_SEGMENTS,
        },
      },
      orderBy: { startDate: "desc" },
      take: MAX_TRIPS,
    })

    const ics = buildTripsIcs(trips)

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="pocketwatch-trips.ics"',
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (err) {
    return apiError("T6003", "Failed to build calendar feed", 500, err)
  }
}
