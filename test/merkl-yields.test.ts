import test from "node:test"
import assert from "node:assert/strict"
import { getMerklIncentiveApr } from "@/lib/portfolio/merkl-yields"

test("merkl APR applies only on strict address match", async () => {
  const originalFetch = global.fetch
  global.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ([
      {
        apr: 3.25,
        name: "Aave USDC incentives",
        identifier: "aave-usdc",
        tokens: [{ symbol: "aUSDC", address: "0x1111111111111111111111111111111111111111" }],
      },
    ]),
  })) as typeof fetch

  try {
    const apr = await getMerklIncentiveApr("ethereum", "aave-v3", {
      positionAddress: "0x1111111111111111111111111111111111111111",
    })
    assert.equal(apr, 3.25)
  } finally {
    global.fetch = originalFetch
  }
})

test("merkl symbol/name-only hints do not match without address", async () => {
  const originalFetch = global.fetch
  global.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ([
      {
        apr: 9.9,
        name: "Aave rewards for aUSDC pool",
        identifier: "aave-ausdc-reward",
        tokens: [{ symbol: "aUSDC", address: "0x2222222222222222222222222222222222222222" }],
      },
    ]),
  })) as typeof fetch

  try {
    const apr = await getMerklIncentiveApr("arbitrum", "aave-v3", {
      positionAddress: "0x3333333333333333333333333333333333333333",
    })
    assert.equal(apr, null)
  } finally {
    global.fetch = originalFetch
  }
})
