/**
 * Import a backup payload into the database.
 * Acquires an advisory lock, wipes all data, inserts in dependency order,
 * resets stuck jobs, patches timestamps, and creates a fresh session.
 */

import { db } from "@/lib/db"
import { withEncryptionKey } from "@/lib/encryption-context"
import { deriveKey, wrapDek } from "@/lib/per-user-crypto"
import { isEncryptionConfigured } from "@/lib/crypto"
import {
  BACKUP_TABLES,
  JOB_STATUS_TABLES,
  TIMESTAMP_TABLES,
  getModelDelegate,
} from "./backup-tables"
import type { BackupPayload } from "./backup-export"

const INSERT_CHUNK_SIZE = 500
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const IMPORT_LOCK_ID = 42424242

export interface ImportResult {
  totalRecords: number
  tableCount: number
  tablesRestored: string[]
  keysChanged: boolean
  sessionId: string
}

/**
 * Validate the backup payload structure.
 */
export function validatePayload(
  payload: unknown,
): payload is BackupPayload {
  if (!payload || typeof payload !== "object") return false
  const p = payload as Record<string, unknown>
  return (
    p.version === 1 &&
    typeof p.createdAt === "string" &&
    typeof p.tables === "object" &&
    p.tables !== null &&
    typeof p.secrets === "object" &&
    p.secrets !== null
  )
}

/**
 * Apply backup encryption keys to process.env temporarily.
 * Must only be called while holding the advisory lock.
 */
function applyBackupKeys(
  secrets: BackupPayload["secrets"],
): { restore: () => void; keysChanged: boolean } {
  const origEnc = process.env.ENCRYPTION_KEY
  const origFin = process.env.FINANCE_ENCRYPTION_KEY
  let keysChanged = false

  if (secrets.ENCRYPTION_KEY && secrets.ENCRYPTION_KEY !== origEnc) {
    process.env.ENCRYPTION_KEY = secrets.ENCRYPTION_KEY
    keysChanged = true
  }
  if (secrets.FINANCE_ENCRYPTION_KEY && secrets.FINANCE_ENCRYPTION_KEY !== origFin) {
    process.env.FINANCE_ENCRYPTION_KEY = secrets.FINANCE_ENCRYPTION_KEY
    keysChanged = true
  }

  return {
    keysChanged,
    restore: () => {
      if (origEnc !== undefined) process.env.ENCRYPTION_KEY = origEnc
      else delete process.env.ENCRYPTION_KEY
      if (origFin !== undefined) process.env.FINANCE_ENCRYPTION_KEY = origFin
      else delete process.env.FINANCE_ENCRYPTION_KEY
    },
  }
}

/**
 * Insert records for a single table in chunks.
 */
async function insertTable(
  tableName: string,
  records: unknown[],
): Promise<number> {
  const delegate = getModelDelegate(db, tableName)
  if (!delegate?.createMany) return 0

  let inserted = 0
  for (let i = 0; i < records.length; i += INSERT_CHUNK_SIZE) {
    const chunk = records.slice(i, i + INSERT_CHUNK_SIZE)
    const result = await delegate.createMany({ data: chunk })
    inserted += result.count
  }
  return inserted
}

/**
 * Reset stuck jobs to "completed" status.
 */
async function resetStuckJobs(): Promise<void> {
  for (const tableName of JOB_STATUS_TABLES) {
    const delegate = getModelDelegate(db, tableName)
    if (!delegate?.updateMany) continue
    await delegate.updateMany({
      where: { status: "running" },
      data: { status: "completed" },
    })
  }
}

/**
 * Patch @updatedAt timestamps back to original values.
 * Prisma auto-sets updatedAt on create, so we use individual safe updates.
 */
async function patchTimestamps(
  tables: Record<string, unknown[]>,
): Promise<void> {
  for (const { name, field } of TIMESTAMP_TABLES) {
    const records = tables[name]
    if (!records?.length) continue

    const delegate = getModelDelegate(db, name)
    if (!delegate?.update) continue

    const typedRecords = records as Array<Record<string, unknown>>
    for (const record of typedRecords) {
      const id = record.id as string | undefined
      const timestamp = record[field]
      if (!id || timestamp === undefined || timestamp === null) continue

      await delegate.update({
        where: { id },
        data: { [field]: new Date(timestamp as string) },
      }).catch(() => { /* record may not exist if insert was skipped */ })
    }
  }
}

/**
 * Import the full backup payload into the database.
 * Uses a PostgreSQL advisory lock to prevent concurrent imports.
 */
export async function importBackup(
  payload: BackupPayload,
  vaultPassword: string,
): Promise<ImportResult> {
  // Acquire advisory lock — prevents concurrent imports
  const [lockResult] = await db.$queryRawUnsafe<[{ pg_try_advisory_lock: boolean }]>(
    `SELECT pg_try_advisory_lock(${IMPORT_LOCK_ID})`,
  )
  if (!lockResult.pg_try_advisory_lock) {
    throw new Error("Another import is already in progress. Please wait and try again.")
  }

  // Apply backup encryption keys temporarily (safe under advisory lock)
  const { restore: restoreKeys, keysChanged } = applyBackupKeys(payload.secrets)

  // Track DEK for session creation after key restore
  let dekHex: string | undefined

  try {
    // 1. Wipe the database (Settings + User cascade)
    await db.settings.deleteMany()
    await db.user.deleteMany()

    // 2. Find the User record and derive DEK
    const userRecords = payload.tables.User as Array<Record<string, unknown>> | undefined
    if (!userRecords?.length) {
      throw new Error("Backup contains no User record — cannot restore")
    }
    const user = userRecords[0]
    const encryptionSalt = user.encryptionSalt as string | null

    if (encryptionSalt && isEncryptionConfigured()) {
      dekHex = await deriveKey(vaultPassword, encryptionSalt)
    }

    // 3. Insert all tables in tier order, within encryption context
    const result = await withEncryptionKey(dekHex ?? null, async () => {
      let totalRecords = 0
      const tablesRestored: string[] = []
      const sortedTables = [...BACKUP_TABLES].sort((a, b) => a.tier - b.tier)

      for (const table of sortedTables) {
        const records = payload.tables[table.name]
        if (!records?.length) continue

        const count = await insertTable(table.name, records)
        totalRecords += count
        tablesRestored.push(`${table.name} (${count})`)
      }

      return { totalRecords, tablesRestored }
    })

    // 4. Reset stuck background jobs
    await resetStuckJobs()

    // 5. Patch @updatedAt timestamps to original values
    await patchTimestamps(payload.tables)

    // 6. Restore original env keys BEFORE creating session
    //    so wrapDek uses the key that will be present at runtime
    restoreKeys()

    // 7. Create session — DEK wrapped with the RUNTIME key, not backup key
    const restoredUser = await db.user.findFirst()
    if (!restoredUser) {
      throw new Error("User record was not restored — import failed")
    }

    let encryptedDek: string | null = null
    if (dekHex && isEncryptionConfigured()) {
      encryptedDek = await wrapDek(dekHex)
    }

    const session = await db.session.create({
      data: {
        userId: restoredUser.id,
        nonce: crypto.randomUUID(),
        encryptedDek,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      },
    })

    return {
      totalRecords: result.totalRecords,
      tableCount: result.tablesRestored.length,
      tablesRestored: result.tablesRestored,
      keysChanged,
      sessionId: session.id,
    }
  } finally {
    // restoreKeys is idempotent — safe to call again if session creation threw
    restoreKeys()
    await db.$queryRawUnsafe(`SELECT pg_advisory_unlock(${IMPORT_LOCK_ID})`).catch(() => {})
  }
}
