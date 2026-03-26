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
import { detectTransfers } from "../transfer-detection"
import type { SyncResult } from "./helpers"

const CREDIT_CARD_PATTERNS = [
  /\bcard\b/i,
  /\bcredit\b/i,
  /\bplatinum\b/i,
  /\bsapphire\b/i,
  /\bfreedom\b/i,
  /\bink\b/i,
  /\bventure\b/i,
  /\bdiscover\b/i,
  /\bquicksilver\b/i,
  /\bstrata\b/i,
  /\baadvantage\b/i,
  /\bbilt\b/i,
  /\bapple card\b/i,
  /\bsavorone\b/i,
  /\bdouble cash\b/i,
  /\bcash rewards\b/i,
  /\brewards.*mastercard\b/i,
  /\bworld elite\b/i,
  /\bpremier.*card\b/i,
]

function looksLikeCreditCard(name: string): boolean {
  return CREDIT_CARD_PATTERNS.some((p) => p.test(name))
}

// SimpleFIN data refreshes at most once per day. Throttle API calls to stay
// well under their 24-request/day limit. With a 2-hour interval we make at
// most 12 calls/day per user, and redundant calls for sibling institutions
// (which share the same access URL) are also suppressed since all
// institutions get their lastSyncedAt updated in the same sync cycle.
const SIMPLEFIN_MIN_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000 // 2 hours

