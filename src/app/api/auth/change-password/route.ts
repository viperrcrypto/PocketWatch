import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import {
  getCurrentUser,
  getSession,
  verifyPassword,
  hashPassword,
  createSession,
  provisionEncryptionSalt,
} from "@/lib/auth"
import { deriveKey, unwrapDek } from "@/lib/per-user-crypto"
import { isEncryptionConfigured, importKeyFromHex, encryptWithKey, decryptWithKey } from "@/lib/crypto"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { db } from "@/lib/db"
import { ENCRYPTED_FIELDS } from "@/lib/encryption-fields"

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E1120", "Authentication required", 401)

  const rl = rateLimit(`auth:change-pw:${user.id}`, { limit: 5, windowSeconds: 300 })
  if (!rl.success) {
    return apiError("E1121", "Too many attempts. Try again later.", 429, undefined, rateLimitHeaders(rl))
  }

  try {
    const body = await request.json().catch(() => null)
    if (
      !body ||
      typeof body.currentPassword !== "string" ||
      typeof body.newPassword !== "string"
    ) {
      return apiError("E1122", "Current password and new password are required.", 400)
    }

    if (body.newPassword.length < 8) {
      return apiError("E1123", "New password must be at least 8 characters.", 400)
    }

    // Verify current password
    const valid = await verifyPassword(body.currentPassword, user.passwordHash)
    if (!valid) {
      return apiError("E1124", "Current password is incorrect.", 401)
    }

    // Hash new password
    const newHash = await hashPassword(body.newPassword)

    // Re-encrypt user data if per-user encryption is active
    if (user.encryptionSalt && isEncryptionConfigured()) {
      const session = await getSession()
      const oldDekHex = session?.encryptedDek
        ? await unwrapDek(session.encryptedDek)
        : await deriveKey(body.currentPassword, user.encryptionSalt)

      // Generate new salt + derive new key
      const newSalt = provisionEncryptionSalt()
      const newDekHex = await deriveKey(body.newPassword, newSalt)

      const oldKey = await importKeyFromHex(oldDekHex)
      const newKey = await importKeyFromHex(newDekHex)

      // Re-encrypt all user data
      await reEncryptUserData(user.id, oldKey, newKey)

      // Update user with new password hash and salt
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, encryptionSalt: newSalt },
      })

      // Delete all old sessions, create new one with new DEK
      await db.session.deleteMany({ where: { userId: user.id } })
      await createSession(user.id, newDekHex)
    } else {
      // No per-user encryption — just update password
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      })

      // Invalidate old sessions, create new
      await db.session.deleteMany({ where: { userId: user.id } })
      await createSession(user.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E1129", "Password change failed", 500, error)
  }
}

/**
 * Re-encrypt all encrypted fields for a user from oldKey to newKey.
 */
async function reEncryptUserData(
  userId: string,
  oldKey: CryptoKey,
  newKey: CryptoKey,
): Promise<void> {
  for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    const fieldNames = Object.keys(fields)
    if (fieldNames.length === 0) continue

    const records = await fetchRecordsForModel(model, userId, fieldNames)
    for (const record of records) {
      const updates: Record<string, string | null> = {}
      let hasChanges = false

      for (const field of fieldNames) {
        const val = record[field]
        if (typeof val !== "string" || !val) continue

        try {
          const plain = await decryptWithKey(val, oldKey)
          updates[field] = await encryptWithKey(plain, newKey)
          hasChanges = true
        } catch {
          // Field might be encrypted with global key or plain — skip
        }
      }

      if (hasChanges) {
        await updateRecordForModel(model, record.id as string, updates)
      }
    }
  }
}

// Models that use a relation-based userId filter instead of direct userId column
const RELATION_USER_FILTER: Record<string, Record<string, unknown>> = {
  FinanceAccount: { institution: { userId: "__PLACEHOLDER__" } },
  BalanceSnapshot: { wallet: { userId: "__PLACEHOLDER__" } },
}

async function fetchRecordsForModel(
  model: string,
  userId: string,
  fields: string[],
): Promise<Array<Record<string, unknown>>> {
  const select: Record<string, boolean> = { id: true }
  for (const f of fields) select[f] = true

  // Derive where clause: some models filter userId through a relation
  const relationFilter = RELATION_USER_FILTER[model]
  const where = relationFilter
    ? JSON.parse(JSON.stringify(relationFilter).replace('"__PLACEHOLDER__"', JSON.stringify(userId)))
    : { userId }

  // Use Prisma's dynamic model access so every model in ENCRYPTED_FIELDS is handled
  const camelName = model.charAt(0).toLowerCase() + model.slice(1)
  const delegate = (db as Record<string, any>)[camelName]
  if (!delegate?.findMany) {
    console.warn(`[change-password] No Prisma delegate for model "${model}" — skipping re-encryption`)
    return []
  }

  return delegate.findMany({ where, select }) as Promise<Array<Record<string, unknown>>>
}

async function updateRecordForModel(
  model: string,
  id: string,
  data: Record<string, string | null>,
): Promise<void> {
  const camelName = model.charAt(0).toLowerCase() + model.slice(1)
  const delegate = (db as Record<string, any>)[camelName]
  if (!delegate?.update) {
    console.warn(`[change-password] No Prisma delegate for model "${model}" — skipping update`)
    return
  }
  await delegate.update({ where: { id }, data })
}
