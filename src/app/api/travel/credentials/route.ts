/**
 * Travel credentials CRUD — stores Roame session and SerpAPI key.
 * Reuses FinanceCredential model with services: "roame", "serpapi".
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { encryptCredential, decryptCredential } from "@/lib/finance/crypto"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import { parsePointMeCredential } from "@/lib/travel/pointme-auth"
import { parseRoameCredential, extractRefreshToken } from "@/lib/travel/roame-auth"

function maskKey(key: string): string {
  if (key.length <= 8) return "****"
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("T2001", "Authentication required", 401)

  try {
    const credentials = await db.financeCredential.findMany({
      where: { userId: user.id, service: { in: ["roame", "serpapi", "atf", "roame_refresh", "pointme", "atf_oauth"] } },
    })

    const services = await Promise.all(
      credentials.map(async (cred) => {
        const sessionConfigured = cred.service === "roame" || cred.service === "pointme" || cred.service === "atf_oauth"
        const key = sessionConfigured ? "session-configured" : await decryptCredential(cred.encryptedKey)
        const displayKey = key
        return {
          service: cred.service,
          maskedKey: maskKey(displayKey),
          updatedAt: cred.updatedAt.toISOString(),
        }
      })
    )

    return NextResponse.json({ services })
  } catch (err) {
    return apiError("T2002", "Failed to fetch credentials", 500, err)
  }
}

const saveSchema = z.object({
  service: z.enum(["roame", "serpapi", "atf", "roame_refresh", "pointme"]),
  key: z.string().min(1, "Key is required"),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("T2010", "Authentication required", 401)

  const body = await req.json()
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("T2011", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  // Parse session blobs first (point.me / Roame) outside the persistence try so a
  // bad paste returns a clean 400 and infra failures below stay a 500. Each may
  // yield a refresh token to store alongside the session after the main upsert.
  let refreshService: string | null = null
  let refreshTokenToStore: string | null = null

  if (parsed.data.service === "pointme") {
    // point.me: raw JWT or full session JSON → access token + optional refresh.
    try {
      const { accessToken, refreshToken } = parsePointMeCredential(parsed.data.key)
      parsed.data.key = accessToken
      if (refreshToken) {
        refreshService = "pointme_refresh"
        refreshTokenToStore = refreshToken
      }
    } catch (err) {
      return apiError("T2014", (err as Error).message, 400)
    }
  } else if (parsed.data.service === "roame") {
    // Roame: raw ID token, the full firebase:authUser IndexedDB value (ID token +
    // refresh token), or { session } JSON. Session → "roame"; refresh → "roame_refresh".
    try {
      const { session, refreshToken } = parseRoameCredential(parsed.data.key)
      parsed.data.key = JSON.stringify({ session })
      if (refreshToken) {
        refreshService = "roame_refresh"
        refreshTokenToStore = refreshToken
      }
    } catch (err) {
      return apiError("T2012", (err as Error).message, 400)
    }
  } else if (parsed.data.service === "roame_refresh") {
    // The dedicated refresh-token field: accept the bare token, the full
    // firebase:authUser value, or a DevTools dump — store just the refresh token.
    try {
      parsed.data.key = extractRefreshToken(parsed.data.key)
    } catch (err) {
      return apiError("T2015", (err as Error).message, 400)
    }
  }

  try {
    const encryptedKey = await encryptCredential(parsed.data.key)

    await db.financeCredential.upsert({
      where: {
        userId_service: { userId: user.id, service: parsed.data.service },
      },
      create: {
        userId: user.id,
        service: parsed.data.service,
        encryptedKey,
        encryptedSecret: encryptedKey, // Not used for travel, but required by schema
        environment: "production",
      },
      update: {
        encryptedKey,
        encryptedSecret: encryptedKey,
      },
    })

    // Store the refresh token only after the session itself persisted, so a
    // failure can't leave an orphan refresh token with no session.
    if (refreshService && refreshTokenToStore) {
      const refreshEnc = await encryptCredential(refreshTokenToStore)
      await db.financeCredential.upsert({
        where: { userId_service: { userId: user.id, service: refreshService } },
        create: { userId: user.id, service: refreshService, encryptedKey: refreshEnc, encryptedSecret: refreshEnc, environment: "production" },
        update: { encryptedKey: refreshEnc, encryptedSecret: refreshEnc },
      })
    }

    return NextResponse.json({ saved: true, service: parsed.data.service })
  } catch (err) {
    return apiError("T2013", "Failed to save credential", 500, err)
  }
}

const deleteSchema = z.object({
  service: z.enum(["roame", "serpapi", "atf", "roame_refresh", "pointme", "atf_oauth"]),
})

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("T2020", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const service = searchParams.get("service")
  const parsed = deleteSchema.safeParse({ service })
  if (!parsed.success) {
    return apiError("T2021", "Invalid service", 400)
  }

  try {
    const servicesToDelete = parsed.data.service === "pointme"
      ? ["pointme", "pointme_refresh"]
      : parsed.data.service === "roame"
        ? ["roame", "roame_refresh"]
        : parsed.data.service === "atf_oauth"
          ? ["atf_oauth", "atf_oauth_client"]
          : [parsed.data.service]

    await db.financeCredential.deleteMany({
      where: { userId: user.id, service: { in: servicesToDelete } },
    })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    return apiError("T2022", "Failed to delete credential", 500, err)
  }
}
