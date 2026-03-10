/**
 * AsyncLocalStorage-based context for per-user encryption keys.
 * Threads the derived key through request handlers to the Prisma extension.
 */

import { AsyncLocalStorage } from "node:async_hooks"

interface EncryptionStore {
  /** Per-user derived key (hex), or null to fall back to global key */
  userKey: string | null
}

const store = new AsyncLocalStorage<EncryptionStore>()

/**
 * Run a function with a per-user encryption key available to the Prisma extension.
 */
export function withEncryptionKey<T>(userKey: string | null, fn: () => T): T {
  return store.run({ userKey }, fn)
}

/**
 * Get the current per-user encryption key, or null if not in a keyed context.
 */
export function getCurrentUserKey(): string | null {
  return store.getStore()?.userKey ?? null
}
