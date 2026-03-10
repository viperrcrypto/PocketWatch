import test from "node:test"
import assert from "node:assert/strict"
import { generateSalt, deriveKey } from "@/lib/per-user-crypto"

test("generateSalt produces 32-char hex string", () => {
  const salt = generateSalt()
  assert.equal(salt.length, 32)
  assert.match(salt, /^[0-9a-f]{32}$/)
})

test("generateSalt produces unique values", () => {
  const a = generateSalt()
  const b = generateSalt()
  assert.notEqual(a, b)
})

test("deriveKey produces 64-char hex string", async () => {
  const salt = generateSalt()
  const key = await deriveKey("test-password", salt)
  assert.equal(key.length, 64)
  assert.match(key, /^[0-9a-f]{64}$/)
})

test("deriveKey is deterministic for same password+salt", async () => {
  const salt = generateSalt()
  const key1 = await deriveKey("my-password", salt)
  const key2 = await deriveKey("my-password", salt)
  assert.equal(key1, key2)
})

test("deriveKey differs for different passwords", async () => {
  const salt = generateSalt()
  const key1 = await deriveKey("password-a", salt)
  const key2 = await deriveKey("password-b", salt)
  assert.notEqual(key1, key2)
})

test("deriveKey differs for different salts", async () => {
  const salt1 = generateSalt()
  const salt2 = generateSalt()
  const key1 = await deriveKey("same-password", salt1)
  const key2 = await deriveKey("same-password", salt2)
  assert.notEqual(key1, key2)
})
