import "./setup-env"
import test from "node:test"
import assert from "node:assert/strict"
import { computeEconomicYieldUsd } from "@/lib/portfolio/staking/economic-math"
import { passesFreezeGate, shouldReopenFrozenPosition } from "@/lib/portfolio/staking/freeze-gate"
import { reconstructFlowFromLedger } from "@/lib/portfolio/staking/flow-reconstruction"
import type { LifecyclePositionInput } from "@/lib/portfolio/staking/types"

function basePosition(overrides: Partial<LifecyclePositionInput> = {}): LifecyclePositionInput {
  return {
    wallet: "0xabc",
    chain: "ethereum",
    symbol: "aEthUSDC",
    name: "Aave USDC",
    protocol: "Aave V3",
    defiProject: "aave-v3",
    underlying: "USDC",
    contractAddress: "0xatoken",
    quantity: 0,
    price: 1,
    value: 0,
    apy: null,
    apyBase: null,
    apyReward: null,
    annualYield: null,
    dailyYield: null,
    maturityDate: null,
    yieldSource: null,
    ...overrides,
  }
}

test("economic yield formula matches locked definition", () => {
  const out = computeEconomicYieldUsd(900, 1000, 200, 50)
  assert.equal(out.principalUsd, 800)
  assert.equal(out.yieldEarnedUsd, 150)
  assert.equal(out.yieldEarnedPct, 15)
})

test("economic yield supports negative performance", () => {
  const out = computeEconomicYieldUsd(900, 1000, 0, 0)
  assert.equal(out.principalUsd, 1000)
  assert.equal(out.yieldEarnedUsd, -100)
  assert.equal(out.yieldEarnedPct, -10)
})

test("freeze gate passes only when all confidence/lifecycle checks pass", () => {
  const pass = passesFreezeGate({
    dust: true,
    dustStreak: 3,
    pendingRewards: false,
    maturityOpen: false,
    confidence: "modeled",
    latestInTs: 100,
    closeCandidateAt: new Date(200 * 1000),
    principalUsd: 0,
    yieldEarnedUsd: 42,
  })
  assert.equal(pass, true)

  const blockedByRewards = passesFreezeGate({
    dust: true,
    dustStreak: 3,
    pendingRewards: true,
    maturityOpen: false,
    confidence: "modeled",
    latestInTs: 100,
    closeCandidateAt: new Date(200 * 1000),
    principalUsd: 0,
    yieldEarnedUsd: 42,
  })
  assert.equal(blockedByRewards, false)

  const blockedByConfidence = passesFreezeGate({
    dust: true,
    dustStreak: 3,
    pendingRewards: false,
    maturityOpen: false,
    confidence: "estimated",
    latestInTs: 100,
    closeCandidateAt: new Date(200 * 1000),
    principalUsd: 0,
    yieldEarnedUsd: 42,
  })
  assert.equal(blockedByConfidence, false)
})

test("reopen logic triggers on non-dust return or new inflow", () => {
  assert.equal(shouldReopenFrozenPosition(true, false, 100, 100), true)
  assert.equal(shouldReopenFrozenPosition(true, true, 101, 100), true)
  assert.equal(shouldReopenFrozenPosition(true, true, 100, 100), false)
  assert.equal(shouldReopenFrozenPosition(false, true, 999, 0), false)
})

test("aave supply tx records deposit (underlying out + aToken in)", () => {
  const position = basePosition()
  const flow = reconstructFlowFromLedger(position, "ETHEREUM", [
    {
      wallet: "0xabc",
      chain: "ETHEREUM",
      txHash: "0x1",
      legs: [
        { asset: "0xusdc", symbol: "USDC", direction: "out", usd: 100, blockTimestamp: 1 },
        { asset: "0xatoken", symbol: "aEthUSDC", direction: "in", usd: 100, blockTimestamp: 1 },
      ],
    },
  ])

  assert.equal(flow.depositedUsd, 100)
  assert.equal(flow.withdrawnUsd, 0)
  assert.equal(flow.claimedUsd, 0)
  assert.equal(flow.confidence, "exact")
})

test("aave withdraw tx records withdrawal (aToken out + underlying in)", () => {
  const position = basePosition()
  const flow = reconstructFlowFromLedger(position, "ETHEREUM", [
    {
      wallet: "0xabc",
      chain: "ETHEREUM",
      txHash: "0x1",
      legs: [
        { asset: "0xusdc", symbol: "USDC", direction: "out", usd: 100, blockTimestamp: 1 },
        { asset: "0xatoken", symbol: "aEthUSDC", direction: "in", usd: 100, blockTimestamp: 1 },
      ],
    },
    {
      wallet: "0xabc",
      chain: "ETHEREUM",
      txHash: "0x2",
      legs: [
        { asset: "0xatoken", symbol: "aEthUSDC", direction: "out", usd: 120, blockTimestamp: 2 },
        { asset: "0xusdc", symbol: "USDC", direction: "in", usd: 120, blockTimestamp: 2 },
      ],
    },
  ])

  assert.equal(flow.depositedUsd, 100)
  assert.equal(flow.withdrawnUsd, 120)
  assert.equal(flow.claimedUsd, 0)
})

