/**
 * Alert orchestrator — runs transaction intelligence, saves alerts to DB,
 * and dispatches notifications via all configured channels.
 */

import { db } from "@/lib/db"
import { detectFinancialEvents, type NewAlert } from "./transaction-intelligence"
import { sendWithPreferences } from "@/lib/notifications/dispatcher"

function formatAlertPayload(alert: NewAlert) {
  return {
    title: alert.title,
    body: alert.message,
    url: "/finance",
    tag: `${alert.alertType}-${alert.transactionId ?? alert.merchantName ?? "general"}`,
  }
}

/** Map alert types to severity so channels with thresholds route correctly. */
function alertSeverity(alert: NewAlert): "info" | "watch" | "urgent" {
  switch (alert.alertType) {
    case "double_charge":
      return "urgent"
    case "budget_warning":
      // "Budget Exceeded" = urgent, "Budget Warning" (80%) = watch
      return alert.title.includes("Exceeded") ? "urgent" : "watch"
    case "large_transaction":
    case "bill_reminder":
    case "unusual_spend":
    case "price_change":
      return "watch"
    case "refund":
    case "deposit":
    case "income":
    default:
      return "info"
  }
}

/**
 * Detect financial events and send notifications.
 * Returns count of alerts sent.
 */
export async function detectAndNotify(userId: string): Promise<{ alertsSent: number }> {
  const events = await detectFinancialEvents(userId)
  if (events.length === 0) return { alertsSent: 0 }

  let alertsSent = 0

  for (const event of events) {
    const payload = formatAlertPayload(event)
    // Use preference-aware dispatch — respects category toggles,
    // per-channel severity routing, quiet hours, and logs to Notification table
    const results = await sendWithPreferences(userId, {
      ...payload,
      category: "finance",
      alertType: event.alertType,
      severity: alertSeverity(event),
      metadata: event.metadata as Record<string, unknown> | undefined,
    })
    const sentChannels = results.filter((r) => r.sent).map((r) => r.channel)

    // Always persist to FinanceAlert — dedup logic relies on this record existing.
    // Without it, the same event would re-fire every 15 minutes until the
    // transaction falls out of the lookback window.
    await db.financeAlert.create({
      data: {
        userId,
        alertType: event.alertType,
        title: event.title,
        message: event.message,
        amount: event.amount,
        merchantName: event.merchantName,
        transactionId: event.transactionId,
        metadata: event.metadata ? (event.metadata as Record<string, string | number | boolean | null>) : undefined,
        channels: sentChannels,
      },
    })
    if (sentChannels.length > 0) alertsSent++
  }

  if (alertsSent > 0) {
    console.info(`[alert-orchestrator] userId=${userId} alerts=${alertsSent}`)
  }
  return { alertsSent }
}

/**
 * Run subscription price change alerts.
 * Called after detectAndSaveSubscriptions() returns price changes.
 */
export async function notifyPriceChanges(
  userId: string,
  priceChanges: Array<{ merchantName: string; oldAmount: number; newAmount: number }>,
): Promise<void> {
  // Dedup: check if we already alerted on this price change today (UTC)
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const existingAlerts = await db.financeAlert.findMany({
    where: { userId, alertType: "price_change", sentAt: { gte: today } },
    select: { merchantName: true },
  })
  const alreadyAlerted = new Set(existingAlerts.map((a) => a.merchantName).filter((n): n is string => n !== null))

  for (const change of priceChanges) {
    if (alreadyAlerted.has(change.merchantName)) continue

    const direction = change.newAmount > change.oldAmount ? "increased" : "decreased"
    const fmtOld = `$${change.oldAmount.toFixed(2)}`
    const fmtNew = `$${change.newAmount.toFixed(2)}`
    const message = `${change.merchantName} ${direction}: ${fmtOld} -> ${fmtNew}`

    const results = await sendWithPreferences(userId, {
      title: "Subscription Price Change",
      body: message,
      url: "/finance",
      tag: `price-change-${change.merchantName}`,
      category: "finance",
      alertType: "price_change",
      severity: "watch",
    })

    const sentChannels = results.filter((r) => r.sent).map((r) => r.channel)

    await db.financeAlert.create({
      data: {
        userId,
        alertType: "price_change",
        title: "Subscription Price Change",
        message,
        amount: change.newAmount,
        merchantName: change.merchantName,
        metadata: { oldAmount: change.oldAmount, newAmount: change.newAmount },
        channels: sentChannels,
      },
    })
  }
}
