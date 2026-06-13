/**
 * Desktop status — lightweight net worth + unread alerts for the Mac menu-bar app.
 *
 * GET /api/internal/desktop-status
 *
 * The Tauri tray polls this WITHOUT a session cookie, so it is Bearer-secret
 * authed (POCKETWATCH_DESKTOP_SECRET) like the cron workers. Returns a snapshot-
 * based net-worth approximation (latest finance + portfolio + exchange snapshots)
 * — fast enough to poll every 60s, no live provider recompute.
 */

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

const SECRET = process.env.POCKETWATCH_DESKTOP_SECRET ?? ""

function isAuthorized(request: NextRequest): boolean {
  if (!SECRET || SECRET.length < 32) return false
  const header = request.headers.get("authorization") ?? ""
  if (!header.startsWith("Bearer ")) return false
  const provided = Buffer.from(header.slice(7))
  const expected = Buffer.from(SECRET)
  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const owner = await db.user.findFirst({ select: { id: true } })
    if (!owner) return NextResponse.json({ netWorth: null, unreadCount: 0, recent: [] })

    const [finSnap, portSnap, exchSnap, unread] = await Promise.all([
      db.financeSnapshot.findFirst({
        where: { userId: owner.id },
        orderBy: { date: "desc" },
        select: { netWorth: true },
      }),
      db.portfolioSnapshot.findFirst({
        where: { userId: owner.id, source: "live_refresh" },
        orderBy: { createdAt: "desc" },
        select: { totalValue: true },
      }),
      db.exchangeBalanceSnapshot.findFirst({
        where: { userId: owner.id },
        orderBy: { createdAt: "desc" },
        select: { totalValue: true },
      }),
      db.notification.findMany({
        where: { userId: owner.id, readAt: null },
        orderBy: { sentAt: "desc" },
        take: 5,
        select: { title: true, body: true, category: true, sentAt: true },
      }),
    ])

    const netWorth =
      (finSnap?.netWorth ?? 0) + (portSnap?.totalValue ?? 0) + (exchSnap?.totalValue ?? 0)

    return NextResponse.json({
      netWorth,
      currency: "USD",
      unreadCount: unread.length,
      recent: unread,
    })
  } catch (error) {
    console.error("[desktop-status] failed:", error)
    return NextResponse.json({ error: "Status unavailable" }, { status: 500 })
  }
}
