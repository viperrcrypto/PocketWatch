/**
 * Refresh stale subscription/stream dates from actual transaction history.
 * Called lazily during bill projection to keep lastChargeDate/nextChargeDate current.
 * Without this, yearly/quarterly subscriptions show as "upcoming" even after being charged.
 */

import { db } from "@/lib/db"
import { getCached, setCache } from "@/lib/cache"
import { computeNextChargeDate, type Frequency } from "./subscriptions"

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const VALID_FREQS: Frequency[] = ["weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"]

/**
 * For each active subscription AND Plaid recurring stream, check if a newer
 * matching transaction exists and update dates if so.
 */
export async function refreshSubscriptionDates(userId: string): Promise<void> {
  const cacheKey = `sub-refresh:${userId}`
  if (getCached(cacheKey)) return
  setCache(cacheKey, true, CACHE_TTL)

  await Promise.all([
    refreshMaterializedSubs(userId),
    refreshPlaidStreams(userId),
  ])
}

/** Refresh FinanceSubscription records */
async function refreshMaterializedSubs(userId: string): Promise<void> {
  const subs = await db.financeSubscription.findMany({
    where: { userId, status: "active" },
    select: { id: true, merchantName: true, accountId: true, frequency: true, lastChargeDate: true, amount: true },
  })

  const updates: Array<{ id: string; lastChargeDate: Date; nextChargeDate: Date; lastTransactionId: string; amount: number }> = []

  for (const sub of subs) {
    const match = await findNewerTransaction(userId, sub.merchantName, sub.accountId, sub.lastChargeDate)
    if (!match) continue

    const freq = sub.frequency as Frequency
    if (!VALID_FREQS.includes(freq)) continue

    updates.push({
      id: sub.id,
      lastChargeDate: match.date,
      nextChargeDate: computeNextChargeDate(match.date, freq),
      lastTransactionId: match.transactionId,
      // Keep the displayed amount in step with the most recent charge so a
      // variable bill's headline matches its latest (verified) payment.
      amount: match.amount,
    })
  }

  if (updates.length > 0) {
    await db.$transaction(
      updates.map((u) => db.financeSubscription.update({
        where: { id: u.id },
        data: { lastChargeDate: u.lastChargeDate, nextChargeDate: u.nextChargeDate, lastTransactionId: u.lastTransactionId, amount: u.amount },
      }))
    )
  }
}

/** Refresh FinanceRecurringStream records (Plaid streams) */
async function refreshPlaidStreams(userId: string): Promise<void> {
  const streams = await db.financeRecurringStream.findMany({
    where: { userId, streamType: "outflow", isActive: true },
    select: { id: true, merchantName: true, description: true, accountId: true, lastDate: true, frequency: true },
  })

  const PLAID_FREQ_MAP: Record<string, Frequency> = {
    WEEKLY: "weekly", BIWEEKLY: "biweekly", SEMI_MONTHLY: "biweekly",
    MONTHLY: "monthly", ANNUALLY: "yearly",
  }

  const updates: Array<{ id: string; lastDate: Date }> = []

  for (const stream of streams) {
    // Try both merchantName and description — Plaid streams often have
    // a enriched merchantName that doesn't match raw transaction names
    const candidates = [stream.description, stream.merchantName].filter(Boolean) as string[]
    if (candidates.length === 0) continue

    let match: { date: Date; transactionId: string } | null = null
    for (const name of candidates) {
      match = await findNewerTransaction(userId, name, stream.accountId, stream.lastDate)
      if (match) break
    }
    if (!match) continue

    const freq = PLAID_FREQ_MAP[stream.frequency] ?? stream.frequency as Frequency
    if (!VALID_FREQS.includes(freq)) continue

    updates.push({ id: stream.id, lastDate: match.date })
  }

  if (updates.length > 0) {
    await db.$transaction(
      updates.map((u) => db.financeRecurringStream.update({
        where: { id: u.id },
        data: { lastDate: u.lastDate },
      }))
    )
  }
}

/** Find the most recent transaction matching a merchant name that's newer than the current lastDate */
async function findNewerTransaction(
  userId: string,
  merchantName: string,
  accountId: string | null,
  currentLastDate: Date | null,
): Promise<{ date: Date; transactionId: string; amount: number } | null> {
  const since = currentLastDate ?? new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)

  // Clean the merchant name for search — strip account suffixes like "••••1234 Annual Fee"
  const cleanName = merchantName
    .replace(/\s*[•·]{2,}\d{4}\s*/g, "")
    .replace(/\s*(annual|membership)\s*fee$/i, "")
    .trim()

  if (cleanName.length < 3) return null

  const tx = await db.financeTransaction.findFirst({
    where: {
      userId,
      date: { gt: since },
      isDuplicate: false,
      isExcluded: false,
      amount: { gt: 0 },
      OR: [
        { merchantName: { contains: cleanName, mode: "insensitive" } },
        { name: { contains: cleanName, mode: "insensitive" } },
      ],
      ...(accountId ? { accountId } : {}),
    },
    select: { id: true, date: true, amount: true },
    orderBy: { date: "desc" },
  })

  if (!tx) return null

  const txDate = new Date(tx.date)
  if (currentLastDate && txDate <= new Date(currentLastDate)) return null

  return { date: txDate, transactionId: tx.id, amount: tx.amount }
}
