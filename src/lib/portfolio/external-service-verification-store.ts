import { db } from "@/lib/db"

export interface ExternalServiceRecord {
  id: string
  serviceName: string
  label: string | null
  apiKeyEnc: string
  verified: boolean
  verifyError: string | null
  consecutive429: number
  lastUsedAt: Date | null
  createdAt: Date
}

export async function listExternalServiceRecords(userId: string): Promise<ExternalServiceRecord[]> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{
      id: string
      serviceName: string
      label: string | null
      apiKeyEnc: string
      verified: boolean | null
      verifyError: string | null
      consecutive429: number
      lastUsedAt: Date | null
      createdAt: Date
    }>>(
      `SELECT "id", "serviceName", "label", "apiKeyEnc", "verified", "verifyError", "consecutive429", "lastUsedAt", "createdAt"
       FROM "ExternalApiKey"
       WHERE "userId" = $1
       ORDER BY "createdAt" ASC`,
      userId,
    )

    return rows.map((row) => ({
      id: row.id,
      serviceName: row.serviceName,
      label: row.label,
      apiKeyEnc: row.apiKeyEnc,
      verified: row.verified === true,
      consecutive429: row.consecutive429 ?? 0,
      lastUsedAt: row.lastUsedAt,
      verifyError: row.verifyError ?? null,
      createdAt: row.createdAt,
    }))
  } catch {
    const keys = await db.externalApiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    })
    return keys.map((k) => ({
      id: k.id,
      serviceName: k.serviceName,
      label: k.label,
      apiKeyEnc: k.apiKeyEnc,
      verified: k.verified,
      verifyError: k.verifyError,
      consecutive429: k.consecutive429,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }))
  }
}

export async function getStoredVerificationStatus(
  userId: string,
  serviceName: string,
): Promise<{ verified: boolean; verifyError: string | null } | null> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ verified: boolean | null; verifyError: string | null }>>(
      `SELECT "verified", "verifyError"
       FROM "ExternalApiKey"
       WHERE "userId" = $1 AND "serviceName" = $2
       LIMIT 1`,
      userId,
      serviceName,
    )
    if (rows.length === 0) return null
    return {
      verified: rows[0].verified === true,
      verifyError: rows[0].verifyError ?? null,
    }
  } catch {
    const row = await db.externalApiKey.findFirst({
      where: { userId, serviceName },
      orderBy: { createdAt: "asc" },
    })
    if (!row) return null
    return {
      verified: (row as { verified?: boolean }).verified === true,
      verifyError: (row as { verifyError?: string | null }).verifyError ?? null,
    }
  }
}

const MULTI_KEY_SERVICES = new Set(["zerion", "alchemy", "helius"])

/**
 * Bulk-update verification status for ALL keys of a single-key service.
 * Must NOT be called for multi-key services — use targeted db.externalApiKey.update({ where: { id } }) instead.
 */
export async function persistExternalServiceVerification(
  userId: string,
  serviceName: string,
  verified: boolean,
  verifyError: string | null,
): Promise<void> {
  if (MULTI_KEY_SERVICES.has(serviceName)) {
    console.error(`[external-services] persistExternalServiceVerification called for multi-key service "${serviceName}" — skipping bulk update`)
    return
  }

  try {
    await db.$executeRawUnsafe(
      `UPDATE "ExternalApiKey"
       SET "verified" = $1, "verifyError" = $2, "updatedAt" = NOW()
       WHERE "userId" = $3 AND "serviceName" = $4`,
      verified,
      verifyError,
      userId,
      serviceName,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Compatibility guard: if runtime Prisma client lags schema, do not fail key save/verify.
    if (message.includes("Unknown argument `verified`") || message.includes("Unknown argument `verifyError`")) {
      console.warn("[external-services] verification status persistence skipped due Prisma client/schema mismatch")
      return
    }
    throw error
  }
}

