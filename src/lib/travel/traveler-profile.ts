/**
 * Traveler / loyalty profile vault.
 *
 * Stores sensitive travel identity + preferences as a single AES-256-GCM
 * encrypted JSON blob in FinanceCredential.encryptedKey, using the
 * service "traveler_profile" (one row per user via the userId_service
 * unique constraint). Mirrors how the OAuth flow stored a JSON blob.
 *
 * No new DB migration — reuses the existing FinanceCredential model.
 */

import { db } from "@/lib/db"
import { encryptCredential, decryptCredential } from "@/lib/finance/crypto"
import { isRealIsoDate } from "@/lib/iso-date"

export const TRAVELER_PROFILE_SERVICE = "traveler_profile"

export const SEAT_PREFERENCES = ["window", "aisle", "no_preference"] as const
export const CABIN_PREFERENCES = ["ECON", "PREM_ECON", "BIZ", "FIRST"] as const

export type SeatPreference = (typeof SEAT_PREFERENCES)[number]
export type CabinPreference = (typeof CABIN_PREFERENCES)[number]

export interface LoyaltyProgram {
  program: string
  number: string
}

export interface TravelerProfile {
  loyaltyPrograms: LoyaltyProgram[]
  knownTravelerNumber?: string
  passportNumber?: string
  passportExpiry?: string
  seatPreference?: SeatPreference
  cabinPreference?: CabinPreference
}

const MAX_LOYALTY_PROGRAMS = 50
const MAX_FIELD_LENGTH = 200

function emptyProfile(): TravelerProfile {
  return { loyaltyPrograms: [] }
}

function clampString(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, MAX_FIELD_LENGTH)
}

function optionalString(value: unknown): string | undefined {
  const clamped = clampString(value)
  return clamped.length > 0 ? clamped : undefined
}

function sanitizeLoyalty(raw: unknown): LoyaltyProgram[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      const record = (entry ?? {}) as Record<string, unknown>
      return { program: clampString(record.program), number: clampString(record.number) }
    })
    .filter((entry) => entry.program.length > 0 || entry.number.length > 0)
    .slice(0, MAX_LOYALTY_PROGRAMS)
}

function sanitizeSeat(value: unknown): SeatPreference | undefined {
  return SEAT_PREFERENCES.includes(value as SeatPreference) ? (value as SeatPreference) : undefined
}

function sanitizeCabin(value: unknown): CabinPreference | undefined {
  return CABIN_PREFERENCES.includes(value as CabinPreference) ? (value as CabinPreference) : undefined
}

function sanitizeExpiry(value: unknown): string | undefined {
  const clamped = optionalString(value)
  // Round-trip check rejects impossible calendar dates ("2026-02-31").
  return clamped && isRealIsoDate(clamped) ? clamped : undefined
}

/**
 * Validate + clamp an untrusted profile into a stored shape. Pure: never
 * mutates the input; returns a fresh, fully-normalized object.
 */
export function normalizeTravelerProfile(raw: unknown): TravelerProfile {
  const record = (raw ?? {}) as Record<string, unknown>
  const normalized: TravelerProfile = {
    loyaltyPrograms: sanitizeLoyalty(record.loyaltyPrograms),
  }

  const ktn = optionalString(record.knownTravelerNumber)
  if (ktn) normalized.knownTravelerNumber = ktn

  const passport = optionalString(record.passportNumber)
  if (passport) normalized.passportNumber = passport

  const expiry = sanitizeExpiry(record.passportExpiry)
  if (expiry) normalized.passportExpiry = expiry

  const seat = sanitizeSeat(record.seatPreference)
  if (seat) normalized.seatPreference = seat

  const cabin = sanitizeCabin(record.cabinPreference)
  if (cabin) normalized.cabinPreference = cabin

  return normalized
}

/**
 * Load + decrypt the traveler profile for a user. Returns a sane empty
 * default when no row exists or the stored blob can't be parsed.
 */
export async function loadTravelerProfile(userId: string): Promise<TravelerProfile> {
  const row = await db.financeCredential.findUnique({
    where: { userId_service: { userId, service: TRAVELER_PROFILE_SERVICE } },
    select: { encryptedKey: true },
  })
  if (!row) return emptyProfile()

  try {
    const decrypted = await decryptCredential(row.encryptedKey)
    return normalizeTravelerProfile(JSON.parse(decrypted))
  } catch {
    return emptyProfile()
  }
}

/**
 * Validate/clamp, encrypt, and upsert the traveler profile. Returns the
 * normalized profile that was persisted.
 */
export async function saveTravelerProfile(
  userId: string,
  profile: unknown
): Promise<TravelerProfile> {
  const incoming = normalizeTravelerProfile(profile)
  const existing = await loadTravelerProfile(userId)

  // Write-only secrets (passport #, KTN): a blank/omitted field means "keep the
  // stored value", NOT "clear it" — otherwise saving an unrelated edit (a loyalty
  // program, a seat preference) would wipe the passport. The UI sends these keys
  // only when the user types a new value. Also reject the GET mask sentinel
  // (•••• U+2022): echoing the masked value back must NOT overwrite the real one.
  const isMaskOrBlank = (v: string | undefined): boolean =>
    !v || !v.trim() || v.includes("•")
  const merged: TravelerProfile = {
    ...incoming,
    knownTravelerNumber: isMaskOrBlank(incoming.knownTravelerNumber)
      ? existing.knownTravelerNumber
      : incoming.knownTravelerNumber,
    passportNumber: isMaskOrBlank(incoming.passportNumber)
      ? existing.passportNumber
      : incoming.passportNumber,
  }

  const encryptedKey = await encryptCredential(JSON.stringify(merged))

  await db.financeCredential.upsert({
    where: { userId_service: { userId, service: TRAVELER_PROFILE_SERVICE } },
    create: {
      userId,
      service: TRAVELER_PROFILE_SERVICE,
      encryptedKey,
      encryptedSecret: encryptedKey, // Unused for travel, but required by schema
      environment: "production",
    },
    update: { encryptedKey, encryptedSecret: encryptedKey },
  })

  return merged
}
