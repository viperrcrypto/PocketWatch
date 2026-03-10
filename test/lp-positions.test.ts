import test from "node:test"
import assert from "node:assert/strict"
import {
  calculateFullRangeIL,
  calculateConcentratedIL,
  tickToPrice,
  estimateEntryPrice,
} from "@/lib/portfolio/lp-positions/il-calculator"

// ─── Helpers ───

/** Assert that `actual` is within `tolerance` of `expected`. */
function assertClose(actual: number, expected: number, tolerance: number, message?: string) {
  const diff = Math.abs(actual - expected)
  assert.ok(
    diff < tolerance,
    message ?? `Expected ${actual} to be within ${tolerance} of ${expected} (diff: ${diff})`,
  )
}

// ─── calculateFullRangeIL ───

test("fullRangeIL: no price change returns IL = 0", () => {
  const result = calculateFullRangeIL(100, 100, 10_000)
  assertClose(result.ilPercent, 0, 0.01)
  assertClose(result.ilUsd, 0, 0.01)
})

test("fullRangeIL: price doubles gives IL ~= -5.72%", () => {
  const result = calculateFullRangeIL(100, 200, 10_000)
  // Well-known: 2*sqrt(2)/(1+2) - 1 = -0.05719...
  assertClose(result.ilPercent, -5.719, 0.5)
})

test("fullRangeIL: price halves gives IL ~= -5.72% (symmetric)", () => {
  const result = calculateFullRangeIL(100, 50, 10_000)
  assertClose(result.ilPercent, -5.719, 0.5)
})

test("fullRangeIL: price 4x gives IL ~= -20%", () => {
  const result = calculateFullRangeIL(100, 400, 10_000)
  // 2*sqrt(4)/(1+4) - 1 = 2*2/5 - 1 = -0.20
  assertClose(result.ilPercent, -20.0, 0.5)
})

test("fullRangeIL: zero entryPrice returns zero IL safely", () => {
  const result = calculateFullRangeIL(0, 100, 10_000)
  assert.equal(result.ilPercent, 0)
  assert.equal(result.ilUsd, 0)
  assert.equal(result.holdValue, 10_000)
  assert.equal(result.lpValue, 10_000)
})

test("fullRangeIL: negative currentPrice returns zero IL safely", () => {
  const result = calculateFullRangeIL(100, -50, 10_000)
  assert.equal(result.ilPercent, 0)
  assert.equal(result.ilUsd, 0)
})

test("fullRangeIL: zero entryValueUsd returns zero IL safely", () => {
  const result = calculateFullRangeIL(100, 200, 0)
  assert.equal(result.ilPercent, 0)
  assert.equal(result.ilUsd, 0)
})

// ─── calculateConcentratedIL ───

test("concentratedIL: narrow range amplifies IL vs full range", () => {
  const entryPrice = 100
  const currentPrice = 200
  const entryValue = 10_000

  const fullRange = calculateFullRangeIL(entryPrice, currentPrice, entryValue)

  // Narrow range: 80 to 120 (tight around entry)
  const concentrated = calculateConcentratedIL(entryPrice, currentPrice, 80, 120, entryValue)

  // Concentrated IL magnitude should be larger than full-range IL magnitude
  assert.ok(
    Math.abs(concentrated.ilPercent) > Math.abs(fullRange.ilPercent),
    `Concentrated IL (${concentrated.ilPercent}%) should be larger in magnitude than full range IL (${fullRange.ilPercent}%)`,
  )
})

test("concentratedIL: in-range position has non-zero IL when price moves", () => {
  // Entry at 100, current at 110, range [80, 120] — price is in range
  const result = calculateConcentratedIL(100, 110, 80, 120, 10_000)
  assert.ok(
    result.ilPercent !== 0,
    "IL should be non-zero when price has moved within range",
  )
})

test("concentratedIL: zero entryPrice returns zero IL safely", () => {
  const result = calculateConcentratedIL(0, 100, 80, 120, 10_000)
  assert.equal(result.ilPercent, 0)
  assert.equal(result.ilUsd, 0)
})

test("concentratedIL: out of range (price below lower tick) gives high IL", () => {
  // Range [90, 110], price dropped to 50 — far below range
  const outOfRange = calculateConcentratedIL(100, 50, 90, 110, 10_000)
  const fullRange = calculateFullRangeIL(100, 50, 10_000)

  assert.ok(
    Math.abs(outOfRange.ilPercent) > Math.abs(fullRange.ilPercent),
    `Out-of-range IL (${outOfRange.ilPercent}%) should exceed full-range IL (${fullRange.ilPercent}%)`,
  )
})

test("concentratedIL: out of range (price above upper tick) gives high IL", () => {
  // Range [90, 110], price rose to 200 — far above range
  const outOfRange = calculateConcentratedIL(100, 200, 90, 110, 10_000)
  const fullRange = calculateFullRangeIL(100, 200, 10_000)

  assert.ok(
    Math.abs(outOfRange.ilPercent) > Math.abs(fullRange.ilPercent),
    `Out-of-range IL (${outOfRange.ilPercent}%) should exceed full-range IL (${fullRange.ilPercent}%)`,
  )
})

// ─── tickToPrice ───

test("tickToPrice: tick 0 with equal decimals returns price 1.0", () => {
  const price = tickToPrice(0, 18, 18)
  assertClose(price, 1.0, 0.0001)
})

test("tickToPrice: positive tick returns price > 1", () => {
  const price = tickToPrice(1000, 18, 18)
  // 1.0001^1000 ≈ 1.1052
  assert.ok(price > 1.0, `Expected price > 1, got ${price}`)
  assertClose(price, 1.0001 ** 1000, 0.001)
})

test("tickToPrice: negative tick returns price < 1", () => {
  const price = tickToPrice(-1000, 18, 18)
  // 1.0001^(-1000) ≈ 0.9048
  assert.ok(price < 1.0, `Expected price < 1, got ${price}`)
  assertClose(price, 1.0001 ** -1000, 0.001)
})

test("tickToPrice: decimal adjustment (token0=6, token1=18)", () => {
  // USDC (6 decimals) / WETH (18 decimals)
  // rawPrice = 1.0001^0 = 1.0
  // adjusted = 1.0 * 10^(6-18) = 1e-12
  const price = tickToPrice(0, 6, 18)
  assertClose(price, 1e-12, 1e-15)
})

// ─── estimateEntryPrice ───

test("estimateEntryPrice: returns geometric mean of tick range", () => {
  // With equal decimals, estimateEntryPrice should equal tickToPrice at the midpoint
  const tickLower = -1000
  const tickUpper = 1000
  const midTick = 0

  const estimated = estimateEntryPrice(tickLower, tickUpper, 18, 18)
  const expected = tickToPrice(midTick, 18, 18)

  assertClose(estimated, expected, 0.0001)
})

test("estimateEntryPrice: asymmetric range uses correct midpoint", () => {
  const tickLower = 200
  const tickUpper = 800
  const midTick = 500

  const estimated = estimateEntryPrice(tickLower, tickUpper, 18, 18)
  const expected = tickToPrice(midTick, 18, 18)

  assertClose(estimated, expected, 0.0001)
})
