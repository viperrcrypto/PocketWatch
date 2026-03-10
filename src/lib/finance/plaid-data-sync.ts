/**
 * Comprehensive Plaid data sync -- fetches ALL available data products
 * (identity, liabilities, investments, recurring) and stores both raw
 * encrypted backups and structured models.
 */

import { db } from "@/lib/db"
import { decryptCredential } from "./crypto"
import { withRetry } from "./retry"
import * as plaid from "./plaid-client"
import { storeRawSnapshot } from "./plaid-sync-helpers"
import type { InstitutionReport, InstitutionSyncContext } from "./plaid-sync-helpers"
import { syncIdentity, syncLiabilities, syncInvestments, syncRecurring } from "./plaid-sync-products"

export interface PlaidSyncReport {
  institutions: Array<{
    institutionId: string
    name: string
    availableProducts: string[]
    synced: string[]
    skipped: string[]
    errors: string[]
  }>
}

export async function syncAllPlaidData(userId: string): Promise<PlaidSyncReport> {
  const institutions = await db.financeInstitution.findMany({
    where: { userId, provider: "plaid", status: "active" },
    include: { accounts: { select: { id: true, externalId: true } } },
  })

  const report: PlaidSyncReport = { institutions: [] }

  for (const inst of institutions) {
    if (!inst.plaidAccessToken) continue
    const accessToken = await decryptCredential(inst.plaidAccessToken)

    const instReport: InstitutionReport = {
      institutionId: inst.id,
      name: inst.institutionName,
      availableProducts: [] as string[],
      synced: [] as string[],
      skipped: [] as string[],
      errors: [] as string[],
    }

    // 1. Get item info to discover available products
    try {
      const itemInfo = await withRetry(() => plaid.getItemInfo(userId, accessToken))
      instReport.availableProducts = [...itemInfo.availableProducts, ...itemInfo.billedProducts]
      await storeRawSnapshot(userId, inst.id, "item", itemInfo)
    } catch (err) {
      instReport.errors.push(`item: ${err instanceof Error ? err.message : "unknown"}`)
    }

    const ctx: InstitutionSyncContext = {
      userId,
      institutionId: inst.id,
      accessToken,
      accountMap: new Map(inst.accounts.map((a) => [a.externalId, a.id])),
      accountExternalIds: inst.accounts.map((a) => a.externalId),
      availableProducts: new Set(instReport.availableProducts),
    }

    // 2-5. Sync each product
    await syncIdentity(ctx, instReport)
    await syncLiabilities(ctx, instReport)
    await syncInvestments(ctx, instReport)
    await syncRecurring(ctx, instReport)

    report.institutions.push(instReport)
  }

  console.info("[plaid.comprehensive.complete]", {
    userId,
    institutions: report.institutions.map((i) => ({
      name: i.name, synced: i.synced, skipped: i.skipped, errors: i.errors,
    })),
  })

  return report
}
