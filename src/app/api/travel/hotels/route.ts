/**
 * Hotel search API route.
 * GET /api/travel/hotels?q=Miami&checkIn=2026-05-01&checkOut=2026-05-03&adults=2
 * Searches SerpAPI (cash), Roame (points), and ATF (brand info) in parallel.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { searchHotels } from "@/lib/travel/hotel-orchestrator"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("H1001", "Authentication required", 401)

  const url = new URL(req.url)
  const query = url.searchParams.get("q")
  const checkIn = url.searchParams.get("checkIn")
  const checkOut = url.searchParams.get("checkOut")
  const adults = parseInt(url.searchParams.get("adults") || "2", 10)

  if (!query || !checkIn || !checkOut) {
    return apiError("H1002", "Missing required params: q, checkIn, checkOut", 400)
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    return apiError("H1003", "Dates must be YYYY-MM-DD format", 400)
  }

  try {
    // Load credentials in parallel
    const [serpCred, atfCred] = await Promise.all([
      db.financeCredential.findUnique({
        where: { userId_service: { userId: user.id, service: "serpapi" } },
      }),
      db.financeCredential.findUnique({
        where: { userId_service: { userId: user.id, service: "atf" } },
      }),
    ])

    const [serpApiKey, atfApiKey] = await Promise.all([
      serpCred ? decryptCredential(serpCred.encryptedKey) : null,
      atfCred ? decryptCredential(atfCred.encryptedKey) : null,
    ])

    if (!serpApiKey && !atfApiKey) {
      return apiError("H1004", "At least one hotel search credential required (SerpAPI or ATF).", 400)
    }

    const result = await searchHotels(
      { query, checkInDate: checkIn, checkOutDate: checkOut, adults },
      { serpApiKey, atfApiKey, trivago: true },
    )

    return NextResponse.json(result)
  } catch (err) {
    return apiError("H1005", `Hotel search failed: ${(err as Error).message}`, 500)
  }
}
