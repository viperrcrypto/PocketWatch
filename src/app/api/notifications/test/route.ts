/**
 * POST /api/notifications/test — send a test notification to all channels.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { sendNotification } from "@/lib/notifications/dispatcher"
import { rateLimiters, getClientId } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("N4001", "Authentication required", 401)

  const rl = rateLimiters.notificationTest(getClientId(req))
  if (!rl.success) return apiError("N4004", "Too many test notifications — try again later", 429)

  try {
    const results = await sendNotification(user.id, {
      title: "PocketWatch Test",
      body: "If you see this, notifications are working!",
      url: "/finance/settings",
      tag: "test",
    })

    if (results.length === 0) {
      return apiError("N4002", "No notification channels configured. Add a channel in Settings first.", 400)
    }

    return NextResponse.json({
      sent: results.filter((r) => r.sent).length,
      total: results.length,
      results,
    })
  } catch (err) {
    return apiError("N4003", "Test notification failed", 500, err)
  }
}
