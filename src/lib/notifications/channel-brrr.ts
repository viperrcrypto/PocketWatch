/**
 * brrr.now push notification channel.
 * Sends push notifications to Apple devices via brrr webhook.
 */

import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import type { NotificationPayload } from "./dispatcher"

export async function sendBrrr(userId: string, payload: NotificationPayload): Promise<boolean> {
  const key = await db.externalApiKey.findFirst({
    where: { userId, serviceName: "notify_brrr" },
    select: { apiKeyEnc: true },
  })
  if (!key) return false

  const webhookUrl = await decryptCredential(key.apiKeyEnc)
  if (!webhookUrl) return false

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        message: payload.body,
        sound: payload.sound ?? "default",
        open_url: payload.url,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown")
      console.error(`[notify:brrr] Send failed: ${res.status} ${body}`)
      return false
    }

    return true
  } catch (err) {
    console.error("[notify:brrr] Error:", err instanceof Error ? err.message : err)
    return false
  }
}
