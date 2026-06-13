/**
 * Travel Price-Check Worker — scans active tracked routes for cash price drops.
 *
 * POST /api/internal/travel/price-check-worker
 *
 * For each active SavedRoute, fetches cash prices from the KEYLESS providers
 * only (Kiwi + Skiplagged — no credential decryption), records the lowest as a
 * PriceSnapshot, updates the route's lastPrice/lastCheckedAt, and dispatches a
 * price alert when the new low passes the user's threshold or beats lastPrice.
 *
 * Protected by TRAVEL_PRICE_CHECK_SECRET env var. Trigger via system cron.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkAuthFailureLimit, isAuthorizedBearer } from "@/lib/internal-auth"
import { searchKiwiFlights } from "@/lib/travel/kiwi-client"
import { searchSkiplaggedFlights } from "@/lib/travel/skiplagged-client"
import { sendWithPreferences } from "@/lib/notifications/dispatcher"
import type { UnifiedFlightResult } from "@/types/travel"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const WORKER_SECRET = process.env.TRAVEL_PRICE_CHECK_SECRET ?? ""

interface ActiveRoute {
  id: string
  userId: string
  origin: string
  destination: string
  departureDate: string
  searchClass: "ECON" | "PREM_ECON" | "BIZ" | "FIRST" | "both"
  alertThreshold: number | null
  thresholdType: string
  lastPrice: number | null
}

interface LowestPrice {
  cashPrice: number
  source: string
}

/** Pick the lowest non-null cashPrice across all results, keeping its source. */
function lowestCashPrice(results: UnifiedFlightResult[]): LowestPrice | null {
  let best: LowestPrice | null = null
  for (const r of results) {
    if (r.cashPrice === null) continue
    if (best === null || r.cashPrice < best.cashPrice) {
      // Kiwi maps onto the "google" source union member but tags itself "kiwi".
      const source = r.tags?.includes("kiwi") ? "kiwi" : r.source
      best = { cashPrice: r.cashPrice, source }
    }
  }
  return best
}

/** Fetch cash flights from the keyless providers; a failing provider yields []. */
async function fetchKeylessPrices(route: ActiveRoute): Promise<UnifiedFlightResult[]> {
  const config = {
    origin: route.origin,
    destination: route.destination,
    departureDate: route.departureDate,
    searchClass: route.searchClass,
  }

  const settled = await Promise.allSettled([
    searchKiwiFlights(config),
    searchSkiplaggedFlights(config),
  ])

  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
}

/**
 * Alert only on a downward threshold CROSSING (cash routes), or a meaningful
 * (>=1%) undercut of the last observed price. Never fires just because the price
 * is sitting low — that would spam an identical alert on every cron tick. A
 * points threshold can't be evaluated here (this worker only fetches cash).
 */
function shouldAlert(route: ActiveRoute, newLow: number): boolean {
  if (
    route.thresholdType === "cash" &&
    route.alertThreshold !== null &&
    newLow <= route.alertThreshold &&
    (route.lastPrice === null || route.lastPrice > route.alertThreshold)
  ) {
    return true
  }
  if (route.lastPrice !== null && newLow < route.lastPrice * 0.99) return true
  return false
}

async function dispatchAlert(route: ActiveRoute, newLow: number): Promise<void> {
  const display = Math.round(newLow)
  const title = `${route.origin} to ${route.destination} dropped to $${display}`
  const body = `Cash fare for ${route.origin} to ${route.destination} on ${route.departureDate} is now $${display}.`
  await sendWithPreferences(route.userId, {
    title,
    body,
    url: "/travel",
    category: "travel",
    alertType: "price_alert",
    severity: "watch",
    metadata: {
      routeId: route.id,
      oldPrice: route.lastPrice,
      newPrice: newLow,
      origin: route.origin,
      destination: route.destination,
    },
  })
}

/** Process one route: snapshot, update, alert. Returns whether an alert fired. */
async function processRoute(route: ActiveRoute): Promise<boolean> {
  const results = await fetchKeylessPrices(route)
  const low = lowestCashPrice(results)
  if (low === null) return false

  await db.priceSnapshot.create({
    data: { savedRouteId: route.id, source: low.source, cashPrice: low.cashPrice },
  })

  // Dispatch BEFORE advancing lastPrice, so a dispatch failure leaves the drop
  // visible to the next run instead of silently swallowing the alert.
  const alert = shouldAlert(route, low.cashPrice)
  if (alert) await dispatchAlert(route, low.cashPrice)

  await db.savedRoute.update({
    where: { id: route.id },
    data: { lastPrice: low.cashPrice, lastCheckedAt: new Date() },
  })

  return alert
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedBearer(request, WORKER_SECRET)) {
    // Failure-only throttle: successful auth never touches the limiter.
    const rl = checkAuthFailureLimit(request)
    if (!rl.ok) return NextResponse.json(rl.response, { status: 429, headers: rl.headers })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Bounded + oldest-checked-first so the work rotates across runs and a large
    // route set can never exhaust maxDuration with the same tail starved.
    const todayIso = new Date().toISOString().slice(0, 10)
    const routes = await db.savedRoute.findMany({
      where: { active: true, departureDate: { gte: todayIso } },
      orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
      take: 25,
      select: {
        id: true,
        userId: true,
        origin: true,
        destination: true,
        departureDate: true,
        searchClass: true,
        alertThreshold: true,
        thresholdType: true,
        lastPrice: true,
      },
    })

    let checked = 0
    let alerted = 0
    let errors = 0

    for (const route of routes) {
      try {
        checked += 1
        const didAlert = await processRoute(route as ActiveRoute)
        if (didAlert) alerted += 1
      } catch (error) {
        errors += 1
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[travel-price-check] Failed for route ${route.id}:`, message)
      }
    }

    console.log(`[travel-price-check] checked=${checked} alerted=${alerted} errors=${errors}`)
    return NextResponse.json({ checked, alerted, errors })
  } catch (error) {
    console.error("[travel-price-check] worker failed:", error)
    return NextResponse.json({ error: "Price check worker failed" }, { status: 500 })
  }
}
