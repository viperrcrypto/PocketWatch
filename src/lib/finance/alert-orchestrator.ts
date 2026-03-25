/**
 * Alert orchestrator — runs transaction intelligence, saves alerts to DB,
 * and dispatches notifications via all configured channels.
 */

import { db } from "@/lib/db"
import { detectFinancialEvents, type NewAlert } from "./transaction-intelligence"
import { sendNotification } from "@/lib/notifications/dispatcher"

function formatAlertPayload(alert: NewAlert) {
  return {
    title: alert.title,
    body: alert.message,
    url: "/finance",
    tag: `${alert.alertType}-${alert.transactionId ?? alert.merchantName ?? "general"}`,
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
    // Send notification first — only persist if at least one channel succeeds
    const payload = formatAlertPayload(event)
    const results = await sendNotification(userId, payload)
    const sentChannels = results.filter((r) => r.sent).map((r) => r.channel)

    // Save to DB (even if no channels succeeded, for history — but mark channels)
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

    alertsSent++
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
  // Dedup: check if we already alerted on this price change today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
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

    const results = await sendNotification(userId, {
      title: "Subscription Price Change",
      body: message,
      url: "/finance",
      tag: `price-change-${change.merchantName}`,
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
