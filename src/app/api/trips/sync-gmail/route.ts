/**
 * Trips ← Gmail sync API.
 *
 * GET  → report whether the user has connected Gmail (drives the UI button).
 * POST → scan Gmail for travel confirmations and import new ones as Trips.
 *
 * Both routes are session-guarded and userId-scoped. POST requires an active
 * gmail_oauth credential; without it we return a clear "connect Gmail" error.
 */

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { listGmailAccounts } from "@/lib/integrations/gmail-client"
import { syncTripsFromGmail } from "@/lib/trips/email-trip-parser"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("TPG01", "Authentication required", 401)

  try {
    const accounts = await listGmailAccounts(user.id)
    return NextResponse.json({ connected: accounts.length > 0, accounts })
  } catch (err) {
    return apiError("TPG02", "Failed to check Gmail connection", 500, err)
  }
}

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("TPG10", "Authentication required", 401)

  try {
    const accounts = await listGmailAccounts(user.id)
    if (accounts.length === 0) {
      return apiError(
        "TPG11",
        "Connect Gmail first to import trips from your travel confirmations.",
        400,
      )
    }

    const result = await syncTripsFromGmail(user.id)
    return NextResponse.json(result)
  } catch (err) {
    return apiError("TPG12", "Failed to sync trips from Gmail", 500, err)
  }
}
