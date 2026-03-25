/**
 * Web Push subscription management.
 *
 * POST   — save push subscription from browser
 * DELETE — remove push subscription
 * GET    — return VAPID public key for client-side subscription
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { ensureVapidKeys } from "@/lib/notifications/channel-webpush"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("N5001", "Authentication required", 401)

  try {
    const publicKey = await ensureVapidKeys()
    return NextResponse.json({ publicKey })
  } catch (err) {
    return apiError("N5002", "Failed to get VAPID key", 500, err)
  }
}

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("N5010", "Authentication required", 401)

  const body = await req.json().catch(() => null)
  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("N5011", "Invalid push subscription", 400)
  }

  try {
    // Store subscription in Settings model (single-user vault)
    await db.settings.upsert({
      where: { key: "push_subscription" },
      create: {
        key: "push_subscription",
        value: {
          endpoint: parsed.data.endpoint,
          keys: parsed.data.keys,
        },
      },
      update: {
        value: {
          endpoint: parsed.data.endpoint,
          keys: parsed.data.keys,
        },
      },
    })

    return NextResponse.json({ subscribed: true })
  } catch (err) {
    return apiError("N5012", "Failed to save push subscription", 500, err)
  }
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return apiError("N5020", "Authentication required", 401)

  try {
    await db.settings.delete({ where: { key: "push_subscription" } }).catch(() => {})
    return NextResponse.json({ unsubscribed: true })
  } catch (err) {
    return apiError("N5022", "Failed to remove subscription", 500, err)
  }
}
