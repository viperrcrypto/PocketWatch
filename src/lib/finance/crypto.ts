/**
 * Encryption for finance credentials (Plaid access tokens, SimpleFIN URLs).
 * Uses AES-256-GCM via Web Crypto API.
 * Key: FINANCE_ENCRYPTION_KEY env var (falls back to ENCRYPTION_KEY).
 */

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12
const TAG_LENGTH = 128

function getFinanceKey(): Uint8Array {
  const keyHex = process.env.FINANCE_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY

  if (!keyHex) {
    throw new Error(
      "FINANCE_ENCRYPTION_KEY (or ENCRYPTION_KEY) not configured. Generate with: openssl rand -hex 32"
    )
  }

  if (keyHex.length !== 64) {
    throw new Error("Finance encryption key must be 32 bytes (64 hex characters)")
  }

  const key = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    key[i] = parseInt(keyHex.slice(i * 2, i * 2 + 2), 16)
  }
  return key
}

async function importFinanceKey(): Promise<CryptoKey> {
  const keyBytes = getFinanceKey()
  return crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encryptCredential(plaintext: string): Promise<string> {
  const key = await importFinanceKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const data = new TextEncoder().encode(plaintext)

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    data
  )

  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), IV_LENGTH)

  return btoa(String.fromCharCode(...combined))
}

export async function decryptCredential(encrypted: string): Promise<string> {
  const key = await importFinanceKey()
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext
  )

  return new TextDecoder().decode(decrypted)
}
