/**
 * SimpleFIN-specific sync logic.
 *
 * SimpleFIN returns ALL accounts from ALL linked banks through one access URL.
 * We group accounts by org name so each bank becomes its own institution.
 */

import { db } from "@/lib/db"
import { decryptCredential } from "../crypto"
import {
  getAccountsAndTransactions,
  normalizeSimpleFINData,
} from "../simplefin-client"
import { resolveInstitutionLogo } from "../institution-logos"
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

  // Always fetch 90-day window. Don't use lastSyncedAt as start-date —
  // if first sync returned 0 transactions, lastSyncedAt was set anyway
  // and all future syncs would only look forward from that empty point.
  const raw = await withRetry(() =>
    getAccountsAndTransactions(accessUrl)
  )

  const allNormalized = normalizeSimpleFINData(raw)

  console.log(
    `[SimpleFIN] Fetched ${raw.accounts.length} accounts, ` +
    `${raw.accounts.reduce((n, a) => n + a.transactions.length, 0)} transactions (90-day window, pending included)`
  )

  // Diagnostic logging: per-org stats
  const orgStats = new Map<string, { accounts: number; transactions: number }>()
  for (const acct of allNormalized.accounts) {
    const existing = orgStats.get(acct.institutionName) ?? { accounts: 0, transactions: 0 }
    orgStats.set(acct.institutionName, { accounts: existing.accounts + 1, transactions: existing.transactions })
  }
  for (const txn of allNormalized.transactions) {
    const acct = allNormalized.accounts.find((a) => a.externalId === txn.accountExternalId)
    if (!acct) continue
    const existing = orgStats.get(acct.institutionName)
    if (existing) {
      orgStats.set(acct.institutionName, { ...existing, transactions: existing.transactions + 1 })
    }
  }
  for (const [org, stats] of orgStats) {
    const suffix = stats.transactions === 0 ? " — bank may not support transaction data" : ""
    console.log(`[SimpleFIN] ${org}: ${stats.accounts} accounts, ${stats.transactions} transactions${suffix}`)
  }
  if (raw.errors.length > 0) {
    console.warn(`[SimpleFIN] API errors: ${raw.errors.join("; ")}`)
  }

  // Group raw accounts by org name — each org becomes its own institution
  const accountsByOrg = new Map<string, typeof raw.accounts>()
  for (const acct of raw.accounts) {
    const orgName = acct.org?.name ?? "SimpleFIN Bank"
    const existing = accountsByOrg.get(orgName) ?? []
    accountsByOrg.set(orgName, [...existing, acct])
  }

  const userRules = await db.financeCategoryRule.findMany({
    where: { userId: institution!.userId },
  })

  let totalAdded = 0
  let totalAccountsUpdated = 0

  // Process each org group — route accounts to the correct institution
  for (const [orgName, orgAccounts] of accountsByOrg) {
    const normalized = normalizeSimpleFINData({ errors: [], accounts: orgAccounts })

    // Find or create the institution for this org
    let targetInst = orgName === institution!.institutionName
      ? institution!
      : await db.financeInstitution.findFirst({
          where: { userId: institution!.userId, provider: "simplefin", institutionName: orgName },
        })

    if (!targetInst) {
      const orgUrl = orgAccounts[0]?.org?.url ?? null
      const logoUrl = resolveInstitutionLogo(null, null, orgName) ?? orgUrl
      targetInst = await db.financeInstitution.create({
        data: {
          userId: institution!.userId,
          provider: "simplefin",
          institutionName: orgName,
          institutionLogo: logoUrl,
          simplefinAccessUrl: institution!.simplefinAccessUrl,
          status: "active",
        },
      })
    }

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
            institutionId: targetInst!.id,
            externalId: acct.externalId,
            name: acct.accountName,
            type: acct.type,
            mask: acct.mask,
            currentBalance: acct.currentBalance,
            availableBalance: acct.availableBalance,
            currency: acct.currency,
          },
          update: {
            institutionId: targetInst!.id,
            name: acct.accountName,
            type: acct.type,
            mask: acct.mask,
            currentBalance: acct.currentBalance,
            availableBalance: acct.availableBalance,
          },
        })
        totalAccountsUpdated++
      }

      // Find all accounts under this institution for transaction matching
      const dbAccounts = await tx.financeAccount.findMany({
        where: { institutionId: targetInst!.id },
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
            isPending: txn.isPending,
          },
          update: {
            merchantName: cleaned,
            amount: txn.amount,
            isPending: txn.isPending,
          },
        })
        totalAdded++
      }

      await tx.financeInstitution.update({
        where: { id: targetInst!.id },
        data: {
          lastSyncedAt: new Date(),
          status: "active",
          errorCode: null,
          errorMessage: null,
        },
      })
    })
  }

  return {
    institutionId: institution!.id,
    provider: "simplefin",
    accountsUpdated: totalAccountsUpdated,
    transactionsAdded: totalAdded,
    transactionsModified: 0,
    transactionsRemoved: 0,
    error: null,
  }
}
