/**
 * Finance Digest Worker — sends the daily "Hello Money" money summary.
 *
 * POST /api/internal/finance-digest-worker
 *
 * For each vault owner, builds the daily digest and dispatches it through the
 * user's configured notification channels (respecting preferences/quiet hours).
 * Skips users with nothing noteworthy to report.
 *
 * Protected by FINANCE_DIGEST_SECRET env var. Trigger via system cron or curl.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { buildDailyDigest } from "@/lib/finance/daily-digest"
import { checkAuthFailureLimit, isAuthorizedBearer } from "@/lib/internal-auth"
import { sendWithPreferences } from "@/lib/notifications/dispatcher"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const WORKER_SECRET = process.env.FINANCE_DIGEST_SECRET ?? ""

export async function POST(request: NextRequest) {
  if (!isAuthorizedBearer(request, WORKER_SECRET)) {
    // Failure-only throttle: successful auth never touches the limiter.
    const rl = checkAuthFailureLimit(request)
    if (!rl.ok) return NextResponse.json(rl.response, { status: 429, headers: rl.headers })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Single-user vault, but loop over owners for forward-compatibility.
    const users = await db.user.findMany({ select: { id: true } })

    let sent = 0
    let skipped = 0
    const errors: string[] = []

    for (const user of users) {
    try {
      const digest = await buildDailyDigest(user.id)
      if (!digest.hasContent) {
        skipped += 1
        continue
      }

      await sendWithPreferences(user.id, {
        title: digest.title,
        body: digest.body,
        url: "/finance",
        category: "finance",
        alertType: "daily_digest",
        severity: "info",
      })
      sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Never leak raw amounts/details to the response — log the userId only.
      console.error(`[finance-digest-worker] Failed for user ${user.id}:`, message)
      errors.push(`${user.id}: ${message}`)
    }
  }

    console.log(`[finance-digest-worker] sent=${sent} skipped=${skipped} errors=${errors.length}`)
    // Return only the count — per-user detail stays in the server log, not the body.
    return NextResponse.json({ sent, skipped, errors: errors.length })
  } catch (error) {
    console.error("[finance-digest-worker] worker failed:", error)
    return NextResponse.json({ error: "Digest worker failed" }, { status: 500 })
  }
}
