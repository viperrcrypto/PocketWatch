import { cookies } from "next/headers"
import { db } from "./db"
import bcrypt from "bcryptjs"
import { generateSalt, deriveKey, wrapDek, unwrapDek } from "./per-user-crypto"
import { isEncryptionConfigured } from "./crypto"
import { withEncryptionKey } from "./encryption-context"

export const SESSION_COOKIE = "trackme_session"
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days
const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string, dekHex?: string) {
  const nonce = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DURATION)

  // Wrap the per-user DEK with the server master key for safe storage
  let encryptedDek: string | null = null
  if (dekHex && isEncryptionConfigured()) {
    encryptedDek = await wrapDek(dekHex)
  }

  const session = await db.session.create({
    data: {
      userId,
      nonce,
      encryptedDek,
      expiresAt,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  })

  return session
}

export async function getSession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value

  if (!sessionId) {
    return null
  }

  const session = await db.session.findUnique({
    where: { id: sessionId },
  })

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.session.delete({ where: { id: sessionId } })
    }
    return null
  }

  return session
}

export async function getCurrentUser() {
  const session = await getSession()

  if (!session) {
    return null
  }

  return db.user.findUnique({
    where: { id: session.userId },
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value

  if (sessionId) {
    await db.session.delete({ where: { id: sessionId } }).catch(() => {})
    cookieStore.delete(SESSION_COOKIE)
  }
}

/**
 * Require an authenticated user. Returns the user or a 401 response.
 */
export async function requireAuth(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; response: null }
  | { user: null; response: Response }
> {
  const user = await getCurrentUser()
  if (!user) {
    const { NextResponse } = await import("next/server")
    return {
      user: null,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    }
  }
  return { user, response: null }
}

/**
 * Derive a per-user encryption key from password and user's salt.
 * Used during login and registration.
 */
export async function deriveUserDek(
  password: string,
  user: { encryptionSalt: string | null },
): Promise<string | undefined> {
  if (!user.encryptionSalt || !isEncryptionConfigured()) return undefined
  return deriveKey(password, user.encryptionSalt)
}

/**
 * Provision encryption salt for a user (called on registration).
 * Returns the salt hex string.
 */
export function provisionEncryptionSalt(): string {
  return generateSalt()
}

/**
 * Run a handler with the per-user encryption key from the current session.
 * Falls back to global key if no per-user key is stored.
 */
export async function withUserEncryption<T>(fn: () => T | Promise<T>): Promise<T> {
  const session = await getSession()
  if (!session?.encryptedDek || !isEncryptionConfigured()) {
    return withEncryptionKey(null, fn)
  }
  try {
    const dekHex = await unwrapDek(session.encryptedDek)
    return withEncryptionKey(dekHex, fn)
  } catch {
    // If unwrap fails (key rotation, corruption), fall back to global key
    return withEncryptionKey(null, fn)
  }
}

/**
 * Wrap a route handler with authentication + per-user encryption context.
 * Replaces the pattern: `const user = await getCurrentUser(); if (!user) return 401`
 *
 * Usage:
 *   export const GET = withAuthEncryption(async (user) => {
 *     // user is guaranteed non-null, per-user encryption key is threaded
 *     return NextResponse.json({ ... })
 *   })
 */
export function withAuthEncryption(
  handler: (user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, request: Request) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    const user = await getCurrentUser()
    if (!user) {
      const { NextResponse } = await import("next/server")
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    return withUserEncryption(() => handler(user, request))
  }
}

/**
 * Require an authenticated admin user. Returns the user or 401/403 response.
 * Admin user IDs are configured via the ADMIN_USER_IDS environment variable (comma-separated).
 */
export async function requireAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; response: null }
  | { user: null; response: Response }
> {
  const auth = await requireAuth()
  if (auth.response) return auth
  const adminIds = new Set((process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean))
  if (!adminIds.has(auth.user.id)) {
    const { NextResponse } = await import("next/server")
    return { user: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { user: auth.user, response: null }
}
