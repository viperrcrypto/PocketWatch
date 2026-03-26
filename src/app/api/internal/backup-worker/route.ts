/**
 * POST /api/internal/backup-worker
 * Cron endpoint for automated backups.
 * Writes encrypted .pwbackup files to the configured directory.
 */

import { NextRequest, NextResponse } from "next/server"
import { writeFile, readdir, unlink, mkdir } from "node:fs/promises"
import { resolve, sep } from "node:path"
import { homedir } from "node:os"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/crypto"
import { withEncryptionKey } from "@/lib/encryption-context"
import { exportAllTables } from "@/lib/backup/backup-export"
import { encryptBackupWithDerivedKey } from "@/lib/backup/backup-crypto"

const SETTINGS_KEY = "auto_backup"

interface AutoBackupConfig {
  enabled: boolean
  retentionCount: number
  directory: string
  wrappedBackupKey: string | null
  backupKeySalt: string | null
  lastBackupAt: string | null
  lastBackupError: string | null
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = process.env.BACKUP_CRON_SECRET ?? process.env.SNAPSHOT_WORKER_SECRET
  const authHeader = req.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return apiError("B4001", "Unauthorized", 401)
  }

  // Load config
  const setting = await db.settings.findUnique({ where: { key: SETTINGS_KEY } })
  if (!setting) return apiError("B4002", "Auto-backup not configured", 404)

  const config = setting.value as unknown as AutoBackupConfig
  if (!config.enabled || !config.wrappedBackupKey || !config.backupKeySalt) {
    return NextResponse.json({ skipped: true, reason: "Auto-backup disabled or not configured" })
  }

  try {
    // Unwrap the backup encryption key
    const backupKeyHex = await decrypt(config.wrappedBackupKey)

    // Get DEK from the most recent active session for Layer 2 decryption
    const user = await db.user.findFirst()
    if (!user) return apiError("B4003", "No user found", 500)

    const session = await db.session.findFirst({
      where: { userId: user.id, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: "desc" },
    })

    let dekHex: string | null = null
    if (session?.encryptedDek) {
      dekHex = await decrypt(session.encryptedDek)
    }

    if (!dekHex) {
      throw new Error("No active user session — cannot decrypt fields for backup. Please log in first.")
    }

    // Export within encryption context
    const payload = await withEncryptionKey(dekHex, () => exportAllTables())

    // Encrypt with the pre-derived key + its PBKDF2 salt
    // This produces a file decryptable with PBKDF2(vault_password, backupKeySalt)
    const encrypted = await encryptBackupWithDerivedKey(
      payload,
      backupKeyHex,
      config.backupKeySalt,
    )

    // Resolve and validate directory path
    const dir = config.directory.replace(/^~/, homedir())
    const resolvedDir = resolve(dir)
    const allowedBase = resolve(homedir())
    if (!resolvedDir.startsWith(allowedBase + sep) && resolvedDir !== allowedBase) {
      throw new Error("Backup directory must be within the home directory")
    }
    await mkdir(resolvedDir, { recursive: true })

    // Write file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const filename = `pocketwatch-backup-${timestamp}.pwbackup`
    const filepath = resolve(resolvedDir, filename)
    await writeFile(filepath, encrypted)

    // Cleanup old backups
    const files = (await readdir(resolvedDir))
      .filter((f) => f.startsWith("pocketwatch-backup-") && f.endsWith(".pwbackup"))
      .sort()
      .reverse()

    for (const old of files.slice(config.retentionCount)) {
      await unlink(resolve(resolvedDir, old)).catch((err) => {
        console.warn(`[backup] Failed to delete old backup ${old}:`, err)
      })
    }

    // Update last backup timestamp
    await db.settings.update({
      where: { key: SETTINGS_KEY },
      data: {
        value: JSON.parse(JSON.stringify({
          ...config,
          lastBackupAt: new Date().toISOString(),
          lastBackupError: null,
        })),
      },
    })

    return NextResponse.json({ success: true, file: filename, records: payload.stats.totalRecords })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auto-backup failed"
    console.error("[backup-worker] Auto-backup failed:", err)
    await db.settings.update({
      where: { key: SETTINGS_KEY },
      data: {
        value: JSON.parse(JSON.stringify({
          ...config,
          lastBackupError: message,
        })),
      },
    }).catch(() => {})

    return apiError("B4004", message, 500, err)
  }
}