export async function syncSimpleFIN(
  institution: Awaited<ReturnType<typeof db.financeInstitution.findUnique>> & { accounts: Array<{ id: string; externalId: string }> }
): Promise<SyncResult> {
  if (!institution!.simplefinAccessUrl) {
    throw new Error("No SimpleFIN access URL")
  }

  // Throttle: skip if this institution was synced recently
  if (institution!.lastSyncedAt) {
    const sinceLastSync = Date.now() - new Date(institution!.lastSyncedAt).getTime()
    if (sinceLastSync < SIMPLEFIN_MIN_SYNC_INTERVAL_MS) {
      console.log(
        `[SimpleFIN] Skipping sync for "${institution!.institutionName}" — ` +
        `last synced ${Math.round(sinceLastSync / 60000)}m ago (min interval: 2h)`
      )
      return {
        institutionId: institution!.id,
        provider: "simplefin",
        accountsUpdated: 0,
        transactionsAdded: 0,
        transactionsModified: 0,
        transactionsRemoved: 0,
        error: null,
      }
    }
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
    console.warn(`[SimpleFIN] API errors: ${raw.errors.map((e) => String(e).slice(0, 200)).join("; ")}`)
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
            subtype: acct.subtype,
            mask: acct.mask,
            currentBalance: acct.currentBalance,
            availableBalance: acct.availableBalance,
            creditLimit: acct.creditLimit,
            currency: acct.currency,
          },
          update: {
            institutionId: targetInst!.id,
            name: acct.accountName,
            type: acct.type,
            subtype: acct.subtype,
            mask: acct.mask,
            currentBalance: acct.currentBalance,
            availableBalance: acct.availableBalance,
            creditLimit: acct.creditLimit,
          },
        })
        totalAccountsUpdated++
      }

      // Create investment balance snapshots for chart history
      // SimpleFIN doesn't provide individual holdings, so we create
      // a single "account balance" snapshot per investment account
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      const investmentAccounts = normalized.accounts.filter((a) => a.type === "investment")
      for (const invAcct of investmentAccounts) {
        const dbAcct = await tx.financeAccount.findFirst({
          where: { userId: institution!.userId, externalId: invAcct.externalId },
        })
        if (!dbAcct || invAcct.currentBalance <= 0) continue

        await tx.financeInvestmentHoldingSnapshot.upsert({
          where: {
            userId_accountId_securityId_date: {
              userId: institution!.userId,
              accountId: dbAcct.id,
              securityId: `simplefin_balance_${dbAcct.id}`,
              date: today,
            },
          },
          create: {
            userId: institution!.userId,
            accountId: dbAcct.id,
            securityId: `simplefin_balance_${dbAcct.id}`,
            date: today,
            quantity: 1,
            institutionPrice: invAcct.currentBalance,
            institutionValue: invAcct.currentBalance,
            costBasis: null,
          },
          update: {
            institutionPrice: invAcct.currentBalance,
            institutionValue: invAcct.currentBalance,
          },
        })
      }

      // Find all accounts under this institution for transaction matching
      const dbAccounts = await tx.financeAccount.findMany({
        where: { institutionId: targetInst!.id },
      })

      for (const txn of normalized.transactions) {
        const account = dbAccounts.find((a) => a.externalId === txn.accountExternalId)
        if (!account) continue

        const cleaned = cleanMerchantName(txn.merchantName || txn.rawName)
        // FIX Bug 8: Pass accountType + amount so hard rules fire for CC payments/transfers
        const cat = categorizeTransaction(
          {
            merchantName: cleaned,
            rawName: txn.rawName,
            amount: txn.amount,
            accountType: account.type ?? "depository",
            accountSubtype: account.subtype ?? null,
          },
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
            currency: txn.currency,
            // FIX Bug 12: Store null instead of "Uncategorized" string
            category: cat.category === "Uncategorized" ? null : cat.category,
            subcategory: cat.subcategory,
            isAutoApplied: ["hard_rule", "rule", "keyword", "merchant_map"].includes(cat.source),
            needsReview: cat.needsReview,
            isPending: txn.isPending,
            notes: txn.memo,
          },
          update: {
            merchantName: cleaned,
            amount: txn.amount,
            currency: txn.currency,
            isPending: txn.isPending,
            notes: txn.memo,
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

  // Detect internal transfers (e.g. checking→savings) and mark them excluded
  // so they don't skew spending analysis. Runs after all transactions are upserted.
  await detectTransfers(institution!.userId)

  // Auto-create CreditCardProfile for SimpleFIN credit accounts that don't have one yet.
  // SimpleFIN sometimes misclassifies credit cards as "checking", so we also detect
  // cards by institution name and account name patterns.
  const allSimplefinAccounts = await db.financeAccount.findMany({
    where: {
      userId: institution!.userId,
      institution: { provider: "simplefin" },
    },
    select: { id: true, name: true, mask: true, creditLimit: true, institutionId: true, type: true },
  })
  const institutionNames = new Map<string, string>()
  for (const a of allSimplefinAccounts) {
    if (!institutionNames.has(a.institutionId)) {
      const inst = await db.financeInstitution.findUnique({
        where: { id: a.institutionId },
        select: { institutionName: true },
      })
      institutionNames.set(a.institutionId, inst?.institutionName ?? "")
    }
  }
  const creditAccounts = allSimplefinAccounts.filter((a) => {
    if (a.type === "credit" || a.type === "business_credit") return true
    const instName = institutionNames.get(a.institutionId) ?? ""
    return looksLikeCreditCard(a.name) || looksLikeCreditCard(instName)
  })
  if (creditAccounts.length > 0) {
    const existingProfiles = await db.creditCardProfile.findMany({
      where: { userId: institution!.userId, accountId: { in: creditAccounts.map((a) => a.id) } },
      select: { accountId: true },
    })
    const profiledIds = new Set(existingProfiles.map((p) => p.accountId))

    for (const acct of creditAccounts) {
      if (profiledIds.has(acct.id)) continue

      // Fix misclassified account type so the rest of the app treats it as credit
      if (acct.type !== "credit" && acct.type !== "business_credit") {
        await db.financeAccount.update({
          where: { id: acct.id },
          data: { type: "credit" },
        }).catch(() => { /* ignore if locked */ })
      }

      const inst = await db.financeInstitution.findUnique({
        where: { id: acct.institutionId },
        select: { institutionName: true },
      })
      const instName = inst?.institutionName?.toLowerCase() ?? ""
      const acctName = acct.name?.toLowerCase() ?? ""
      const network = instName.includes("amex") || instName.includes("american express") ? "amex"
        : instName.includes("discover") ? "discover"
        : acctName.includes("mastercard") || instName.includes("mastercard") ? "mastercard"
        : "visa"
      const cardName = acct.name && acct.name.length > 3
        ? acct.name
        : `${inst?.institutionName ?? "Card"} ••••${acct.mask ?? ""}`

      await db.creditCardProfile.create({
        data: {
          userId: institution!.userId,
          accountId: acct.id,
          cardName,
          cardNetwork: network,
          rewardType: "cashback",
          baseRewardRate: 1,
          annualFee: 0,
          bonusCategories: [],
        },
      }).catch(() => { /* ignore duplicate */ })
    }
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
