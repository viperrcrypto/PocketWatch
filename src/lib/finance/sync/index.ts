/**
 * Barrel re-export for finance sync module.
 * All public types and functions are re-exported for backward compatibility.
 */

import { db } from "@/lib/db"
import { reconcileProviderDuplicates, type SyncResult } from "./helpers"
import { syncPlaid } from "./plaid-sync"
import { syncSimpleFIN } from "./simplefin-sync"
import { saveFinanceSnapshot } from "./snapshots"

export type { SyncResult } from "./helpers"
export { reconcileProviderDuplicates } from "./helpers"
export { syncPlaid } from "./plaid-sync"
export { fetchFullPlaidHistory } from "./plaid-sync"
export { syncSimpleFIN } from "./simplefin-sync"
export { saveFinanceSnapshot, backfillHistoricalSnapshots } from "./snapshots"

/**
 * Sync a single institution (Plaid or SimpleFIN).
 */
export async function syncInstitution(
  institutionId: string,
  options?: { skipReconcile?: boolean }
): Promise<SyncResult> {
  const institution = await db.financeInstitution.findUnique({
    where: { id: institutionId },
    include: { accounts: true },
  })

  if (!institution) {
    return {
      institutionId,
      provider: "unknown",
      accountsUpdated: 0,
      transactionsAdded: 0,
      transactionsModified: 0,
      transactionsRemoved: 0,
      error: "Institution not found",
    }
  }

  try {
    const result = institution.provider === "plaid"
      ? await syncPlaid(institution)
      : await syncSimpleFIN(institution)

    if (!options?.skipReconcile) {
      try {
        await reconcileProviderDuplicates(institution.userId)
      } catch (reconcileErr) {
        console.warn("[finance.sync.reconcile.failed]", {
          userId: institution.userId,
          institutionId,
          message: reconcileErr instanceof Error ? reconcileErr.message : "Unknown reconcile error",
        })
      }
    }

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error"
    await db.financeInstitution.update({
      where: { id: institutionId },
      data: { status: "error", errorMessage: message },
    })
    return {
      institutionId,
      provider: institution.provider,
      accountsUpdated: 0,
      transactionsAdded: 0,
      transactionsModified: 0,
      transactionsRemoved: 0,
      error: message,
    }
  }
}

/**
 * Sync all institutions for a user.
 */
export async function syncAllInstitutions(
  userId: string
): Promise<SyncResult[]> {
  const institutions = await db.financeInstitution.findMany({
    where: { userId, status: { not: "disconnected" } },
  })

  const results: SyncResult[] = []
  for (const inst of institutions) {
    const result = await syncInstitution(inst.id, { skipReconcile: true })
    results.push(result)
  }

  await reconcileProviderDuplicates(userId)

  await saveFinanceSnapshot(userId)

  return results
}
