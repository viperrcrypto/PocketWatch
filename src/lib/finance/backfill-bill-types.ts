/**
 * Lazy migration: backfill billType for existing subscriptions.
 * Called once per GET /api/finance/subscriptions when null billType entries exist.
 */

import { db } from "@/lib/db"
import { classifyBillType } from "./bill-type-classifier"

interface UnclassifiedSub {
  id: string
  merchantName: string
  frequency: string
  category: string | null
  amount: number
  accountId: string | null
}

export async function backfillBillTypes(userId: string): Promise<number> {
  // Use raw query to avoid Prisma client schema mismatch during hot reload
  const unclassified = await db.$queryRaw<UnclassifiedSub[]>`
    SELECT id, "merchantName", frequency, category, amount, "accountId"
    FROM "FinanceSubscription"
    WHERE "userId" = ${userId} AND "billType" IS NULL
  `

  if (unclassified.length === 0) return 0

  // Batch fetch account info for classification
  const accountIds = [...new Set(
    unclassified.map((s) => s.accountId).filter((id): id is string => id != null)
  )]

  const accounts = accountIds.length > 0
    ? await db.financeAccount.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, type: true, subtype: true },
      })
    : []

  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  const updates = unclassified.map((sub) => {
    const acct = sub.accountId ? accountMap.get(sub.accountId) : null
    const { billType } = classifyBillType({
      merchantName: sub.merchantName,
      frequency: sub.frequency,
      category: sub.category,
      amount: sub.amount,
      accountType: acct?.type ?? null,
      accountSubtype: acct?.subtype ?? null,
    })

    return db.$executeRaw`
      UPDATE "FinanceSubscription" SET "billType" = ${billType} WHERE id = ${sub.id}
    `
  })

  await Promise.all(updates).catch(() => { /* best-effort */ })
  return unclassified.length
}
