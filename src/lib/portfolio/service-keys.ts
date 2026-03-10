/**
 * Shared utility for retrieving user-specific API keys from the database.
 * Supports multiple keys per service with round-robin selection.
 * Falls back to environment variables when no DB keys exist.
 */

import { db } from "@/lib/db"
import { decrypt } from "@/lib/crypto"
import type { ExchangeCredentials } from "./exchange-client"
import { toExchangeServiceName } from "./exchanges"

const ENV_FALLBACKS: Record<string, string | undefined> = {
  zerion: process.env.ZERION_API_KEY,
  etherscan: process.env.ETHERSCAN_API_KEY,
  alchemy: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  coingecko: process.env.COINGECKO_API_KEY,
  helius: process.env.HELIUS_API_KEY,
}

/** Services that support multiple API keys for round-robin rotation */
export const MULTI_KEY_SERVICES = new Set(["zerion", "alchemy", "helius"])

export interface ServiceKeyEntry {
  id: string
  key: string
  label: string | null
  consecutive429: number
  lastUsedAt: Date | null
  verified: boolean
}

async function decodeStoredValue(raw: string): Promise<string> {
  try {
    return await decrypt(raw)
  } catch (err) {
    console.error("[service-keys] decrypt failed — returning raw value (key may be unencrypted):", err)
    return raw
  }
}

/**
 * Get a decrypted API key for a service (backward-compatible single-key).
 * For multi-key services, uses round-robin selection.
 */
export async function getServiceKey(
  userId: string,
  serviceName: string
): Promise<string | null> {
  const entry = await selectServiceKey(userId, serviceName)
  return entry?.key ?? null
}

/**
 * Select the best available key using round-robin with health awareness.
 * Picks the least-recently-used key among those with the fewest consecutive 429s.
 */
/** Max consecutive 429s before a key is deprioritized heavily */
const THROTTLE_THRESHOLD = 10

