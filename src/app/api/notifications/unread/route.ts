/**
 * Unread notification count — lightweight endpoint for the bell badge.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("NU001", "Authentication required", 401)

  try {
    const count = await db.notification.count({
      where: { userId: user.id, readAt: null },
    })
    return NextResponse.json({ count })
  } catch (err) {
    return apiError("NU002", "Failed to count unread", 500, err)
  }
}
