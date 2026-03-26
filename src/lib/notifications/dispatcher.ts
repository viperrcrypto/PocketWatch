/**
 * Notification dispatcher — sends alerts to all configured channels in parallel.
 * Gracefully skips unconfigured channels. Never throws.
 */

import { db } from "@/lib/db"
import { sendBrrr } from "./channel-brrr"
import { sendTelegram } from "./channel-telegram"
import { sendWebPush } from "./channel-webpush"

export interface NotificationPayload {
  title: string
  body: string
  url?: string
  tag?: string
  sound?: string
}

export interface ChannelResult {
  channel: string
  sent: boolean
  error?: string
}

type ChannelFn = (userId: string, payload: NotificationPayload) => Promise<boolean>

async function tryChannel(name: string, fn: ChannelFn, userId: string, payload: NotificationPayload): Promise<ChannelResult> {
  try {
    const sent = await fn(userId, payload)
    return { channel: name, sent }
  } catch (err) {
    return { channel: name, sent: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Send a notification to all configured channels for a specific user.
 */
export async function sendNotification(userId: string, payload: NotificationPayload): Promise<ChannelResult[]> {
  const [brrrKey, telegramKey, vapidKeys, pushSubs, pushSubLegacy] = await Promise.all([
    db.externalApiKey.findFirst({ where: { userId, serviceName: "notify_brrr" }, select: { id: true } }),
    db.externalApiKey.findFirst({ where: { userId, serviceName: "notify_telegram" }, select: { id: true } }),
    db.settings.findUnique({ where: { key: "vapid_keys" }, select: { id: true } }),
    db.settings.findUnique({ where: { key: "push_subscriptions" }, select: { id: true } }),
    db.settings.findUnique({ where: { key: "push_subscription" }, select: { id: true } }),
  ])

  const tasks: Promise<ChannelResult>[] = []

  if (brrrKey) tasks.push(tryChannel("brrr", sendBrrr, userId, payload))
  if (telegramKey) tasks.push(tryChannel("telegram", sendTelegram, userId, payload))
  if (vapidKeys && (pushSubs || pushSubLegacy)) tasks.push(tryChannel("webpush", sendWebPush, userId, payload))

  if (tasks.length === 0) return []

  const results = await Promise.all(tasks)

  const failures = results.filter((r) => !r.sent)
  if (failures.length > 0) {
    console.warn("[notify] Channel failures:", failures.map((f) => `${f.channel}: ${f.error}`).join(", "))
  }

  return results
}

/**
 * Get status of all notification channels for a specific user.
 */
export async function getChannelStatus(userId: string): Promise<Array<{ channel: string; configured: boolean }>> {
  const [brrrKey, telegramKey, vapidKeys, pushSubs, pushSubLegacy] = await Promise.all([
    db.externalApiKey.findFirst({ where: { userId, serviceName: "notify_brrr" }, select: { id: true } }),
    db.externalApiKey.findFirst({ where: { userId, serviceName: "notify_telegram" }, select: { id: true } }),
    db.settings.findUnique({ where: { key: "vapid_keys" }, select: { id: true } }),
    db.settings.findUnique({ where: { key: "push_subscriptions" }, select: { id: true } }),
    db.settings.findUnique({ where: { key: "push_subscription" }, select: { id: true } }),
  ])

  return [
    { channel: "brrr", configured: !!brrrKey },
    { channel: "telegram", configured: !!telegramKey },
    { channel: "webpush", configured: !!vapidKeys && !!(pushSubs || pushSubLegacy) },
  ]
}
