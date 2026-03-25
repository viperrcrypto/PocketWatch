/**
 * Telegram notification channel.
 * Sends messages via Telegram Bot API.
 */

import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import type { NotificationPayload } from "./dispatcher"

export async function sendTelegram(userId: string, payload: NotificationPayload): Promise<boolean> {
  const key = await db.externalApiKey.findFirst({
    where: { userId, serviceName: "notify_telegram" },
    select: { apiKeyEnc: true },
  })
  if (!key) return false

  let config: { botToken: string; chatId: string }
  try {
    const decrypted = await decryptCredential(key.apiKeyEnc)
    config = JSON.parse(decrypted)
  } catch {
    console.error("[notify:telegram] Failed to decrypt config")
    return false
  }

  if (!config.botToken || !config.chatId) return false

  const text = `*${escapeMarkdown(payload.title)}*\n${escapeMarkdown(payload.body)}`

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "MarkdownV2",
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown")
      console.error(`[notify:telegram] Send failed: ${res.status} ${body}`)
      return false
    }

    return true
  } catch (err) {
    console.error("[notify:telegram] Error:", err instanceof Error ? err.message : err)
    return false
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&")
}
