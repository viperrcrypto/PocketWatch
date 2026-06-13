/**
 * Traveler / loyalty profile API.
 *
 * GET  — returns the profile for the authenticated owner. passportNumber and
 *        knownTravelerNumber are MASKED to last-4 in the response by default
 *        (a separate concern from SAVE, which round-trips full values).
 * PUT  — zod-validates the body, then encrypts + upserts the full values.
 *
 * Single-user vault: scoped to the current user via getCurrentUser().
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { ISO_DATE_PATTERN, isRealIsoDate } from "@/lib/iso-date"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import {
  loadTravelerProfile,
  saveTravelerProfile,
  SEAT_PREFERENCES,
  CABIN_PREFERENCES,
  type TravelerProfile,
} from "@/lib/travel/traveler-profile"

function maskLast4(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.length <= 4) return "••••"
  return `••••${value.slice(-4)}`
}

/** Replace sensitive identity numbers with last-4 masks for the GET response. */
function maskProfile(profile: TravelerProfile) {
  return {
    loyaltyPrograms: profile.loyaltyPrograms,
    knownTravelerNumber: maskLast4(profile.knownTravelerNumber),
    passportNumber: maskLast4(profile.passportNumber),
    passportExpiry: profile.passportExpiry,
    seatPreference: profile.seatPreference,
    cabinPreference: profile.cabinPreference,
    // Flags so the UI knows a value exists behind the mask without revealing it
    hasKnownTravelerNumber: Boolean(profile.knownTravelerNumber),
    hasPassportNumber: Boolean(profile.passportNumber),
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("TV601", "Authentication required", 401)

  try {
    const profile = await loadTravelerProfile(user.id)
    return NextResponse.json({ profile: maskProfile(profile) })
  } catch (error) {
    return apiError("TV602", "Failed to load traveler profile", 500, error)
  }
}

const loyaltySchema = z.object({
  program: z.string().trim().max(200),
  number: z.string().trim().max(200),
})

const profileSchema = z.object({
  loyaltyPrograms: z.array(loyaltySchema).max(50).default([]),
  knownTravelerNumber: z.string().trim().max(200).optional(),
  passportNumber: z.string().trim().max(200).optional(),
  passportExpiry: z
    .string()
    .regex(ISO_DATE_PATTERN, "Expiry must be ISO yyyy-mm-dd")
    .refine(isRealIsoDate, "Expiry must be a real calendar date")
    .optional(),
  seatPreference: z.enum(SEAT_PREFERENCES).optional(),
  cabinPreference: z.enum(CABIN_PREFERENCES).optional(),
})

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("TV610", "Authentication required", 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError("TV611", "Invalid JSON body", 400)
  }

  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("TV612", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  try {
    const saved = await saveTravelerProfile(user.id, parsed.data)
    return NextResponse.json({ saved: true, profile: maskProfile(saved) })
  } catch (error) {
    return apiError("TV613", "Failed to save traveler profile", 500, error)
  }
}
