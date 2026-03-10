/**
 * SimpleFIN-specific sync logic.
 */

import { db } from "@/lib/db"
import { decryptCredential } from "../crypto"
import {
  getAccountsAndTransactions,
  normalizeSimpleFINData,
} from "../simplefin-client"
import { categorizeTransaction, cleanMerchantName } from "../categorize"
import { withRetry } from "../retry"
import type { SyncResult } from "./helpers"

export async function syncSimpleFIN(
  institution: Awaited<ReturnType<typeof db.financeInstitution.findUnique>> & { accounts: Array<{ id: string; externalId: string }> }
): Promise<SyncResult> {
  if (!institution!.simplefinAccessUrl) {
    throw new Error("No SimpleFIN access URL")
  }

  const accessUrl = await decryptCredential(institution!.simplefinAccessUrl)
  const since = institution!.lastSyncedAt ?? undefined

  const raw = await withRetry(() =>
    getAccountsAndTransactions(accessUrl, since ?? undefined)
  )
  const normalized = normalizeSimpleFINData(raw)

  const userRules = await db.financeCategoryRule.findMany({
    where: { userId: institution!.userId },
  })

  let totalAdded = 0

  await db.$transaction(async (tx) => {
    for (const acct of normalized.accounts) {
      await tx.financeAccount.upsert({
        where: {
          userId_externalId: {
            userId: institution!.userId,
            externalId: acct.externalId,
          },
        },
        create: {
          userId: institution!.userId,
          institutionId: institution!.id,
          externalId: acct.externalId,
          name: acct.accountName,
          type: acct.type,
          currentBalance: acct.currentBalance,
          availableBalance: acct.availableBalance,
          currency: acct.currency,
        },
        update: {
          currentBalance: acct.currentBalance,
          availableBalance: acct.availableBalance,
        },
      })
    }

    const dbAccounts = await tx.financeAccount.findMany({
      where: { institutionId: institution!.id },
    })

    for (const txn of normalized.transactions) {
      const account = dbAccounts.find((a) => a.externalId === txn.accountExternalId)
      if (!account) continue

      const cleaned = cleanMerchantName(txn.merchantName || txn.rawName)
      const cat = categorizeTransaction(
        { merchantName: cleaned, rawName: txn.rawName },
        userRules
      )

      await tx.financeTransaction.upsert({
        where: {
          userId_externalId: {
            userId: institution!.userId,
            externalId: txn.externalId,
          },
        },
        create: {
          userId: institution!.userId,
          accountId: account.id,
          externalId: txn.externalId,
          provider: "simplefin",
          date: new Date(txn.date),
          name: txn.rawName,
          merchantName: cleaned,
          amount: txn.amount,
          category: cat.category,
          subcategory: cat.subcategory,
          isPending: false,
        },
        update: {
          merchantName: cleaned,
          amount: txn.amount,
        },
      })
      totalAdded++
    }

    await tx.financeInstitution.update({
      where: { id: institution!.id },
      data: {
        lastSyncedAt: new Date(),
        status: "active",
        errorCode: null,
        errorMessage: null,
      },
    })
  })

  return {
    institutionId: institution!.id,
    provider: "simplefin",
    accountsUpdated: normalized.accounts.length,
    transactionsAdded: totalAdded,
    transactionsModified: 0,
    transactionsRemoved: 0,
    error: null,
  }
}
