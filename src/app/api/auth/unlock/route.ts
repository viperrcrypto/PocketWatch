import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { verifyPassword, createSession, deriveUserDek, getVaultOwner } from "@/lib/auth"
import { rateLimit, getClientId, rateLimitHeaders } from "@/lib/rate-limit"
import bcrypt from "bcryptjs"

const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12)

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientId(request)
    const rl = rateLimit(`auth:unlock:${clientId}`, { limit: 10, windowSeconds: 60 })
    if (!rl.success) {
      return apiError("E1110", "Too many attempts. Please try again later.", 429, undefined, rateLimitHeaders(rl))
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body.password !== "string") {
      return apiError("E1111", "Password is required.", 400)
    }

    const user = await getVaultOwner()
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH
    const valid = await verifyPassword(body.password, hashToCompare)

    if (!user || !valid) {
      return apiError("E1112", "Wrong password.", 401)
    }

    const dek = await deriveUserDek(body.password, user)
    await createSession(user.id, dek)

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E1119", "Unlock failed", 500, error)
  }
}
