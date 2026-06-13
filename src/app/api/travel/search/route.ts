/**
 * Flight search API route with SSE streaming.
 * GET /api/travel/search?origin=LAX&destination=LHR&date=2026-05-01&class=PREM
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { runSearch, type SearchProgress } from "@/lib/travel/search-orchestrator"
import { loadSearchCredentials, loadPointsBalances } from "@/lib/travel/search-credentials"
import type { SearchConfig } from "@/types/travel"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("T1001", "Authentication required", 401)

  const url = new URL(req.url)
  const originRaw = url.searchParams.get("origin")
  const destRaw = url.searchParams.get("destination")
  const date = url.searchParams.get("date")
  const searchClass = (url.searchParams.get("class") || "BIZ") as SearchConfig["searchClass"]
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

  // Resolve credentials (with auto-refresh) + balances via the shared loader.
  // No paid-credential guard: the keyless Kiwi + Skiplagged providers always run
  // (plus ATF via OAuth when connected), so a search always has at least the free
  // cash sources to query.
  const { roameSession, serpApiKey, pointmeToken } = await loadSearchCredentials(user.id)
  const balances = await loadPointsBalances(user.id)

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
        const results = await runSearch(config, { roameSession, serpApiKey, atfUserId: user.id, pointmeToken, skiplagged: true, kiwi: true }, balances, onProgress)
        send("result", results)
        // Persist to DB so chat tools can access all flights (after sending to client)
        const resultsJson = JSON.parse(JSON.stringify(results))
        await db.flightSearchResult.upsert({
          where: { userId: user.id },
          create: { userId: user.id, results: resultsJson, searchedAt: new Date() },
          update: { results: resultsJson, searchedAt: new Date() },
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
