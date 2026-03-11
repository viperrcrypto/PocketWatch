/**
 * Subscription detection triggered after sync.
 * Extracted from the detect API route for reuse in sync flows.
 */

import { db } from "@/lib/db"
import { detectSubscriptions, EXCLUDED_MERCHANTS } from "../subscriptions"
import { stringSimilarity } from "../normalize"

export async function detectAndSaveSubscriptions(userId: string): Promise<{
  detected: number
  newlyAdded: number
  updated: number
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
    return { detected: 0, newlyAdded: 0, updated: 0 }
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

  // Purge false positives
  const falsePositives = existing.filter(
    (e) =>
      e.status === "active" &&
      [...EXCLUDED_MERCHANTS].some((m) => e.merchantName.toUpperCase().includes(m))
  )
  for (const fp of falsePositives) {
    await db.financeSubscription.delete({ where: { id: fp.id } })
  }

  let newCount = 0
  let updatedCount = 0

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

  return { detected: detected.length, newlyAdded: newCount, updated: updatedCount }
}
