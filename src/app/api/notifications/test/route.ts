/**
 * POST /api/notifications/test — send a test notification to all channels.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { sendNotification } from "@/lib/notifications/dispatcher"
import { NextResponse } from "next/server"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("N4001", "Authentication required", 401)

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
