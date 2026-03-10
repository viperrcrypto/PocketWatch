import test, { afterEach } from "node:test"
import assert from "node:assert/strict"
import { verifyServiceKey } from "@/lib/portfolio/service-key-verifier"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test("verifyServiceKey returns invalid_key for empty key without network calls", async () => {
  let called = false
  globalThis.fetch = (async () => {
    called = true
    return new Response("{}")
  }) as typeof fetch

  const out = await verifyServiceKey("alchemy", "   ")
  assert.equal(out.verified, false)
  assert.equal(out.code, "invalid_key")
  assert.equal(called, false)
})

test("etherscan invalid key is classified as invalid_key", async () => {
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ status: "0", message: "NOTOK", result: "Invalid API Key" }),
    { status: 200 },
  )) as typeof fetch

  const out = await verifyServiceKey("etherscan", "bad-key")
  assert.equal(out.verified, false)
  assert.equal(out.code, "invalid_key")
})

test("alchemy valid response is classified as ok", async () => {
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1234" }),
    { status: 200 },
  )) as typeof fetch

  const out = await verifyServiceKey("alchemy", "demo-key")
  assert.equal(out.verified, true)
  assert.equal(out.code, "ok")
})

test("coingecko 429 is classified as rate_limited", async () => {
  globalThis.fetch = (async () => new Response("rate limit exceeded", { status: 429 })) as typeof fetch

  const out = await verifyServiceKey("coingecko", "demo-key")
  assert.equal(out.verified, false)
  assert.equal(out.code, "rate_limited")
})

test("helius 401 is classified as invalid_key", async () => {
  globalThis.fetch = (async () => new Response("Unauthorized", { status: 401 })) as typeof fetch

  const out = await verifyServiceKey("helius", "bad-key")
  assert.equal(out.verified, false)
  assert.equal(out.code, "invalid_key")
})

test("helius valid response is classified as ok", async () => {
  globalThis.fetch = (async () => new Response("[]", { status: 200 })) as typeof fetch

  const out = await verifyServiceKey("helius", "good-key")
  assert.equal(out.verified, true)
  assert.equal(out.code, "ok")
})

test("zerion 404 with authenticated request is treated as verified", async () => {
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ errors: [{ status: "404", detail: "Wallet not found" }] }),
    { status: 404 },
  )) as typeof fetch

  const out = await verifyServiceKey("zerion", "demo-key")
  assert.equal(out.verified, true)
  assert.equal(out.code, "ok")
})

