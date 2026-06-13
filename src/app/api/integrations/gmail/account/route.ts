/**
 * DELETE /api/integrations/gmail/account?service=...
 *
 * Disconnect ONE connected Gmail account by removing its FinanceCredential.
 * Session-guarded and userId-scoped: a user can only delete their own account
 * credential, and only a Gmail OAuth service (legacy bare or per-account).
 *
 * Returns the remaining connected accounts so the UI can refresh its list.
 */

import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import {
  GMAIL_LEGACY_SERVICE,
  isGmailService,
  listGmailAccounts,
} from "@/lib/integrations/gmail-client"

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("G2300", "Authentication required", 401)

  const service = req.nextUrl.searchParams.get("service") ?? GMAIL_LEGACY_SERVICE
  if (!isGmailService(service)) {
    return apiError("G2301", "Invalid Gmail account service", 400)
  }

  try {
    await db.financeCredential
      .delete({ where: { userId_service: { userId: user.id, service } } })
      .catch(() => {})

    const accounts = await listGmailAccounts(user.id)
    return NextResponse.json({ disconnected: service, accounts })
  } catch (err) {
    return apiError("G2302", "Failed to disconnect Gmail account", 500, err)
  }
}
