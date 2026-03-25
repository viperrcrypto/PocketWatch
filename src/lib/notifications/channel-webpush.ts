/**
 * Web Push notification channel.
 * Uses the web-push package to send push notifications via service worker.
 */

import { db } from "@/lib/db"
import type { NotificationPayload } from "./dispatcher"

export async function sendWebPush(_userId: string, payload: NotificationPayload): Promise<boolean> {
  // Load VAPID keys
  const vapidRow = await db.settings.findUnique({ where: { key: "vapid_keys" } })
  if (!vapidRow?.value) return false

  const vapid = vapidRow.value as { publicKey: string; privateKey: string; subject: string }
  if (!vapid.publicKey || !vapid.privateKey) return false

  // Load push subscription
  const subRow = await db.settings.findUnique({ where: { key: "push_subscription" } })
  if (!subRow?.value) return false

  const subscription = subRow.value as { endpoint: string; keys: { p256dh: string; auth: string } }
  if (!subscription.endpoint) return false

  try {
    // Dynamic import to avoid bundling web-push in client
    const webpush = await import("web-push")

    webpush.setVapidDetails(
      vapid.subject || "mailto:alerts@pocketwatch.local",
      vapid.publicKey,
      vapid.privateKey,
    )

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/favicon.ico",
      tag: payload.tag ?? "pocketwatch-alert",
      url: payload.url ?? "/finance",
    })

    await webpush.sendNotification(subscription, pushPayload)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // If subscription expired or invalid, remove it
    if (message.includes("410") || message.includes("404")) {
      await db.settings.delete({ where: { key: "push_subscription" } }).catch(() => {})
      console.warn("[notify:webpush] Subscription expired, removed")
    } else {
      console.error("[notify:webpush] Error:", message)
    }

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
        subject: "mailto:alerts@pocketwatch.local",
      },
    },
    update: {},
  })

  // Re-read to get whichever keys actually won the race
  const row = await db.settings.findUnique({ where: { key: "vapid_keys" } })
  return (row!.value as { publicKey: string }).publicKey
}
