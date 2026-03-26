/**
 * Encryption primitives for .pwbackup files.
 * Uses AES-256-GCM with PBKDF2-derived keys from the vault password.
 *
 * File format:
 *   [4B] Magic "PWTB"
 *   [1B] Version 0x01
 *   [32B] PBKDF2 salt
 *   [12B] AES-GCM IV
 *   [NB] Ciphertext (gzipped JSON + GCM auth tag)
 *
 * Both manual and auto-backup produce the same format. The salt in the header
 * is always the PBKDF2 salt used for key derivation — for manual backups it's
 * random, for auto-backups it's the stored backupSalt. This means both can
 * be decrypted with just the vault password.
 */

import { gzipSync, gunzipSync } from "node:zlib"

const MAGIC = new Uint8Array([0x50, 0x57, 0x54, 0x42]) // "PWTB"
const FORMAT_VERSION = 0x01
const HEADER_SIZE = 4 + 1 + 32 + 12 // 49 bytes

const PBKDF2_ITERATIONS = 600_000
const KEY_LENGTH_BITS = 256
const IV_LENGTH = 12
const TAG_LENGTH = 128

/**
 * Derive a 256-bit AES key from the vault password + salt.
 */
async function deriveBackupKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    passwordKey,
    KEY_LENGTH_BITS,
  )

  return crypto.subtle.importKey(
    "raw",
    bits,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  )
}

/**
 * Import a raw hex key as a CryptoKey for AES-GCM.
 */
async function importRawKey(hexKey: string): Promise<CryptoKey> {
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hexKey.slice(i * 2, i * 2 + 2), 16)
  }
  return crypto.subtle.importKey(
    "raw",
    bytes.buffer as ArrayBuffer,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  )
}

/**
 * Core encryption: compress + AES-GCM encrypt + assemble binary.
 */
async function encryptCore(
  payload: object,
  key: CryptoKey,
  salt: Uint8Array,
): Promise<Buffer> {
  const json = JSON.stringify(payload)
  const compressed = gzipSync(Buffer.from(json, "utf-8"), { level: 6 })

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LENGTH },
    key,
    compressed,
  )

  const output = Buffer.alloc(HEADER_SIZE + ciphertext.byteLength)
  output.set(MAGIC, 0)
  output[4] = FORMAT_VERSION
  output.set(salt, 5)
  output.set(iv, 37)
  output.set(new Uint8Array(ciphertext), HEADER_SIZE)
  return output
}

/**
 * Encrypt a backup with the vault password (manual export).
 * Generates a random salt and derives the AES key via PBKDF2.
 */
export async function encryptBackup(
  payload: object,
  password: string,
): Promise<Buffer> {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const key = await deriveBackupKey(password, salt)
  return encryptCore(payload, key, salt)
}

/**
 * Encrypt a backup with a pre-derived key + its PBKDF2 salt (auto-backup).
 * The salt is embedded in the header so decryptBackup(buffer, vaultPassword)
 * can re-derive the same key — no double PBKDF2.
 */
export async function encryptBackupWithDerivedKey(
  payload: object,
  derivedKeyHex: string,
  pbkdf2SaltHex: string,
): Promise<Buffer> {
  const key = await importRawKey(derivedKeyHex)
  const salt = new Uint8Array(pbkdf2SaltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
  return encryptCore(payload, key, salt)
}

/**
 * Decrypt a .pwbackup binary buffer into the parsed JSON payload.
 * Works for both manual and auto-backup files — both use the vault password.
 */
export async function decryptBackup(
  buffer: Buffer,
  password: string,
): Promise<unknown> {
  if (buffer.length < HEADER_SIZE + 16) {
    throw new Error("File is too small to be a valid PocketWatch backup")
  }

  for (let i = 0; i < 4; i++) {
    if (buffer[i] !== MAGIC[i]) {
      throw new Error("Not a valid PocketWatch backup file")
    }
  }

  if (buffer[4] !== FORMAT_VERSION) {
    throw new Error(
      `Unsupported backup version ${buffer[4]}. This version of PocketWatch supports version ${FORMAT_VERSION}.`,
    )
  }

  // Uint8Array.from() copies into fresh ArrayBuffers — avoids subarray offset bug
  const salt = Uint8Array.from(buffer.subarray(5, 37))
  const iv = Uint8Array.from(buffer.subarray(37, HEADER_SIZE))
  const ciphertext = Uint8Array.from(buffer.subarray(HEADER_SIZE))

  const key = await deriveBackupKey(password, salt)

  let decrypted: ArrayBuffer
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: TAG_LENGTH },
      key,
      ciphertext,
    )
  } catch {
    throw new Error("Incorrect password or corrupted backup file")
  }

  const decompressed = gunzipSync(Buffer.from(decrypted))
  return JSON.parse(decompressed.toString("utf-8"))
}
