/**
 * GET/POST /api/backup/schedule
 * Manage auto-backup configuration.
 *
 * GET  — Return current schedule config
 * POST — Enable/disable auto-backup, set frequency and retention
 */

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, verifyPassword } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { encrypt } from "@/lib/crypto"

const SETTINGS_KEY = "auto_backup"

interface AutoBackupConfig {
  enabled: boolean
  frequency: "daily" | "weekly" | "monthly"
  retentionCount: number
  directory: string
  /** Backup encryption key wrapped with ENCRYPTION_KEY */
  wrappedBackupKey: string | null
  /** PBKDF2 salt used for key derivation from vault password (hex) */
  backupKeySalt: string | null
  lastBackupAt: string | null
  lastBackupError: string | null
}

const DEFAULT_CONFIG: AutoBackupConfig = {
  enabled: false,
  frequency: "daily",
  retentionCount: 7,
  directory: "~/.pocketwatch/backups",
  wrappedBackupKey: null,
  backupKeySalt: null,
  lastBackupAt: null,
  lastBackupError: null,
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("B3001", "Authentication required", 401)

  const setting = await db.settings.findUnique({ where: { key: SETTINGS_KEY } })
  const config = setting ? (setting.value as unknown as AutoBackupConfig) : DEFAULT_CONFIG

  return NextResponse.json({
    enabled: config.enabled,
    frequency: config.frequency,
    retentionCount: config.retentionCount,
    directory: config.directory,
    lastBackupAt: config.lastBackupAt,
    lastBackupError: config.lastBackupError,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("B3002", "Authentication required", 401)

  let body: {
    enabled?: boolean
    frequency?: string
    retentionCount?: number
    directory?: string
    password?: string
  }
  try {
    body = await req.json()
  } catch {
    return apiError("B3003", "Invalid request body", 400)
  }

  const setting = await db.settings.findUnique({ where: { key: SETTINGS_KEY } })
  const config = setting
    ? (setting.value as unknown as AutoBackupConfig)
    : { ...DEFAULT_CONFIG }

  // If enabling (or re-enabling), always require password to derive fresh key
  if (body.enabled === true) {
    if (!body.password) {
      return apiError("B3004", "Password required to enable auto-backup", 400)
    }
    const valid = await verifyPassword(body.password, user.passwordHash)
    if (!valid) return apiError("B3005", "Incorrect password", 403)

    // Derive and wrap backup key
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    const { deriveKey } = await import("@/lib/per-user-crypto")
    const backupKeyHex = await deriveKey(body.password, salt)

    // encrypt() uses ENCRYPTION_KEY directly — no user DEK needed
    config.wrappedBackupKey = await encrypt(backupKeyHex)
    config.backupKeySalt = salt
  }

  // If disabling, clear the wrapped key
  if (body.enabled === false) {
    config.wrappedBackupKey = null
    config.backupKeySalt = null
  }

  // Update config fields
  if (body.enabled !== undefined) config.enabled = body.enabled
  if (body.frequency && ["daily", "weekly", "monthly"].includes(body.frequency)) {
    config.frequency = body.frequency as AutoBackupConfig["frequency"]
  }
  if (body.retentionCount && body.retentionCount >= 1 && body.retentionCount <= 30) {
    config.retentionCount = body.retentionCount
  }
  if (body.directory) config.directory = body.directory

  await db.settings.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.parse(JSON.stringify(config)) },
    update: { value: JSON.parse(JSON.stringify(config)) },
  })

  return NextResponse.json({
    enabled: config.enabled,
    frequency: config.frequency,
    retentionCount: config.retentionCount,
    directory: config.directory,
  })
}
