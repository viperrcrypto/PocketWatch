/**
 * Shared helpers and types for the finance sync module.
 */

import { db } from "@/lib/db"
import {
  deduplicateAccounts,
  deduplicateTransactions,
  type NormalizedAccount,
  type NormalizedTransaction,
} from "../normalize"

export interface SyncResult {
  institutionId: string
  provider: string
  accountsUpdated: number
  transactionsAdded: number
  transactionsModified: number
  transactionsRemoved: number
  error: string | null
}

export function toNormalizedAccount(account: {
  externalId: string
  name: string
  type: string
  mask: string | null
  currentBalance: number | null
  availableBalance: number | null
  creditLimit: number | null
  currency: string
  institution: { provider: string; institutionName: string }
}): NormalizedAccount {
  return {
    externalId: account.externalId,
    provider: account.institution.provider as "plaid" | "simplefin",
    institutionName: account.institution.institutionName,
    accountName: account.name,
    type: account.type,
    mask: account.mask,
    currentBalance: account.currentBalance ?? 0,
    availableBalance: account.availableBalance,
    creditLimit: account.creditLimit,
    currency: account.currency,
  }
}

export function toNormalizedTransaction(tx: {
  externalId: string
  provider: string
  accountId: string
  date: Date
  merchantName: string | null
  name: string
  amount: number
  isPending: boolean
  category: string | null
  plaidCategory: string | null
}): NormalizedTransaction {
  return {
    externalId: tx.externalId,
    provider: tx.provider as "plaid" | "simplefin",
    accountExternalId: tx.accountId,
    date: tx.date.toISOString().slice(0, 10),
    merchantName: tx.merchantName ?? tx.name,
    rawName: tx.name,
    amount: tx.amount,
    isPending: tx.isPending,
    category: tx.category,
    plaidCategory: tx.plaidCategory,
  }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

/**
 * Reconcile cross-provider duplicates by linking matching accounts and
 * marking SimpleFIN transactions as duplicates where Plaid covers the same data.
 */
export async function reconcileProviderDuplicates(userId: string): Promise<void> {
  const accounts = await db.financeAccount.findMany({
    where: {
      userId,
      institution: { status: { not: "disconnected" } },
    },
    include: {
      institution: {
        select: {
          provider: true,
          institutionName: true,
          status: true,
        },
      },
    },
  })

  const linkMap = new Map<string, string | null>()
  for (const account of accounts) {
    linkMap.set(account.externalId, null)
  }

  const normalizedAccounts = accounts
    .filter((account) => account.institution.provider === "plaid" || account.institution.provider === "simplefin")
    .map(toNormalizedAccount)

  const deduplicated = deduplicateAccounts(normalizedAccounts)
  for (const pair of deduplicated) {
    if (!pair.linked) continue
    linkMap.set(pair.primary.externalId, pair.linked.externalId)
    linkMap.set(pair.linked.externalId, pair.primary.externalId)
  }

  const accountByExternalId = new Map(accounts.map((account) => [account.externalId, account]))
  const duplicateSimplefinExternalIds = new Set<string>()

  const linkedAccountIds = new Set<string>()
  for (const pair of deduplicated) {
    if (!pair.linked) continue
    const primary = accountByExternalId.get(pair.primary.externalId)
    const linked = accountByExternalId.get(pair.linked.externalId)
    if (primary) linkedAccountIds.add(primary.id)
    if (linked) linkedAccountIds.add(linked.id)
  }

  const allLinkedTxRows = linkedAccountIds.size > 0
    ? await db.financeTransaction.findMany({
        where: {
          userId,
          accountId: { in: Array.from(linkedAccountIds) },
        },
        select: {
          externalId: true,
          provider: true,
          accountId: true,
          date: true,
          merchantName: true,
          name: true,
          amount: true,
          isPending: true,
          category: true,
          plaidCategory: true,
        },
      })
    : []

  const txByAccountId = new Map<string, typeof allLinkedTxRows>()
  for (const tx of allLinkedTxRows) {
    const arr = txByAccountId.get(tx.accountId) ?? []
    arr.push(tx)
    txByAccountId.set(tx.accountId, arr)
  }

  for (const pair of deduplicated) {
    if (!pair.linked) continue
    const primary = accountByExternalId.get(pair.primary.externalId)
    const linked = accountByExternalId.get(pair.linked.externalId)
    if (!primary || !linked) continue

    const txRows = [
      ...(txByAccountId.get(primary.id) ?? []),
      ...(txByAccountId.get(linked.id) ?? []),
    ]

    const dedupedTx = deduplicateTransactions(txRows.map(toNormalizedTransaction))
    for (const item of dedupedTx) {
      if (item.isDuplicate && item.transaction.provider === "simplefin") {
        duplicateSimplefinExternalIds.add(item.transaction.externalId)
      }
    }
  }

  await db.$transaction(async (tx) => {
    for (const account of accounts) {
      await tx.financeAccount.updateMany({
        where: {
          userId,
          externalId: account.externalId,
        },
        data: {
          linkedExternalId: linkMap.get(account.externalId) ?? null,
        },
      })
    }

    await tx.financeTransaction.updateMany({
      where: {
        userId,
        provider: "simplefin",
        isDuplicate: true,
      },
      data: {
        isDuplicate: false,
      },
    })

    const duplicateIds = Array.from(duplicateSimplefinExternalIds)
    for (const ids of chunk(duplicateIds, 500)) {
      await tx.financeTransaction.updateMany({
        where: {
          userId,
          provider: "simplefin",
          externalId: { in: ids },
        },
        data: {
          isDuplicate: true,
        },
      })
    }
  })
}
