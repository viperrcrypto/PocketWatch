import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { hashPassword, createSession, provisionEncryptionSalt, deriveUserDek } from "@/lib/auth"
import { rateLimit, getClientId, rateLimitHeaders } from "@/lib/rate-limit"
import { db } from "@/lib/db"

const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5/min per IP
    const clientId = getClientId(request)
    const rl = rateLimit(`auth:register:${clientId}`, { limit: 5, windowSeconds: 60 })
    if (!rl.success) {
      return apiError("E1100", "Too many registration attempts. Please try again later.", 429, undefined, rateLimitHeaders(rl))
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
      return apiError("E1101", "Username and password are required.", 400)
    }

    const username = body.username.toLowerCase().trim()
    const password = body.password

    // Validate username
    if (!USERNAME_REGEX.test(username)) {
      return apiError("E1102", "Username must be 3-30 characters: lowercase letters, numbers, hyphens, underscores.", 400)
    }

    // Validate password
    if (password.length < 8) {
      return apiError("E1103", "Password must be at least 8 characters.", 400)
    }

    // Check uniqueness
    const existing = await db.user.findUnique({ where: { username } })
    if (existing) {
      return apiError("E1104", "Username is already taken.", 409)
    }

    // Create user with encryption salt
    const passwordHash = await hashPassword(password)
    const encryptionSalt = provisionEncryptionSalt()
    const user = await db.user.create({
      data: { username, passwordHash, encryptionSalt },
    })

    // Derive per-user encryption key and create session
    const dek = await deriveUserDek(password, user)
    await createSession(user.id, dek)

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
      },
    }, { status: 201 })
  } catch (error) {
    return apiError("E1109", "Registration failed", 500, error)
  }
}