test("pendle roll tx is detected and withheld from realized withdrawal", () => {
  const oldPosition = basePosition({
    symbol: "PT-USDe-25SEP2025",
    protocol: "Pendle",
    defiProject: "pendle",
    contractAddress: "0xpt-old",
    underlying: "USDe",
  })
  const flow = reconstructFlowFromLedger(oldPosition, "ETHEREUM", [
    {
      wallet: "0xabc",
      chain: "ETHEREUM",
      txHash: "0x1",
      legs: [
        { asset: "0xusde", symbol: "USDe", direction: "out", usd: 100, blockTimestamp: 1 },
        { asset: "0xpt-old", symbol: "PT-USDe-25SEP2025", direction: "in", usd: 100, blockTimestamp: 1 },
      ],
    },
    {
      wallet: "0xabc",
      chain: "ETHEREUM",
      txHash: "0x2",
      legs: [
        { asset: "0xpt-old", symbol: "PT-USDe-25SEP2025", direction: "out", usd: 110, blockTimestamp: 2 },
        { asset: "0xpt-new", symbol: "PT-USDe-26DEC2025", direction: "in", usd: 110, blockTimestamp: 2 },
      ],
    },
  ])

  assert.equal(flow.depositedUsd, 100)
  assert.equal(flow.withdrawnUsd, 0)
  assert.equal(flow.rolloverTxs, 1)
  assert.equal(flow.confidence, "modeled")
})

test("etherfi receipt mint uses counterpart outflow as deposit basis", () => {
  const position = basePosition({
    symbol: "eETH",
    protocol: "EtherFi",
    defiProject: "ether.fi-stake",
    underlying: "ETH",
    contractAddress: "0xeeeth",
  })
  const flow = reconstructFlowFromLedger(position, "ETHEREUM", [
    {
      wallet: "0xabc",
      chain: "ETHEREUM",
      txHash: "0x1",
      legs: [
        { asset: "native", symbol: "ETH", direction: "out", usd: 5000, blockTimestamp: 1 },
        { asset: "0xeeeth", symbol: "eETH", direction: "in", usd: 5000, blockTimestamp: 1 },
      ],
    },
  ])

  assert.equal(flow.depositedUsd, 5000)
  assert.equal(flow.withdrawnUsd, 0)
})

test("etherfi wrapper conversion is treated as rollover not realized exit", () => {
  const oldPosition = basePosition({
    symbol: "eETH",
    protocol: "EtherFi",
    defiProject: "ether.fi-stake",
    underlying: "ETH",
    contractAddress: "0xeeeth",
  })

  const flow = reconstructFlowFromLedger(oldPosition, "ETHEREUM", [
    {
      wallet: "0xabc",
      chain: "ETHEREUM",
      txHash: "0x1",
      legs: [
        { asset: "0xeeeth", symbol: "eETH", direction: "out", usd: 6000, blockTimestamp: 2 },
        { asset: "0xweeth", symbol: "weETH", direction: "in", usd: 6000, blockTimestamp: 2 },
      ],
    },
  ])

  assert.equal(flow.withdrawnUsd, 0)
  assert.equal(flow.rolloverTxs, 1)
})

test("strict distributor claim matching counts claim only for known Aave controller", () => {
  const position = basePosition()
  const flow = reconstructFlowFromLedger(position, "ETHEREUM", [
    {
      wallet: "0xabc",
      chain: "ETHEREUM",
      txHash: "0x1",
      legs: [
        { asset: "0xatoken", symbol: "aEthUSDC", direction: "out", usd: 100, blockTimestamp: 1 },
        { asset: "0xusdc", symbol: "USDC", direction: "in", usd: 100, blockTimestamp: 1 },
        {
          asset: "0xreward",
          symbol: "AAVE",
          direction: "in",
          usd: 4,
          from: "0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb",
          category: "reward",
          blockTimestamp: 1,
        },
      ],
    },
  ])

  assert.equal(flow.withdrawnUsd, 100)
  assert.equal(flow.claimedUsd, 4)
  assert.equal(flow.confidence, "exact")
})

test("unknown reward inflow does not count as claimed and downgrades confidence", () => {
  const position = basePosition()
  const flow = reconstructFlowFromLedger(position, "ETHEREUM", [
    {
      wallet: "0xabc",
      chain: "ETHEREUM",
      txHash: "0x1",
      legs: [
        { asset: "0xatoken", symbol: "aEthUSDC", direction: "out", usd: 100, blockTimestamp: 1 },
        { asset: "0xusdc", symbol: "USDC", direction: "in", usd: 100, blockTimestamp: 1 },
        {
          asset: "0xreward",
          symbol: "AAVE",
          direction: "in",
          usd: 4,
          from: "0x0000000000000000000000000000000000000001",
          category: "reward",
          blockTimestamp: 1,
        },
      ],
    },
  ])

  assert.equal(flow.withdrawnUsd, 104)
  assert.equal(flow.claimedUsd, 0)
  assert.equal(flow.confidence, "modeled")
})
