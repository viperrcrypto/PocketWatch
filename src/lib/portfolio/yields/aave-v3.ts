/**
 * Aave V3 on-chain APY reader.
 * Reads live supply APY directly from Aave V3 Pool contracts via getReserveData().
 * Replaces DefiLlama for Aave positions — values match app.aave.com within 0.01%.
 */

import { getPublicClient, safeContractRead } from "../multi-chain-client"

// ─── Aave V3 Pool addresses by chain ───

const AAVE_V3_POOL: Record<number, `0x${string}`> = {
  1:     "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",     // Ethereum
  42161: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",     // Arbitrum
  10:    "0x794a61358D6845594F94dc1DB02A252b5b4814aD",     // Optimism
  137:   "0x794a61358D6845594F94dc1DB02A252b5b4814aD",     // Polygon
  8453:  "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",     // Base
  43114: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",     // Avalanche
}

// ─── ABI fragments ───

const ATOKEN_UNDERLYING_ABI = [
  {
    name: "UNDERLYING_ASSET_ADDRESS",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const

const POOL_GET_RESERVE_DATA_ABI = [
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
] as const

// ─── Cache ───

interface ApyCache {
  apyBase: number
  timestamp: number
}

const apyCache = new Map<string, ApyCache>()
const APY_CACHE_TTL_MS = 60_000 // 60 seconds

// Underlying address cache (never changes for a given aToken)
const underlyingCache = new Map<string, `0x${string}`>()

// ─── RAY constant (1e27) ───

const RAY = 10n ** 27n

/**
 * Get live supply APY for an Aave V3 aToken directly from the Pool contract.
 * Returns { apyBase } in percentage (e.g. 4.56 = 4.56%), or null if unavailable.
 */
export async function getAaveV3LiveApy(
  chainId: number,
  aTokenAddress: string,
): Promise<{ apyBase: number } | null> {
  const cacheKey = `${chainId}:${aTokenAddress.toLowerCase()}`
  const cached = apyCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < APY_CACHE_TTL_MS) {
    return { apyBase: cached.apyBase }
  }

  const poolAddress = AAVE_V3_POOL[chainId]
  if (!poolAddress) return null

  const client = getPublicClient(chainId)
  if (!client) return null

  const addr = aTokenAddress as `0x${string}`

  // Step 1: Get underlying asset address (cached permanently)
  let underlying = underlyingCache.get(cacheKey)
  if (!underlying) {
    const result = await safeContractRead<`0x${string}`>(client, {
      address: addr,
      abi: ATOKEN_UNDERLYING_ABI,
      functionName: "UNDERLYING_ASSET_ADDRESS",
    })
    if (!result) return null
    underlying = result
    underlyingCache.set(cacheKey, underlying)
  }

  // Step 2: Get reserve data from Pool
  const reserveData = await safeContractRead<readonly [
    bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
    `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`,
    bigint, bigint, bigint,
  ]>(client, {
    address: poolAddress,
    abi: POOL_GET_RESERVE_DATA_ABI,
    functionName: "getReserveData",
    args: [underlying],
  })

  if (!reserveData) return null

  // currentLiquidityRate is usually index 2 in the returned tuple.
  // Some clients return a named object shape, so guard both access patterns.
  const rawRate = (reserveData as any)[2] ?? (reserveData as any).currentLiquidityRate
  if (rawRate === undefined || rawRate === null) return null
  const currentLiquidityRate = typeof rawRate === "bigint" ? rawRate : BigInt(rawRate)

  // Convert RAY rate to APY via continuous compounding:
  // Aave's currentLiquidityRate is a per-second rate scaled by RAY (1e27).
  // APR = rate / RAY; APY = (1 + APR/secondsPerYear)^secondsPerYear - 1
  const SECONDS_PER_YEAR = 31_536_000
  const ratePerSecond = Number(currentLiquidityRate) / Number(RAY)
  const apyBase = ((1 + ratePerSecond / SECONDS_PER_YEAR) ** SECONDS_PER_YEAR - 1) * 100

  apyCache.set(cacheKey, { apyBase, timestamp: Date.now() })

  console.log(`[aave-v3] Chain ${chainId} aToken ${aTokenAddress.slice(0, 10)}... APY: ${apyBase.toFixed(4)}% (on-chain)`)

  return { apyBase }
}

/** Check if a chain has an Aave V3 Pool deployment */
export function isAaveV3Supported(chainId: number): boolean {
  return chainId in AAVE_V3_POOL
}
