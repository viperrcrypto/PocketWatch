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
    const newSub = {
      endpoint: parsed.data.endpoint,
      keys: parsed.data.keys,
      createdAt: new Date().toISOString(),
    }

    // Multi-device: store subscriptions as array, dedup by endpoint
    const existing = await db.settings.findUnique({ where: { key: "push_subscriptions" } })
    let subs: Array<{ endpoint: string; keys: { p256dh: string; auth: string }; createdAt?: string }> = []

    if (existing?.value && Array.isArray(existing.value)) {
      subs = existing.value as typeof subs
    }

    // Remove existing sub with same endpoint (re-subscribe), add new one
    subs = [...subs.filter((s) => s.endpoint !== newSub.endpoint), newSub]

    // Cap at 10 devices to prevent abuse
    if (subs.length > 10) subs = subs.slice(-10)

    await db.settings.upsert({
      where: { key: "push_subscriptions" },
      create: { key: "push_subscriptions", value: subs as any },
      update: { value: subs as any },
    })

    return NextResponse.json({ subscribed: true, deviceCount: subs.length })
  } catch (err) {
    return apiError("N5012", "Failed to save push subscription", 500, err)
  }
}

const deleteSchema = z.object({
  endpoint: z.string().url().optional(),
})

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("N5020", "Authentication required", 401)

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = deleteSchema.safeParse(body)
    const endpoint = parsed.success ? parsed.data.endpoint : undefined

    if (endpoint) {
      // Remove specific device subscription
      const existing = await db.settings.findUnique({ where: { key: "push_subscriptions" } })
      if (existing?.value && Array.isArray(existing.value)) {
        const remaining = (existing.value as Array<{ endpoint: string }>).filter(
          (s) => s.endpoint !== endpoint,
        )
        if (remaining.length > 0) {
          await db.settings.update({
            where: { key: "push_subscriptions" },
            data: { value: remaining as any },
          })
        } else {
          await db.settings.delete({ where: { key: "push_subscriptions" } }).catch(() => {})
        }
      }
    } else {
      // Remove all subscriptions
      await db.settings.delete({ where: { key: "push_subscriptions" } }).catch(() => {})
      // Also clean up legacy key
      await db.settings.delete({ where: { key: "push_subscription" } }).catch(() => {})
    }

    return NextResponse.json({ unsubscribed: true })
  } catch (err) {
    return apiError("N5022", "Failed to remove subscription", 500, err)
  }
}
