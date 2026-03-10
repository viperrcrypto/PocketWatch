/**
 * Plaid-specific sync: incremental transaction sync and full history fetch.
 */

import { db } from "@/lib/db"
import { decryptCredential } from "../crypto"
import * as plaid from "../plaid-client"
import { categorizeTransaction, cleanMerchantName } from "../categorize"
import { withRetry } from "../retry"
import type { SyncResult } from "./helpers"

export async function syncPlaid(
  institution: Awaited<ReturnType<typeof db.financeInstitution.findUnique>> & { accounts: Array<{ id: string; externalId: string }> }
): Promise<SyncResult> {
  if (!institution!.plaidAccessToken) {
    throw new Error("No Plaid access token")
  }

  const accessToken = await decryptCredential(institution!.plaidAccessToken)
  let cursor = institution!.syncCursor

  const plaidAccounts = await withRetry(() =>
    plaid.getBalances(institution!.userId, accessToken)
  )
  for (const pa of plaidAccounts) {
    await db.financeAccount.updateMany({
      where: {
        userId: institution!.userId,
        externalId: pa.accountId,
      },
      data: {
        currentBalance: pa.balances.current,
        availableBalance: pa.balances.available,
        creditLimit: pa.balances.limit,
      },
    })
  }

  const userRules = await db.financeCategoryRule.findMany({
    where: { userId: institution!.userId },
    orderBy: { priority: "desc" },
  })

  let totalAdded = 0
  let totalModified = 0
  let totalRemoved = 0
  let hasMore = true

  while (hasMore) {
    const result = await withRetry(() =>
      plaid.syncTransactions(institution!.userId, accessToken, cursor)
    )

    await db.$transaction(async (tx) => {
      for (const txn of result.added) {
        const account = institution!.accounts.find(
          (a) => a.externalId === txn.accountId
        )
        if (!account) continue

        const cleaned = cleanMerchantName(txn.merchantName || txn.name)
        const cat = categorizeTransaction(
          {
            merchantName: cleaned,
            rawName: txn.name,
            plaidCategory: txn.personalFinanceCategory?.detailed ?? null,
          },
          userRules
        )

        await tx.financeTransaction.upsert({
          where: {
            userId_externalId: {
              userId: institution!.userId,
              externalId: txn.transactionId,
            },
          },
          create: {
            userId: institution!.userId,
            accountId: account.id,
            externalId: txn.transactionId,
            provider: "plaid",
            date: new Date(txn.date),
            name: txn.name,
            merchantName: cleaned,
            amount: txn.amount,
            currency: txn.isoCurrencyCode ?? "USD",
            category: cat.category,
            subcategory: cat.subcategory,
            plaidCategory: txn.personalFinanceCategory?.detailed ?? null,
            plaidCategoryPrimary: txn.personalFinanceCategory?.primary ?? null,
            isPending: txn.pending,
            authorizedDate: txn.authorizedDate ? new Date(txn.authorizedDate) : null,
            paymentChannel: txn.paymentChannel,
            merchantEntityId: txn.merchantEntityId,
            logoUrl: txn.logoUrl,
            website: txn.website,
            checkNumber: txn.checkNumber,
            transactionCode: txn.transactionCode,
            location: txn.location ?? undefined,
            paymentMeta: txn.paymentMeta ?? undefined,
            counterparties: txn.counterparties ?? undefined,
          },
          update: {
            name: txn.name,
            merchantName: cleaned,
            amount: txn.amount,
            isPending: txn.pending,
            plaidCategory: txn.personalFinanceCategory?.detailed ?? null,
            plaidCategoryPrimary: txn.personalFinanceCategory?.primary ?? null,
            authorizedDate: txn.authorizedDate ? new Date(txn.authorizedDate) : null,
            paymentChannel: txn.paymentChannel,
            merchantEntityId: txn.merchantEntityId,
            logoUrl: txn.logoUrl,
            website: txn.website,
            checkNumber: txn.checkNumber,
            transactionCode: txn.transactionCode,
            location: txn.location ?? undefined,
            paymentMeta: txn.paymentMeta ?? undefined,
            counterparties: txn.counterparties ?? undefined,
          },
        })
        totalAdded++
      }

      for (const txn of result.modified) {
        const cleaned = cleanMerchantName(txn.merchantName || txn.name)
        await tx.financeTransaction.updateMany({
          where: {
            userId: institution!.userId,
            externalId: txn.transactionId,
          },
          data: {
            name: txn.name,
            merchantName: cleaned,
            amount: txn.amount,
            isPending: txn.pending,
          },
        })
        totalModified++
      }

      for (const txId of result.removed) {
        await tx.financeTransaction.deleteMany({
          where: {
            userId: institution!.userId,
            externalId: txId,
          },
        })
        totalRemoved++
      }

      await tx.financeInstitution.update({
        where: { id: institution!.id },
        data: { syncCursor: result.nextCursor },
      })
    })

    cursor = result.nextCursor
    hasMore = result.hasMore
  }

  await db.financeInstitution.update({
    where: { id: institution!.id },
    data: {
      lastSyncedAt: new Date(),
      status: "active",
      errorCode: null,
      errorMessage: null,
    },
  })

  return {
    institutionId: institution!.id,
    provider: "plaid",
    accountsUpdated: plaidAccounts.length,
    transactionsAdded: totalAdded,
    transactionsModified: totalModified,
    transactionsRemoved: totalRemoved,
    error: null,
  }
}

