import { cookies, headers } from "next/headers"
import { timingSafeEqual } from "crypto"
import { db } from "./db"
import bcrypt from "bcryptjs"
import { generateSalt, deriveKey, wrapDek, unwrapDek } from "./per-user-crypto"
import { isEncryptionConfigured } from "./crypto"
import { withEncryptionKey } from "./encryption-context"

export const SESSION_COOKIE = "pocketwatch_session"
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days
const SALT_ROUNDS = 12

function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

async function isValidApiKey(): Promise<boolean> {
  const apiKey = process.env.POCKETWATCH_API_KEY
  if (!apiKey) return false
  const headerStore = await headers()
  const authHeader = headerStore.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return false
  return secureCompare(authHeader.slice(7), apiKey)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Check if a vault owner (single user) exists.
 */
export async function isVaultInitialized(): Promise<boolean> {
  const count = await db.user.count()
  return count > 0
}

/**
 * Get the single vault owner user.
 */
export async function getVaultOwner() {
  return db.user.findFirst()
}

export async function createSession(userId: string, dekHex?: string) {
  const nonce = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DURATION)

  let encryptedDek: string | null = null
  if (dekHex && isEncryptionConfigured()) {
    encryptedDek = await wrapDek(dekHex)
  }

  // Delete any existing sessions (single user, single session)
  await db.session.deleteMany({ where: { userId } })

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
    sameSite: "strict",
    expires: expiresAt,
    path: "/",
  })

  return session
}

export async function getSession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value

  if (sessionId) {
    const session = await db.session.findUnique({
      where: { id: sessionId },
    })

    if (session && session.expiresAt >= new Date()) {
      return session
    }

    if (session) {
      await db.session.delete({ where: { id: sessionId } })
    }
  }

  // Fallback: API key auth — borrow the most recent active session for DEK
  if (await isValidApiKey()) {
    const owner = await db.user.findFirst()
    if (!owner) return null
    return db.session.findFirst({
      where: { userId: owner.id, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: "desc" },
    })
  }

  return null
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
    await db.session.delete({ where: { id: sessionId } }).catch((err) => {
      console.warn("[auth] Failed to delete session:", err)
    })
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
 */
export async function deriveUserDek(
  password: string,
  user: { encryptionSalt: string | null },
): Promise<string | undefined> {
  if (!user.encryptionSalt || !isEncryptionConfigured()) return undefined
  return deriveKey(password, user.encryptionSalt)
}

/**
 * Provision encryption salt for a user.
 */
export function provisionEncryptionSalt(): string {
  return generateSalt()
}

/**
 * Run a handler with the per-user encryption key from the current session.
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
    return withEncryptionKey(null, fn)
  }
}

/**
 * Wrap a route handler with authentication + per-user encryption context.
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
 * Wipe all data and reset the vault. Deletes everything.
 */
export async function resetVault() {
  // Delete all sessions first
  await db.session.deleteMany()
  // Delete all users (cascade deletes everything)
  await db.user.deleteMany()
}
