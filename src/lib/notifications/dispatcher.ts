/**
 * Notification dispatcher — sends alerts to all configured channels in parallel.
 * Gracefully skips unconfigured channels. Never throws.
 */

import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
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

// ─── Severity Ordering ────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = { info: 0, watch: 1, urgent: 2 }

function severityPasses(alertSeverity: string, threshold: string): boolean {
  return (SEVERITY_ORDER[alertSeverity] ?? 0) >= (SEVERITY_ORDER[threshold] ?? 0)
}

function isQuietNow(start: string, end: string): boolean {
  const now = new Date()
  const current = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const s = sh * 60 + sm
  const e = eh * 60 + em
  return s <= e ? current >= s && current < e : current >= s || current < e
}

/**
 * Send notification with preference-based routing — checks category
 * enable/disable, per-channel severity thresholds, and quiet hours.
 * Logs to the Notification table for history/bell.
 */
export async function sendWithPreferences(
  userId: string,
  payload: NotificationPayload & {
    category: string
    alertType: string
    severity?: string
    metadata?: Record<string, unknown>
  },
): Promise<ChannelResult[]> {
  const severity = payload.severity ?? "info"

  // Load preferences
  const prefs = await db.notificationPreference.findUnique({ where: { userId } })
  const categories = (prefs?.categories ?? {}) as Record<string, boolean>
  const channelSeverity = (prefs?.channelSeverity ?? {}) as Record<string, string>

  // Check category enabled (default: true)
  if (categories[payload.category] === false) {
    // Still log to DB for history, but don't send
    await db.notification.create({
      data: {
        userId,
        category: payload.category,
        alertType: payload.alertType,
        severity,
        title: payload.title,
        body: payload.body,
        metadata: payload.metadata ? (payload.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
        channels: [],
      },
    })
    return []
  }

  // Check quiet hours
  if (prefs?.quietEnabled && isQuietNow(prefs.quietStart, prefs.quietEnd)) {
    if (!(prefs.quietOverride && severity === "urgent")) {
      await db.notification.create({
        data: {
          userId,
          category: payload.category,
          alertType: payload.alertType,
          severity,
          title: payload.title,
          body: payload.body,
          metadata: payload.metadata ? (payload.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
          channels: [],
        },
      })
      return []
    }
  }

  // Determine which channels pass severity threshold
  const [brrrKey, telegramKey, vapidKeys, pushSubs, pushSubLegacy] = await Promise.all([
    db.externalApiKey.findFirst({ where: { userId, serviceName: "notify_brrr" }, select: { id: true } }),
    db.externalApiKey.findFirst({ where: { userId, serviceName: "notify_telegram" }, select: { id: true } }),
    db.settings.findUnique({ where: { key: "vapid_keys" }, select: { id: true } }),
    db.settings.findUnique({ where: { key: "push_subscriptions" }, select: { id: true } }),
    db.settings.findUnique({ where: { key: "push_subscription" }, select: { id: true } }),
  ])

  const tasks: Promise<ChannelResult>[] = []

  if (brrrKey && severityPasses(severity, channelSeverity["brrr"] ?? "info")) {
    tasks.push(tryChannel("brrr", sendBrrr, userId, payload))
  }
  if (telegramKey && severityPasses(severity, channelSeverity["telegram"] ?? "urgent")) {
    tasks.push(tryChannel("telegram", sendTelegram, userId, payload))
  }
  if (vapidKeys && (pushSubs || pushSubLegacy) && severityPasses(severity, channelSeverity["webpush"] ?? "watch")) {
    tasks.push(tryChannel("webpush", sendWebPush, userId, payload))
  }

  const results = tasks.length > 0 ? await Promise.all(tasks) : []
  const sentChannels = results.filter((r) => r.sent).map((r) => r.channel)

  // Log to Notification table for history/bell
  await db.notification.create({
    data: {
      userId,
      category: payload.category,
      alertType: payload.alertType,
      severity,
      title: payload.title,
      body: payload.body,
      metadata: payload.metadata ? (payload.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
      channels: sentChannels,
    },
  })

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
