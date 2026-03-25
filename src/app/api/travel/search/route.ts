/**
 * Flight search API route with SSE streaming.
 * GET /api/travel/search?origin=LAX&destination=LHR&date=2026-05-01&class=PREM
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential, encryptCredential } from "@/lib/finance/crypto"
import { runSearch, type SearchProgress } from "@/lib/travel/search-orchestrator"
import { cardProfilesToBalances } from "@/lib/travel/balance-adapter"
import { isSessionExpired, refreshFirebaseToken, buildRoameSession } from "@/lib/travel/roame-auth"
import { isPointMeTokenExpired, refreshPointMeToken } from "@/lib/travel/pointme-auth"
import type { SearchConfig, RoameCredentials } from "@/types/travel"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("T1001", "Authentication required", 401)

  const url = new URL(req.url)
  const originRaw = url.searchParams.get("origin")
  const destRaw = url.searchParams.get("destination")
  const date = url.searchParams.get("date")
  const searchClass = (url.searchParams.get("class") || "PREM") as SearchConfig["searchClass"]
  const tripType = (url.searchParams.get("tripType") || "one_way") as SearchConfig["tripType"]
  const returnDate = url.searchParams.get("returnDate") || undefined
  const flexDates = url.searchParams.get("flexDates") === "true"

  if (!originRaw || !destRaw || !date) {
    return apiError("T1002", "Missing required params: origin, destination, date", 400)
  }

  // Parse comma-separated airport codes (e.g. "MIA,FLL")
  const originsList = originRaw.split(",").map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{3}$/.test(s))
  const destsList = destRaw.split(",").map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{3}$/.test(s))

  if (originsList.length === 0 || destsList.length === 0) {
    return apiError("T1003", "Origin and destination must be valid 3-letter IATA codes", 400)
  }

  const origin = originsList[0]!
  const destination = destsList[0]!

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError("T1004", "Date must be YYYY-MM-DD format", 400)
  }

  if (tripType === "round_trip" && (!returnDate || !/^\d{4}-\d{2}-\d{2}$/.test(returnDate))) {
    return apiError("T1006", "Round-trip requires a valid return date (YYYY-MM-DD)", 400)
  }

  // Load credentials
  const creds = await db.financeCredential.findMany({
    where: { userId: user.id, service: { in: ["roame", "serpapi", "atf", "roame_refresh", "pointme", "pointme_refresh"] } },
  })

  let roameSession: RoameCredentials | undefined
  let serpApiKey: string | undefined
  let atfApiKey: string | undefined
  let refreshToken: string | undefined
  let pointmeToken: string | undefined
  let pointmeRefreshToken: string | undefined

  for (const cred of creds) {
    if (cred.service === "pointme") {
      pointmeToken = await decryptCredential(cred.encryptedKey)
    } else if (cred.service === "pointme_refresh") {
      pointmeRefreshToken = await decryptCredential(cred.encryptedKey)
    } else if (cred.service === "roame") {
      const decrypted = await decryptCredential(cred.encryptedKey)
      const parsed = JSON.parse(decrypted) as RoameCredentials
      if (isSessionExpired(parsed.session)) {
        console.warn("[travel] Roame session expired")
      } else {
        roameSession = parsed
      }
    } else if (cred.service === "serpapi") {
      serpApiKey = await decryptCredential(cred.encryptedKey)
    } else if (cred.service === "atf") {
      atfApiKey = await decryptCredential(cred.encryptedKey)
    } else if (cred.service === "roame_refresh") {
      refreshToken = await decryptCredential(cred.encryptedKey)
    }
  }

  // Auto-refresh Roame session if expired but refresh token available
  if (!roameSession && refreshToken) {
    try {
      const result = await refreshFirebaseToken(refreshToken)
      roameSession = buildRoameSession(result.idToken)

      // Persist new session + updated refresh token
      const newSessionEnc = await encryptCredential(JSON.stringify(roameSession))
      const newRefreshEnc = await encryptCredential(result.refreshToken)
      await Promise.all([
        db.financeCredential.upsert({
          where: { userId_service: { userId: user.id, service: "roame" } },
          create: { userId: user.id, service: "roame", encryptedKey: newSessionEnc, encryptedSecret: newSessionEnc, environment: "production" },
          update: { encryptedKey: newSessionEnc, encryptedSecret: newSessionEnc },
        }),
        db.financeCredential.upsert({
          where: { userId_service: { userId: user.id, service: "roame_refresh" } },
          create: { userId: user.id, service: "roame_refresh", encryptedKey: newRefreshEnc, encryptedSecret: newRefreshEnc, environment: "production" },
          update: { encryptedKey: newRefreshEnc, encryptedSecret: newRefreshEnc },
        }),
      ])
      console.log("[travel] Roame session auto-refreshed via Firebase")
    } catch (err) {
      console.warn("[travel] Roame auto-refresh failed:", (err as Error).message)
    }
  }

  // Auto-refresh point.me token if expired but refresh token available
  if (pointmeRefreshToken && (!pointmeToken || isPointMeTokenExpired(pointmeToken))) {
    try {
      const result = await refreshPointMeToken(pointmeRefreshToken)
      pointmeToken = result.accessToken

      // Persist new token + possibly rotated refresh token
      const newTokenEnc = await encryptCredential(result.accessToken)
      const newRefreshEnc = await encryptCredential(result.refreshToken)
      await Promise.all([
        db.financeCredential.upsert({
          where: { userId_service: { userId: user.id, service: "pointme" } },
          create: { userId: user.id, service: "pointme", encryptedKey: newTokenEnc, encryptedSecret: newTokenEnc, environment: "production" },
          update: { encryptedKey: newTokenEnc, encryptedSecret: newTokenEnc },
        }),
        db.financeCredential.upsert({
          where: { userId_service: { userId: user.id, service: "pointme_refresh" } },
          create: { userId: user.id, service: "pointme_refresh", encryptedKey: newRefreshEnc, encryptedSecret: newRefreshEnc, environment: "production" },
          update: { encryptedKey: newRefreshEnc, encryptedSecret: newRefreshEnc },
        }),
      ])
      console.log("[travel] point.me token auto-refreshed via Auth0")
    } catch (err) {
      console.warn("[travel] point.me auto-refresh failed:", (err as Error).message)
      pointmeToken = undefined
    }
  }

  console.log(`[travel] Credentials: roame=${!!roameSession} serpapi=${!!serpApiKey} atf=${!!atfApiKey} pointme=${!!pointmeToken} refreshToken=${!!refreshToken} (found ${creds.length} credential rows: ${creds.map(c => c.service).join(", ") || "none"})`)

  if (!roameSession && !serpApiKey && !atfApiKey && !pointmeToken) {
    return apiError("T1005", "No search credentials configured. Add Roame session, SerpAPI key, or ATF key in Travel Settings.", 400)
  }

  // Load balances from credit card profiles
  const cards = await db.creditCardProfile.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      cardName: true,
      rewardType: true,
      rewardProgram: true,
      pointsBalance: true,
      cashbackBalance: true,
    },
  })
  const balances = cardProfilesToBalances(cards)

  const config: SearchConfig = {
    origin, destination, departureDate: date, searchClass, tripType, returnDate,
    flexDates: flexDates || undefined,
    origins: originsList.length > 1 ? originsList : undefined,
    destinations: destsList.length > 1 ? destsList : undefined,
  }

  // SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const onProgress = (progress: SearchProgress) => {
        send("progress", progress)
      }

      try {
        const results = await runSearch(config, { roameSession, serpApiKey, atfApiKey, pointmeToken }, balances, onProgress)
        send("result", results)
        // Persist to DB so chat tools can access all flights (after sending to client)
        await db.flightSearchResult.upsert({
          where: { userId: user.id },
          create: { userId: user.id, results: results as object, searchedAt: new Date() },
          update: { results: results as object, searchedAt: new Date() },
        }).catch((err) => console.warn("[travel] Failed to persist flight results:", err))
      } catch (err) {
        send("error", { error: (err as Error).message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
