/**
 * POST /api/notifications/test — send a test notification.
 * Optional query param: ?channel=telegram|brrr|webpush (test a single channel)
 * Without the param, sends to ALL configured channels.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { sendNotification } from "@/lib/notifications/dispatcher"
import { sendTelegram } from "@/lib/notifications/channel-telegram"
import { sendBrrr } from "@/lib/notifications/channel-brrr"
import { sendNtfy } from "@/lib/notifications/channel-ntfy"
import { sendWebPush } from "@/lib/notifications/channel-webpush"
import { db } from "@/lib/db"
import { checkRateLimit, rateLimiters, rateLimitHeaders, getClientId } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from "next/server"
import type { ChannelResult } from "@/lib/notifications/dispatcher"

const TEST_PAYLOAD = {
  title: "PocketWatch Test",
  body: "If you see this, notifications are working!",
  url: "/settings",
  tag: "test",
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("N4001", "Authentication required", 401)

  const rl = checkRateLimit(rateLimiters.notificationTest, getClientId(req))
  if (!rl.ok) return NextResponse.json(rl.response, { status: 429, headers: rl.headers })

  const rlHeaders = rl.headers
  const targetChannel = req.nextUrl.searchParams.get("channel")

  try {
    let results: ChannelResult[]

    if (targetChannel) {
      // Single-channel test
      let sent = false
      let error: string | undefined

      try {
        if (targetChannel === "telegram") {
          sent = await sendTelegram(user.id, TEST_PAYLOAD)
        } else if (targetChannel === "brrr") {
          sent = await sendBrrr(user.id, TEST_PAYLOAD)
        } else if (targetChannel === "ntfy") {
          sent = await sendNtfy(user.id, TEST_PAYLOAD)
        } else if (targetChannel === "webpush") {
          sent = await sendWebPush(user.id, TEST_PAYLOAD)
        } else {
          return apiError("N4005", `Unknown channel: ${targetChannel}`, 400)
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
      }

      if (!sent && !error) error = "Channel not configured or send failed"
      results = [{ channel: targetChannel, sent, error }]
    } else {
      // All channels
      results = await sendNotification(user.id, TEST_PAYLOAD)
    }

    // Log to Notification table so it appears in the bell
    const sentChannels = results.filter((r) => r.sent).map((r) => r.channel)
    await db.notification.create({
      data: {
        userId: user.id,
        category: "system",
        alertType: "test",
        severity: "info",
        title: TEST_PAYLOAD.title,
        body: TEST_PAYLOAD.body,
        channels: sentChannels,
      },
    }).catch(() => { /* best effort */ })

    if (results.length === 0) {
      return apiError("N4002", "No notification channels configured. Add a channel in Settings first.", 400)
    }

    return NextResponse.json({
      sent: results.filter((r) => r.sent).length,
      total: results.length,
      results,
    }, { headers: rlHeaders })
  } catch (err) {
    return apiError("N4003", "Test notification failed", 500, err)
  }
}
