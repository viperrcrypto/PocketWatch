import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { verifyPassword, createSession, deriveUserDek } from "@/lib/auth"
import { rateLimit, getClientId, rateLimitHeaders } from "@/lib/rate-limit"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

// Pre-computed dummy hash for timing-safe rejection of unknown usernames
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12)

const MAX_SESSIONS_PER_USER = 5

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10/min per IP
    const clientId = getClientId(request)
    const rl = rateLimit(`auth:login:${clientId}`, { limit: 10, windowSeconds: 60 })
    if (!rl.success) {
      return apiError("E1110", "Too many login attempts. Please try again later.", 429, undefined, rateLimitHeaders(rl))
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
      return apiError("E1111", "Username and password are required.", 400)
    }

    const username = body.username.toLowerCase().trim()
    const password = body.password

    // Look up user
    const user = await db.user.findUnique({ where: { username } })

    // Timing-safe: always run bcrypt.compare even for unknown users
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH
    const valid = await verifyPassword(password, hashToCompare)

    if (!user || !valid) {
      return apiError("E1112", "Invalid username or password.", 401)
    }

    // Enforce max concurrent sessions — delete oldest if at limit (atomic)
    await db.$transaction(async (tx) => {
      const sessions = await tx.session.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      })

      if (sessions.length >= MAX_SESSIONS_PER_USER) {
        const toDelete = sessions.slice(0, sessions.length - MAX_SESSIONS_PER_USER + 1)
        await tx.session.deleteMany({
          where: { id: { in: toDelete.map((s) => s.id) } },
        })
      }
    })

    // Derive per-user encryption key and create session
    const dek = await deriveUserDek(password, user)
    await createSession(user.id, dek)

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
      },
    })
  } catch (error) {
    return apiError("E1119", "Login failed", 500, error)
  }
}
