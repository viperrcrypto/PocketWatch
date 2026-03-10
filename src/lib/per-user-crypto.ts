/**
 * Per-user encryption key derivation using PBKDF2 (Web Crypto API).
 *
 * Flow:
 * 1. On register: generate random salt, derive key from password+salt
 * 2. On login: derive key from password+salt
 * 3. Store derived key encrypted with master key in Session.encryptedDek
 * 4. On each request: decrypt DEK from session, thread via AsyncLocalStorage
 */

import { encrypt, decrypt } from "./crypto"

const PBKDF2_ITERATIONS = 600_000
const KEY_LENGTH_BITS = 256

/**
 * Generate a random 32-byte hex salt for a new user.
 */
export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Derive a 256-bit encryption key from password + salt using PBKDF2-SHA256.
 * Returns hex-encoded key (64 chars).
 */
export async function deriveKey(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )

  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    KEY_LENGTH_BITS,
  )

  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Wrap the derived key with the server master key for safe storage in Session.
 */
export async function wrapDek(dekHex: string): Promise<string> {
  return encrypt(dekHex)
}

/**
 * Unwrap the derived key from Session using the server master key.
 */
export async function unwrapDek(wrapped: string): Promise<string> {
  return decrypt(wrapped)
}
