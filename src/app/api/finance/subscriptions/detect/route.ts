import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { detectSubscriptions, EXCLUDED_MERCHANTS } from "@/lib/finance/subscriptions"
import { stringSimilarity } from "@/lib/finance/normalize"
import { financeRateLimiters, rateLimitHeaders } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("F6020", "Authentication required", 401)

  const rl = financeRateLimiters.detect(`detect:${user.id}`)
  if (!rl.success) {
    return apiError("F6025", "Rate limit exceeded. Try again later.", 429, undefined, rateLimitHeaders(rl))
  }

  try {
    // Get last 6 months of transactions
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const transactions = await db.financeTransaction.findMany({
      where: {
        userId: user.id,
        date: { gte: sixMonthsAgo },
        isDuplicate: false,
        isExcluded: false,
      },
      orderBy: { date: "asc" },
    })

    const existing = await db.financeSubscription.findMany({
      where: { userId: user.id },
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

    // Purge false positives from DB (merchants that match EXCLUDED_MERCHANTS)
    const falsePositives = existing.filter(
      (e) =>
        e.status === "active" &&
        [...EXCLUDED_MERCHANTS].some((m) => e.merchantName.toUpperCase().includes(m))
    )
    let purgedCount = 0
    for (const fp of falsePositives) {
      await db.financeSubscription.delete({ where: { id: fp.id } })
      purgedCount++
    }

    // Save newly detected subscriptions + update stale ones
    let newCount = 0
    let updatedCount = 0

    for (const sub of detected) {
      const matchingExisting = existing.find(
        (e) => stringSimilarity(e.merchantName, sub.merchantName) > 0.8
      )

      if (matchingExisting) {
        // Never re-activate dismissed subscriptions — user said "not a subscription"
        if (matchingExisting.status === "dismissed") continue

        // Check if frequency or amount has changed significantly
        const freqChanged = matchingExisting.frequency !== sub.frequency
        const amountDiff = Math.abs(matchingExisting.amount - sub.amount) / Math.max(matchingExisting.amount, sub.amount)
        const amountChanged = amountDiff > 0.1

        // Don't auto-update if user has manually curated (has nickname or notes)
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
          userId: user.id,
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

    return NextResponse.json({
      detected: detected.length,
      newlyAdded: newCount,
      updated: updatedCount,
      purged: purgedCount,
      subscriptions: detected,
    })
  } catch (err) {
    const mapped = mapFinanceError(err, "Subscription detection failed")
    return apiError("F6021", mapped.message, mapped.status, err)
  }
}