export async function selectServiceKey(
  userId: string,
  serviceName: string
): Promise<ServiceKeyEntry | null> {
  const records = await db.externalApiKey.findMany({
    where: { userId, serviceName, verified: true },
    orderBy: [
      { consecutive429: "asc" },
      { lastUsedAt: { sort: "asc", nulls: "first" } },
    ],
  })

  if (records.length > 0) {
    // Prefer keys under the throttle threshold; fall back to least-bad if all are over
    const healthy = records.filter((r) => r.consecutive429 < THROTTLE_THRESHOLD)
    const best = healthy.length > 0 ? healthy[0] : records[0]
    const decrypted = await decodeStoredValue(best.apiKeyEnc)

    // Await lastUsedAt update to ensure concurrent calls see updated round-robin state
    await db.externalApiKey.update({
      where: { id: best.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {})

    return {
      id: best.id,
      key: decrypted,
      label: best.label,
      consecutive429: best.consecutive429,
      lastUsedAt: best.lastUsedAt,
      verified: best.verified,
    }
  }

  // Also check unverified keys (user may not have run verify yet)
  const unverified = await db.externalApiKey.findFirst({
    where: { userId, serviceName },
    orderBy: { createdAt: "asc" },
  })
  if (unverified) {
    const decrypted = await decodeStoredValue(unverified.apiKeyEnc)
    return {
      id: unverified.id,
      key: decrypted,
      label: unverified.label,
      consecutive429: unverified.consecutive429,
      lastUsedAt: unverified.lastUsedAt,
      verified: unverified.verified,
    }
  }

  // Fall back to env var
  const envKey = ENV_FALLBACKS[serviceName]
  if (envKey) {
    return { id: "env", key: envKey, label: "Environment", consecutive429: 0, lastUsedAt: null, verified: true }
  }

  return null
}

/**
 * Get all keys for a service (for UI display).
 */
export async function getServiceKeys(
  userId: string,
  serviceName: string
): Promise<ServiceKeyEntry[]> {
  const records = await db.externalApiKey.findMany({
    where: { userId, serviceName },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  })

  return Promise.all(records.map(async (r) => ({
    id: r.id,
    key: await decodeStoredValue(r.apiKeyEnc),
    label: r.label,
    consecutive429: r.consecutive429,
    lastUsedAt: r.lastUsedAt,
    verified: r.verified,
  })))
}

/**
 * Get ALL healthy keys for a service, sorted for round-robin rotation.
 * Returns the full key pool so callers can rotate on throttle.
 */
export async function getAllHealthyServiceKeys(
  userId: string,
  serviceName: string
): Promise<ServiceKeyEntry[]> {
  const records = await db.externalApiKey.findMany({
    where: { userId, serviceName, verified: true },
    orderBy: [
      { consecutive429: "asc" },
      { lastUsedAt: { sort: "asc", nulls: "first" } },
    ],
  })

  if (records.length > 0) {
    return Promise.all(records.map(async (r) => ({
      id: r.id,
      key: await decodeStoredValue(r.apiKeyEnc),
      label: r.label,
      consecutive429: r.consecutive429,
      lastUsedAt: r.lastUsedAt,
      verified: r.verified,
    })))
  }

  // Fall back to env var as a single-element pool
  const envKey = ENV_FALLBACKS[serviceName]
  if (envKey) {
    return [{ id: "env", key: envKey, label: "Environment", consecutive429: 0, lastUsedAt: null, verified: true }]
  }

  return []
}

/** After a 429: increment consecutive429, set lastErrorAt */
export async function markKeyThrottled(keyId: string): Promise<void> {
  if (keyId === "env") return
  await db.externalApiKey.update({
    where: { id: keyId },
    data: {
      consecutive429: { increment: 1 },
      lastErrorAt: new Date(),
    },
  })
}

/** After a successful call: reset consecutive429 */
export async function markKeySuccess(keyId: string): Promise<void> {
  if (keyId === "env") return
  await db.externalApiKey.update({
    where: { id: keyId },
    data: { consecutive429: 0 },
  })
}

export interface KeyHealthEntry {
  id: string
  label: string | null
  service: string
  consecutive429: number
  lastUsedAt: Date | null
  lastErrorAt: Date | null
  verified: boolean
  active: boolean
}

/**
 * Get per-key health summary for all multi-key services.
 * Used by the diagnostics API to show key rotation status.
 */
export async function getKeyHealthSummary(
  userId: string
): Promise<Record<string, KeyHealthEntry[]>> {
  const records = await db.externalApiKey.findMany({
    where: {
      userId,
      serviceName: { in: [...MULTI_KEY_SERVICES] },
    },
    orderBy: [{ serviceName: "asc" }, { lastUsedAt: { sort: "desc", nulls: "last" } }],
  })

  const result: Record<string, KeyHealthEntry[]> = {}
  for (const r of records) {
    const entries = result[r.serviceName] ?? []
    entries.push({
      id: r.id,
      label: r.label,
      service: r.serviceName,
      consecutive429: r.consecutive429,
      lastUsedAt: r.lastUsedAt,
      lastErrorAt: r.lastErrorAt,
      verified: r.verified,
      active: false, // set below
    })
    result[r.serviceName] = entries
  }

  // Mark the most recently used key per service as "active"
  for (const entries of Object.values(result)) {
    if (entries.length === 0) continue
    const withUsage = entries.filter((e) => e.lastUsedAt !== null)
    if (withUsage.length > 0) {
      withUsage[0].active = true // already sorted desc by lastUsedAt
    } else {
      entries[0].active = true // none used yet, first is default
    }
  }

  return result
}

/**
 * Get decrypted exchange credentials (apiKey + secret + passphrase).
 * Exchange credentials are stored as an encrypted JSON blob.
 */
export async function getExchangeCredentials(
  userId: string,
  exchangeId: string
): Promise<ExchangeCredentials | null> {
  const serviceName = toExchangeServiceName(exchangeId)
  const record = await db.externalApiKey.findFirst({
    where: { userId, serviceName },
    orderBy: { createdAt: "asc" },
  })
  if (!record) return null

  const decrypted = await decodeStoredValue(record.apiKeyEnc)
  try {
    const parsed = JSON.parse(decrypted)
    if (!parsed.apiKey || !parsed.secret) return null
    return {
      apiKey: parsed.apiKey,
      secret: parsed.secret,
      ...(parsed.passphrase ? { passphrase: parsed.passphrase } : {}),
    }
  } catch {
    return null
  }
}

/**
 * Get all exchange credentials for a user.
 * Returns array of { exchangeId, credentials } for all connected exchanges.
 */
export async function getAllExchangeCredentials(
  userId: string
): Promise<{ exchangeId: string; credentials: ExchangeCredentials }[]> {
  const records = await db.externalApiKey.findMany({
    where: {
      userId,
      serviceName: { startsWith: "exchange_" },
    },
  })

  const results: { exchangeId: string; credentials: ExchangeCredentials }[] = []

  for (const record of records) {
    const exchangeId = record.serviceName.slice(9) // strip "exchange_"
    try {
      const decrypted = await decodeStoredValue(record.apiKeyEnc)
      const parsed = JSON.parse(decrypted)
      if (parsed.apiKey && parsed.secret) {
        results.push({
          exchangeId,
          credentials: {
            apiKey: parsed.apiKey,
            secret: parsed.secret,
            ...(parsed.passphrase ? { passphrase: parsed.passphrase } : {}),
          },
        })
      }
    } catch {
      console.error(`[service-keys] Failed to decrypt exchange credentials for ${exchangeId}`)
    }
  }

  return results
}
