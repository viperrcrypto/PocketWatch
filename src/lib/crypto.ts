/**
 * Encryption utilities for sensitive data storage.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * IMPORTANT: Set ENCRYPTION_KEY in environment (32 bytes / 64 hex chars)
 * Generate with: openssl rand -hex 32
 */

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12 // GCM recommended IV length
const TAG_LENGTH = 128 // Auth tag length in bits

/**
 * Get or validate the encryption key from environment.
 */
function getEncryptionKey(): Uint8Array {
  const keyHex = process.env.ENCRYPTION_KEY

  if (!keyHex) {
    throw new Error(
      "ENCRYPTION_KEY not configured. Generate with: openssl rand -hex 32"
    )
  }

  if (keyHex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be 32 bytes (64 hex characters)"
    )
  }

  // Convert hex to bytes
  const key = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    key[i] = parseInt(keyHex.slice(i * 2, i * 2 + 2), 16)
  }

  return key
}

/**
 * Import the encryption key for Web Crypto API.
 */
async function importKey(): Promise<CryptoKey> {
  const keyBytes = getEncryptionKey()

  return crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  )
}

/**
 * Import a hex-encoded key for Web Crypto API.
 */
export async function importKeyFromHex(hexKey: string): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(hexKey.slice(i * 2, i * 2 + 2), 16)
  }

  return crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  )
}

/**
 * Encrypt sensitive data.
 * Returns base64-encoded string: iv + ciphertext + authTag
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await importKey()

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // Encode plaintext
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH,
    },
    key,
    data
  )

  // Combine IV + ciphertext (ciphertext includes auth tag in Web Crypto)
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), IV_LENGTH)

  // Return base64 encoded
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt sensitive data.
 * Expects base64-encoded string: iv + ciphertext + authTag
 */
export async function decrypt(encrypted: string): Promise<string> {
  const key = await importKey()

  // Decode base64
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH,
    },
    key,
    ciphertext
  )

  // Decode to string
  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Encrypt with a specific CryptoKey (for per-user encryption).
 */
export async function encryptWithKey(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    data,
  )

  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), IV_LENGTH)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt with a specific CryptoKey (for per-user encryption).
 */
export async function decryptWithKey(encrypted: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext,
  )

  return new TextDecoder().decode(decrypted)
}

/**
 * Check if encryption is properly configured.
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey()
    return true
  } catch {
    return false
  }
}

/**
 * Interface for commitment details before encryption.
 */
export interface CommitmentDetails {
  walletAddress: string
  paymentProof?: string
  additionalInfo?: string
}

/**
 * Interface for POC payment details before encryption.
 */
export interface POCPaymentDetails {
  paymentInstructions: string
  walletAddress?: string
  bankDetails?: string
  additionalNotes?: string
}

/**
 * Encrypt commitment details (wallet address + payment proof).
 * Converts object to JSON before encryption.
 *
 * @param details - Commitment details to encrypt
 * @returns Encrypted base64 string
 */
export async function encryptCommitmentDetails(
  details: CommitmentDetails
): Promise<string> {
  const json = JSON.stringify(details)
  return encrypt(json)
}

/**
 * Decrypt commitment details.
 * Parses JSON after decryption.
 *
 * @param encrypted - Encrypted base64 string
 * @returns Decrypted commitment details
 */
export async function decryptCommitmentDetails(
  encrypted: string
): Promise<CommitmentDetails> {
  const json = await decrypt(encrypted)
  return JSON.parse(json) as CommitmentDetails
}

/**
 * Encrypt POC payment details (admin payment instructions).
 * Converts object to JSON before encryption.
 *
 * @param details - POC payment details to encrypt
 * @returns Encrypted base64 string
 */
export async function encryptPOCPaymentDetails(
  details: POCPaymentDetails
): Promise<string> {
  const json = JSON.stringify(details)
  return encrypt(json)
}

/**
 * Decrypt POC payment details for display.
 * Parses JSON after decryption.
 *
 * @param encrypted - Encrypted base64 string
 * @returns Decrypted POC payment details
 */
export async function decryptPOCPaymentDetails(
  encrypted: string
): Promise<POCPaymentDetails> {
  const json = await decrypt(encrypted)
  return JSON.parse(json) as POCPaymentDetails
}
