/**
 * Shared helpers for Plaid data sync modules.
 */

import { db } from "@/lib/db"
import { encryptCredential } from "./crypto"

export function isPlaidProductError(err: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Plaid SDK error shape
  const code = (err as any)?.response?.data?.error_code
  return [
    "PRODUCTS_NOT_READY",
    "PRODUCT_NOT_ENABLED",
    "INVALID_PRODUCT",
    "PRODUCTS_NOT_SUPPORTED",
    "PRODUCT_NOT_READY",
  ].includes(code)
}

export async function storeRawSnapshot(
  userId: string,
  institutionId: string,
  dataType: string,
  data: unknown,
): Promise<void> {
  const encrypted = await encryptCredential(JSON.stringify(data))
  await db.plaidDataSnapshot.upsert({
    where: { userId_institutionId_dataType: { userId, institutionId, dataType } },
    create: { userId, institutionId, dataType, encryptedData: encrypted },
    update: { encryptedData: encrypted, fetchedAt: new Date() },
  })
}

export interface InstitutionSyncContext {
  userId: string
  institutionId: string
  accessToken: string
  accountMap: Map<string, string>
  accountExternalIds: string[]
  availableProducts: Set<string>
}

export interface InstitutionReport {
  institutionId: string
  name: string
  availableProducts: string[]
  synced: string[]
  skipped: string[]
  errors: string[]
}