/**
 * Fetch full transaction history for all Plaid institutions using transactionsGet.
 * Pulls up to 2 years of history and inserts any missing transactions.
 */
export async function fetchFullPlaidHistory(userId: string): Promise<{ fetched: number; inserted: number }> {
  const institutions = await db.financeInstitution.findMany({
    where: { userId, provider: "plaid", status: "active" },
  })

  const accountMap = new Map<string, string>()
  const allAccounts = await db.financeAccount.findMany({
    where: { userId, institutionId: { in: institutions.map((i) => i.id) } },
    select: { id: true, externalId: true },
  })
  for (const a of allAccounts) {
    accountMap.set(a.externalId, a.id)
  }

  const userRules = await db.financeCategoryRule.findMany({
    where: { userId },
    orderBy: { priority: "desc" },
  })

  const endDate = new Date().toISOString().split("T")[0]
  const startDateObj = new Date()
  startDateObj.setFullYear(startDateObj.getFullYear() - 2)
  const startDate = startDateObj.toISOString().split("T")[0]

  let totalFetched = 0
  let totalInserted = 0

  for (const inst of institutions) {
    if (!inst.plaidAccessToken) continue
    const accessToken = await decryptCredential(inst.plaidAccessToken)
    const { transactions, totalTransactions } = await withRetry(() =>
      plaid.getTransactions(userId, accessToken, startDate, endDate)
    )
    totalFetched += totalTransactions

    const existingExternalIds = new Set(
      (await db.financeTransaction.findMany({
        where: { userId, provider: "plaid" },
        select: { externalId: true },
      })).map((t) => t.externalId)
    )

    const newTxs = transactions.filter((tx) => !existingExternalIds.has(tx.transactionId))

    if (newTxs.length === 0) continue

    for (let i = 0; i < newTxs.length; i += 200) {
      const batch = newTxs.slice(i, i + 200)
      await db.financeTransaction.createMany({
        data: batch.map((tx) => {
          const internalAccountId = accountMap.get(tx.accountId)
          if (!internalAccountId) return null
          const cleaned = cleanMerchantName(tx.merchantName ?? tx.name)
          const cat = categorizeTransaction(
            {
              merchantName: cleaned,
              rawName: tx.name,
              plaidCategory: tx.personalFinanceCategory
                ? `${tx.personalFinanceCategory.primary}|${tx.personalFinanceCategory.detailed}`
                : null,
              amount: tx.amount,
            },
            userRules,
          )
          return {
            userId,
            accountId: internalAccountId,
            externalId: tx.transactionId,
            provider: "plaid" as const,
            date: new Date(tx.date),
            name: tx.name,
            merchantName: cleaned,
            amount: tx.amount,
            currency: tx.isoCurrencyCode ?? "USD",
            category: cat.category === "Uncategorized" ? null : cat.category,
            subcategory: cat.subcategory,
            plaidCategory: tx.personalFinanceCategory?.detailed ?? null,
            plaidCategoryPrimary: tx.personalFinanceCategory?.primary ?? null,
            isPending: tx.pending,
            authorizedDate: tx.authorizedDate ? new Date(tx.authorizedDate) : null,
            paymentChannel: tx.paymentChannel,
            merchantEntityId: tx.merchantEntityId,
            logoUrl: tx.logoUrl,
            website: tx.website,
            checkNumber: tx.checkNumber,
            transactionCode: tx.transactionCode,
            location: tx.location ?? undefined,
            paymentMeta: tx.paymentMeta ?? undefined,
            counterparties: tx.counterparties ?? undefined,
          }
        }).filter((t): t is NonNullable<typeof t> => t !== null),
        skipDuplicates: true,
      })
    }

    totalInserted += newTxs.filter((tx) => accountMap.has(tx.accountId)).length
  }

  if (totalInserted > 0) {
    const { saveFinanceSnapshot, backfillHistoricalSnapshots } = await import("./snapshots")
    await db.financeSnapshot.deleteMany({ where: { userId } })
    await saveFinanceSnapshot(userId)
    await backfillHistoricalSnapshots(userId)
  }

  return { fetched: totalFetched, inserted: totalInserted }
}
