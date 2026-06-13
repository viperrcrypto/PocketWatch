/**
 * iCalendar (RFC 5545) feed builder + per-user capability token for the trips
 * calendar subscription.
 *
 * Calendar apps (Apple/Google) subscribe over plain HTTP GET and cannot send the
 * session cookie, so the feed is guarded by a deterministic, unguessable
 * capability token. The HMAC key is an HKDF subkey of ENCRYPTION_KEY (domain
 * label "pocketwatch-ics-v1"), so the master key is never used directly and a
 * token leak never forces an ENCRYPTION_KEY rotation (which would break finance
 * DEKs). The user's calendarTokenVersion is folded into the HMAC message:
 * bumping that column rotates the token and invalidates old calendar URLs.
 * Verified with a timing-safe comparison.
 */

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto"

const TOKEN_PREFIX = "trip-ics:"
const HKDF_INFO = "pocketwatch-ics-v1"
const HKDF_KEY_BYTES = 32

interface TripSegmentLike {
  type: string
  title: string
  startAt: Date | null
  endAt: Date | null
  location: string | null
}

interface TripLike {
  id: string
  name: string
  destination: string | null
  startDate: string
  endDate: string | null
  notes: string | null
  segments: ReadonlyArray<TripSegmentLike>
}

/** HKDF-SHA256 subkey of ENCRYPTION_KEY, domain-separated from the AES/DEK use. */
function icsSigningKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) throw new Error("ENCRYPTION_KEY not configured")
  return Buffer.from(hkdfSync("sha256", secret, "", HKDF_INFO, HKDF_KEY_BYTES))
}

/** base64url(hmacSHA256(hkdf(ENCRYPTION_KEY), "trip-ics:" + userId + ":" + version)) */
export function tripIcsToken(userId: string, version: number): string {
  return createHmac("sha256", icsSigningKey())
    .update(`${TOKEN_PREFIX}${userId}:${version}`)
    .digest("base64url")
}

/** Timing-safe comparison of a presented token against this user's expected token. */
export function verifyTripIcsToken(
  userId: string,
  presented: string,
  version: number,
): boolean {
  if (!presented) return false
  const expected = tripIcsToken(userId, version)
  const a = Buffer.from(expected)
  const b = Buffer.from(presented)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ─── ICS encoding helpers ───────────────────────────────────────

/** Escape ICS TEXT values: backslash, semicolon, comma, and newlines. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
}

/** UTC timestamp form: 20260610T140000Z */
function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

/** All-day DATE form from an ISO yyyy-mm-dd string: 20260610 */
function formatDate(isoDate: string): string {
  return isoDate.replace(/-/g, "")
}

/** Add one calendar day to an ISO yyyy-mm-dd string (ICS DTEND is exclusive). */
function addDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function line(name: string, value: string): string {
  return `${name}:${value}`
}

function tripEvent(trip: TripLike, dtstamp: string): string[] {
  const summary = trip.destination
    ? `${trip.name} — ${trip.destination}`
    : trip.name
  const dtEnd = addDay(trip.endDate ?? trip.startDate)
  const lines = [
    "BEGIN:VEVENT",
    line("UID", `trip-${trip.id}@pocketwatch`),
    line("DTSTAMP", dtstamp),
    line("DTSTART;VALUE=DATE", formatDate(trip.startDate)),
    line("DTEND;VALUE=DATE", formatDate(dtEnd)),
    line("SUMMARY", escapeText(summary)),
  ]
  if (trip.destination) lines.push(line("LOCATION", escapeText(trip.destination)))
  if (trip.notes) lines.push(line("DESCRIPTION", escapeText(trip.notes)))
  lines.push("END:VEVENT")
  return lines
}

function segmentEvent(
  trip: TripLike,
  seg: TripSegmentLike,
  index: number,
  dtstamp: string,
): string[] | null {
  if (!seg.startAt) return null
  const end = seg.endAt ?? seg.startAt
  const lines = [
    "BEGIN:VEVENT",
    line("UID", `seg-${trip.id}-${index}@pocketwatch`),
    line("DTSTAMP", dtstamp),
    line("DTSTART", formatUtc(seg.startAt)),
    line("DTEND", formatUtc(end)),
    line("SUMMARY", escapeText(`${seg.title} (${seg.type})`)),
  ]
  if (seg.location) lines.push(line("LOCATION", escapeText(seg.location)))
  lines.push("END:VEVENT")
  return lines
}

/** Build a full VCALENDAR document with CRLF line endings. */
export function buildTripsIcs(trips: ReadonlyArray<TripLike>): string {
  const dtstamp = formatUtc(new Date())
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PocketWatch//Trips//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:PocketWatch Trips",
  ]

  for (const trip of trips) {
    lines.push(...tripEvent(trip, dtstamp))
    trip.segments.forEach((seg, i) => {
      const event = segmentEvent(trip, seg, i, dtstamp)
      if (event) lines.push(...event)
    })
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n") + "\r\n"
}
