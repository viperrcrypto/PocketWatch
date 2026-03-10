import {
  encrypt,
  decrypt,
  isEncryptionConfigured,
  encryptWithKey,
  decryptWithKey,
  importKeyFromHex,
} from "./crypto"
import { getCurrentUserKey } from "./encryption-context"

type FieldType = "string" | "json"

// Only String and Json fields are encrypted at rest.
// Float fields (amounts, balances, totals) stay plaintext for SQL aggregation.
export const ENCRYPTED_FIELDS: Record<string, Record<string, FieldType>> = {
  FinanceTransaction: {
    notes: "string",
    location: "json",
    paymentMeta: "json",
    counterparties: "json",
    checkNumber: "string",
  },
  FinanceAccount: { officialName: "string" },
  FinanceSnapshot: { breakdown: "json" },
  TrackedWallet: { label: "string" },
  BalanceSnapshot: { positions: "json" },
  PortfolioSnapshot: { metadata: "json" },
  AddressLabel: { name: "string" },
}

/**
 * Serialize a field value for DB storage (Json→String).
 * For "json" fields, stringify objects. For "string" fields, pass through.
 * Used on ALL writes regardless of encryption status.
 */
export function serializeField(value: unknown, fieldType: FieldType): string | null {
  if (value === null || value === undefined) return null
  if (fieldType === "json" && typeof value === "object") {
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Deserialize a field value from DB storage (String→Json).
 * For "json" fields, parse strings back to objects. For "string" fields, pass through.
 * Used on ALL reads regardless of encryption status.
 */
export function deserializeField(value: unknown, fieldType: FieldType): unknown {
  if (value === null || value === undefined) return null
  if (fieldType === "json" && typeof value === "string") {
    return JSON.parse(value)
  }
  return value
}

export async function encryptField(value: unknown): Promise<string | null> {
  if (value === null || value === undefined) return null
  const str =
    typeof value === "object" ? JSON.stringify(value) : String(value)

  // Prefer per-user key if available, fall back to global key
  const userKeyHex = getCurrentUserKey()
  if (userKeyHex) {
    const key = await importKeyFromHex(userKeyHex)
    return encryptWithKey(str, key)
  }
  return encrypt(str)
}

export async function decryptField(
  encrypted: string | null,
  fieldType: FieldType
): Promise<unknown> {
  if (encrypted === null || encrypted === undefined) return null

  // Prefer per-user key if available, fall back to global key
  const userKeyHex = getCurrentUserKey()
  let str: string
  if (userKeyHex) {
    const key = await importKeyFromHex(userKeyHex)
    str = await decryptWithKey(encrypted, key)
  } else {
    str = await decrypt(encrypted)
  }

  switch (fieldType) {
    case "json":
      return JSON.parse(str)
    case "string":
      return str
  }
}

export function getModelFields(model: string): Record<string, FieldType> | undefined {
  return ENCRYPTED_FIELDS[model]
}

export { isEncryptionConfigured }
