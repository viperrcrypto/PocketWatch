/**
 * Web Push notification channel.
 * Uses the web-push package to send push notifications via service worker.
 */

import { db } from "@/lib/db"
import type { NotificationPayload } from "./dispatcher"

interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
  deviceLabel?: string
  createdAt?: string
}

export async function sendWebPush(_userId: string, payload: NotificationPayload): Promise<boolean> {
  // Load VAPID keys
  const vapidRow = await db.settings.findUnique({ where: { key: "vapid_keys" } })
  if (!vapidRow?.value) return false

  const vapid = vapidRow.value as { publicKey: string; privateKey: string; subject: string }
  if (!vapid.publicKey || !vapid.privateKey) return false

  // Load push subscriptions (array for multi-device support)
  const subRow = await db.settings.findUnique({ where: { key: "push_subscriptions" } })
  // Also check legacy single-subscription key for backward compat
  const legacyRow = !subRow ? await db.settings.findUnique({ where: { key: "push_subscription" } }) : null

  let subscriptions: PushSubscription[] = []
  if (subRow?.value) {
    subscriptions = Array.isArray(subRow.value)
      ? (subRow.value as unknown as PushSubscription[])
      : [subRow.value as unknown as PushSubscription]
  } else if (legacyRow?.value) {
    subscriptions = [legacyRow.value as unknown as PushSubscription]
  }

  if (subscriptions.length === 0) return false

  try {
    const webpush = await import("web-push")

    const vapidSubject = process.env.NEXT_PUBLIC_APP_URL || vapid.subject || "mailto:alerts@pocketwatch.local"
    webpush.setVapidDetails(vapidSubject, vapid.publicKey, vapid.privateKey)

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/img/pwa-icon-192.png",
      tag: payload.tag ?? "pocketwatch-alert",
      url: payload.url ?? "/net-worth",
    })

    // Send to all subscriptions, collect expired ones for cleanup
    const expiredEndpoints: string[] = []
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, pushPayload)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          if (message.includes("410") || message.includes("404")) {
            expiredEndpoints.push(sub.endpoint)
          } else {
            console.error("[notify:webpush] Error:", message)
          }
          throw err
        }
      }),
    )

    // Remove expired subscriptions
    if (expiredEndpoints.length > 0) {
      const remaining = subscriptions.filter((s) => !expiredEndpoints.includes(s.endpoint))
      if (remaining.length > 0) {
        await db.settings.upsert({
          where: { key: "push_subscriptions" },
          create: { key: "push_subscriptions", value: remaining as any },
          update: { value: remaining as any },
        })
      } else {
        await db.settings.delete({ where: { key: "push_subscriptions" } }).catch(() => {})
        await db.settings.delete({ where: { key: "push_subscription" } }).catch(() => {})
      }
      console.warn(`[notify:webpush] Removed ${expiredEndpoints.length} expired subscription(s)`)
    }

    return results.some((r) => r.status === "fulfilled")
  } catch (err) {
    console.error("[notify:webpush] Error:", err instanceof Error ? err.message : String(err))
    return false
  }
}

/**
 * Generate VAPID keys if they don't exist yet.
 * Returns the public key for client-side subscription.
 */
export async function ensureVapidKeys(): Promise<string> {
  const existing = await db.settings.findUnique({ where: { key: "vapid_keys" } })
  if (existing?.value) {
    const vapid = existing.value as { publicKey: string }
    return vapid.publicKey
  }

  const webpush = await import("web-push")
  const keys = webpush.generateVAPIDKeys()

  // First-write wins — empty update prevents overwriting if another request raced
  await db.settings.upsert({
    where: { key: "vapid_keys" },
    create: {
      key: "vapid_keys",
      value: {
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        subject: process.env.NEXT_PUBLIC_APP_URL || "mailto:alerts@pocketwatch.local",
      },
    },
    update: {},
  })

  // Re-read to get whichever keys actually won the race
  const row = await db.settings.findUnique({ where: { key: "vapid_keys" } })
  return (row!.value as { publicKey: string }).publicKey
}
