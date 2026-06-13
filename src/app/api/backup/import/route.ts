/**
 * POST /api/backup/import
 * Restore from an encrypted .pwbackup file.
 *
 * Authentication: OPTIONAL when no user exists (fresh machine restore).
 * When a user exists, requires authentication + password verification.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCurrentUser, verifyPassword, SESSION_COOKIE } from "@/lib/auth"
import { isSecureRequest } from "@/lib/request-proto"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptBackup } from "@/lib/backup/backup-crypto"
import { importBackup, validatePayload } from "@/lib/backup/backup-import"
import type { BackupPayload } from "@/lib/backup/backup-export"

const MAX_BACKUP_SIZE = 500 * 1024 * 1024 // 500MB

export async function POST(req: NextRequest) {
  // Determine auth state once — prevents TOCTOU race
  const existingUser = await db.user.findFirst({
    select: { id: true, passwordHash: true },
  })

  if (existingUser) {
    const session = await getCurrentUser()
    if (!session) return apiError("B2001", "Authentication required", 401)
  }

  // Parse multipart form
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError("B2002", "Invalid form data", 400)
  }

  const file = formData.get("file") as File | null
  const password = formData.get("password") as string | null

  if (!file) return apiError("B2003", "Backup file is required", 400)
  if (!password) return apiError("B2004", "Password is required", 400)
  if (file.size > MAX_BACKUP_SIZE) {
    return apiError("B2005", "Backup file exceeds 500MB limit", 400)
  }

  // If user exists, verify password matches current vault
  if (existingUser) {
    const valid = await verifyPassword(password, existingUser.passwordHash)
    if (!valid) return apiError("B2006", "Incorrect password", 403)
  }

  try {
    // Read and decrypt the backup file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const raw = await decryptBackup(buffer, password)

    // Validate payload structure
    if (!validatePayload(raw)) {
      return apiError("B2007", "Invalid backup format", 400)
    }
    const payload = raw as BackupPayload

    // Verify password matches the backup's user record
    const backupUser = (payload.tables.User as Array<Record<string, unknown>>)?.[0]
    if (backupUser?.passwordHash) {
      const valid = await verifyPassword(password, backupUser.passwordHash as string)
      if (!valid) {
        return apiError("B2008", "Password does not match the backup's vault password", 403)
      }
    }

    // Perform the import
    const result = await importBackup(payload, password)

    // Set session cookie for the restored user
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, result.sessionId, {
      httpOnly: true,
      // Track the real transport (see request-proto.ts) — WKWebView drops
      // Secure cookies over plain http://localhost.
      secure: await isSecureRequest(),
      sameSite: "strict",
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      path: "/",
    })

    // Never expose encryption keys to the client
    return NextResponse.json({
      success: true,
      stats: {
        totalRecords: result.totalRecords,
        tableCount: result.tableCount,
        tables: result.tablesRestored,
      },
      keysChanged: result.keysChanged,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed"
    if (message.includes("Incorrect password") || message.includes("corrupted")) {
      return apiError("B2009", message, 400)
    }
    if (message.includes("Unsupported backup version")) {
      return apiError("B2010", message, 400)
    }
    if (message.includes("Another import")) {
      return apiError("B2012", message, 409)
    }
    return apiError("B2011", "Failed to restore backup. Please try again.", 500, err)
  }
}
