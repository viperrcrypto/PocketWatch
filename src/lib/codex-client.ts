/**
 * Codex SDK client management — singleton + per-user instances.
 */

import { Codex } from "@codex-data/sdk"
import { db } from "./db"
import { decrypt } from "./crypto"

// Singleton Codex client (server-side env var key — used for DAO-wide features)
let codexInstance: Codex | null = null

export function getCodex(): Codex | null {
  if (!codexInstance) {
    const apiKey = process.env.CODEX_API_KEY
    if (!apiKey) {
      console.warn("CODEX_API_KEY not configured - Codex features will be unavailable")
      return null
    }
    codexInstance = new Codex(apiKey)
  }
  return codexInstance
}

// Per-user Codex client for personal features (charts, wallet tracker)
// Premium role users get the hardcoded key; others must have their own key stored
const userCodexCache = new Map<string, { instance: Codex; expiry: number }>()

export async function getCodexForUser(userId: string): Promise<Codex | null> {
  // Check cache first
  const cached = userCodexCache.get(userId)
  if (cached && Date.now() < cached.expiry) {
    return cached.instance
  }

  // Check user's own Codex API key from ExternalApiKey table
  const stored = await db.externalApiKey.findFirst({
    where: { userId, serviceName: "codex" },
    select: { apiKeyEnc: true },
  })
  if (stored?.apiKeyEnc) {
    let key: string
    try {
      key = await decrypt(stored.apiKeyEnc)
    } catch {
      // Fallback for unencrypted legacy keys
      key = stored.apiKeyEnc
    }
    const instance = new Codex(key)
    userCodexCache.set(userId, { instance, expiry: Date.now() + 5 * 60_000 })
    return instance
  }

  // Fallback: use global CODEX_API_KEY if available
  const instance = getCodex()
  if (instance) {
    userCodexCache.set(userId, { instance, expiry: Date.now() + 5 * 60_000 })
    return instance
  }

  return null
}
