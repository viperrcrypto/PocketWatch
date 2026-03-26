/**
 * Subscription detection triggered after sync.
 * Extracted from the detect API route for reuse in sync flows.
 */

import { db } from "@/lib/db"
import { detectSubscriptions, EXCLUDED_MERCHANTS, computeNextChargeDate, type Frequency } from "../subscriptions"
import { stringSimilarity } from "../normalize"

export interface SubscriptionPriceChange {
  merchantName: string
  oldAmount: number
  newAmount: number
}

export async function detectAndSaveSubscriptions(userId: string): Promise<{
  detected: number
  newlyAdded: number
  updated: number
  priceChanges: SubscriptionPriceChange[]
}> {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const transactions = await db.financeTransaction.findMany({
    where: {
      userId,
      date: { gte: sixMonthsAgo },
      isDuplicate: false,
      isExcluded: false,
    },
    orderBy: { date: "asc" },
  })

  if (transactions.length === 0) {
    return { detected: 0, newlyAdded: 0, updated: 0, priceChanges: [] }
  }

  const existing = await db.financeSubscription.findMany({
    where: { userId },
  })

  const detected = detectSubscriptions(
    transactions.map((t) => ({
      merchantName: t.merchantName,
      rawName: t.name,
      amount: t.amount,
      date: t.date.toISOString().split("T")[0],
      accountId: t.accountId,
      category: t.category,
    })),
    existing.map((e) => ({
      merchantName: e.merchantName,
      status: e.status,
    }))
  )

  // Purge false positives (matches excluded merchants list)
  const falsePositives = existing.filter(
    (e) =>
      e.status === "active" &&
      [...EXCLUDED_MERCHANTS].some((m) => e.merchantName.toUpperCase().includes(m))
  )
  for (const fp of falsePositives) {
    await db.financeSubscription.delete({ where: { id: fp.id } })
  }

  // Mark stale subscriptions as cancelled:
  // If nextChargeDate is >90 days in the past and no recent transaction matches,
  // the subscription was likely cancelled.
  const now = new Date()
  const staleCutoff = new Date()
  staleCutoff.setDate(staleCutoff.getDate() - 90)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const activeSubs = existing.filter(
    (e) => e.status === "active" && e.nextChargeDate && e.nextChargeDate < staleCutoff
  )
  for (const stale of activeSubs) {
    // Check if there's been a recent transaction from this merchant
    const recentTx = transactions.find(
      (t) => t.date >= threeMonthsAgo &&
        stringSimilarity(t.merchantName ?? t.name, stale.merchantName) > 0.75
    )
    if (!recentTx) {
      await db.financeSubscription.update({
        where: { id: stale.id },
        data: { status: "cancelled" },
      })
    }
  }

  let newCount = 0
  let updatedCount = 0
  const priceChanges: SubscriptionPriceChange[] = []

  for (const sub of detected) {
    const matchingExisting = existing.find(
      (e) => stringSimilarity(e.merchantName, sub.merchantName) > 0.8
    )

    if (matchingExisting) {
      if (matchingExisting.status === "dismissed") continue

      const freqChanged = matchingExisting.frequency !== sub.frequency
      const amountDiff = Math.abs(matchingExisting.amount - sub.amount) / Math.max(matchingExisting.amount, sub.amount)
      const amountChanged = amountDiff > 0.1
      const isUserCurated = matchingExisting.nickname || matchingExisting.notes

      if ((freqChanged || amountChanged) && !isUserCurated) {
        if (amountChanged) {
          priceChanges.push({
            merchantName: matchingExisting.merchantName,
            oldAmount: matchingExisting.amount,
            newAmount: sub.amount,
          })
        }
        await db.financeSubscription.update({
          where: { id: matchingExisting.id },
          data: {
            ...(freqChanged && { frequency: sub.frequency }),
            ...(amountChanged && { amount: sub.amount }),
            lastChargeDate: new Date(sub.lastChargeDate),
            nextChargeDate: new Date(sub.nextChargeDate),
            accountId: sub.accountId,
          },
        })
        updatedCount++
      }
      continue
    }

    await db.financeSubscription.create({
      data: {
        userId,
        merchantName: sub.merchantName,
        amount: sub.amount,
        frequency: sub.frequency,
        category: sub.category,
        accountId: sub.accountId,
        lastChargeDate: new Date(sub.lastChargeDate),
        nextChargeDate: new Date(sub.nextChargeDate),
        status: "active",
      },
    })
    newCount++
  }

  // Supplement with Plaid recurring outflow streams not already covered
  const recurringStreams = await db.financeRecurringStream.findMany({
    where: { userId, streamType: "outflow", isActive: true },
  })

  // Get the final set of all subscriptions (existing + newly created)
  const allSubs = await db.financeSubscription.findMany({
    where: { userId },
    select: { merchantName: true, status: true },
  })

  for (const stream of recurringStreams) {
    const name = stream.merchantName ?? stream.description
    if (!name) continue
    if ([...EXCLUDED_MERCHANTS].some((m) => name.toUpperCase().includes(m))) continue

    const alreadyCovered = allSubs.some(
      (s) => s.status !== "dismissed" && stringSimilarity(s.merchantName, name) > 0.7
    )
    if (alreadyCovered) continue

    const amount = stream.lastAmount ?? stream.averageAmount ?? 0
    if (amount <= 0) continue

    const freq: Frequency = stream.frequency === "WEEKLY" ? "weekly"
      : stream.frequency === "BIWEEKLY" ? "biweekly"
      : stream.frequency === "SEMI_MONTHLY" ? "monthly" // FIX Bug 20: was "biweekly", closer to monthly
      : stream.frequency === "ANNUALLY" ? "yearly"
      : "monthly"
    const nextDate = stream.lastDate ? computeNextChargeDate(stream.lastDate, freq) : undefined

    await db.financeSubscription.create({
      data: {
        userId,
        merchantName: name,
        amount,
        frequency: freq,
        category: stream.category,
        accountId: stream.accountId,
        lastChargeDate: stream.lastDate,
        nextChargeDate: nextDate,
        status: "active",
      },
    })
    newCount++
  }

  return { detected: detected.length, newlyAdded: newCount, updated: updatedCount, priceChanges }
}
