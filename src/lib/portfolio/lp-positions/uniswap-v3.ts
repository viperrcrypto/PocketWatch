/**
 * Uniswap V3 on-chain LP position decoder.
 * Reads positions from the NonfungiblePositionManager contract via Alchemy RPC.
 */

import { getServiceKey } from "@/lib/portfolio/service-keys"
import { ALCHEMY_CHAIN_SLUGS } from "@/lib/tracker/chains"

// NonfungiblePositionManager contract — same address on all EVM chains
const POSITION_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"

// Minimal ABI function selectors
const SELECTORS = {
  // balanceOf(address) → uint256
  balanceOf: "0x70a08231",
  // tokenOfOwnerByIndex(address, uint256) → uint256
  tokenOfOwnerByIndex: "0x2f745c59",
  // positions(uint256) → (nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, ...)
  positions: "0x99fbab88",
} as const

// Uniswap V3 Factory — same on all chains
const FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
// getPool(token0, token1, fee) selector
const GET_POOL_SELECTOR = "0x1698ee82"
// slot0() selector on Pool contract
const SLOT0_SELECTOR = "0x3850c7bd"

const RPC_TIMEOUT_MS = 12_000

export interface UniV3Position {
  tokenId: string
  token0: string
  token1: string
  fee: number           // basis points (500, 3000, 10000)
  tickLower: number
  tickUpper: number
  liquidity: bigint
  // Calculated amounts (raw BigInt as string to avoid Number truncation)
  amount0: string
  amount1: string
  // Pool state
  currentTick: number
  sqrtPriceX96: bigint
  // Status
  inRange: boolean
}

export interface LPPositionWithValue extends UniV3Position {
  chain: string
  wallet: string
  token0Symbol: string | null
  token1Symbol: string | null
  token0Decimals: number
  token1Decimals: number
  value0Usd: number | null
  value1Usd: number | null
  totalValueUsd: number | null
  impermanentLossPercent: number | null
  feeApr: number | null
}

// ─── RPC Helpers ───

async function rpcCall(
  alchemySlug: string,
  alchemyKey: string,
  to: string,
  data: string,
): Promise<string> {
  const url = `https://${alchemySlug}.g.alchemy.com/v2/${alchemyKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  })
  const json = await res.json()
  if (json.error) throw new Error(`RPC error: ${json.error.message}`)
  return json.result as string
}

function padAddress(addr: string): string {
  return "0x" + addr.replace("0x", "").toLowerCase().padStart(64, "0")
}

function padUint256(n: number | bigint): string {
  return "0x" + BigInt(n).toString(16).padStart(64, "0")
}

function decodeUint256(hex: string, offset: number): bigint {
  const start = 2 + offset * 64
  return BigInt("0x" + hex.slice(start, start + 64))
}

function decodeAddress(hex: string, offset: number): string {
  const start = 2 + offset * 64
  return "0x" + hex.slice(start + 24, start + 64)
}

function decodeInt24(hex: string, offset: number): number {
  const raw = Number(decodeUint256(hex, offset) & 0xFFFFFFn)
  return raw > 0x7FFFFF ? raw - 0x1000000 : raw
}

// ─── Tick Math (Uniswap V3 concentrated liquidity) ───

const Q96 = BigInt(2) ** BigInt(96)
const Q192 = Q96 * Q96

function tickToSqrtPriceX96(tick: number): bigint {
  const absTick = Math.abs(tick)
  let ratio: bigint = (absTick & 0x1) !== 0 ? 0xFFFCB933BD6FAD37AA2D162D1A594001n : 0x100000000000000000000000000000000n
  if ((absTick & 0x2) !== 0) ratio = (ratio * 0xFFF97272373D413259A46990580E213An) >> 128n
  if ((absTick & 0x4) !== 0) ratio = (ratio * 0xFFF2E50F5F656932EF12357CF3C7FDCCn) >> 128n
  if ((absTick & 0x8) !== 0) ratio = (ratio * 0xFFE5CACA7E10E4E61C3624EAA0941CD0n) >> 128n
  if ((absTick & 0x10) !== 0) ratio = (ratio * 0xFFCB9843D60F6159C9DB58835C926644n) >> 128n
  if ((absTick & 0x20) !== 0) ratio = (ratio * 0xFF973B41FA98C081472E6896DFB254C0n) >> 128n
  if ((absTick & 0x40) !== 0) ratio = (ratio * 0xFF2EA16466C96A3843EC78B326B52861n) >> 128n
  if ((absTick & 0x80) !== 0) ratio = (ratio * 0xFE5DEE046A99A2A811C461F1969C3053n) >> 128n
  if ((absTick & 0x100) !== 0) ratio = (ratio * 0xFCBE86C7900A88AEDCFFC83B479AA3A4n) >> 128n
  if ((absTick & 0x200) !== 0) ratio = (ratio * 0xF987A7253AC413176F2B074CF7815E54n) >> 128n
  if ((absTick & 0x400) !== 0) ratio = (ratio * 0xF3392B0822B70005940C7A398E4B70F3n) >> 128n
  if ((absTick & 0x800) !== 0) ratio = (ratio * 0xE7159475A2C29B7443B29C7FA6E889D9n) >> 128n
  if ((absTick & 0x1000) !== 0) ratio = (ratio * 0xD097F3BDFD2022B8845AD8F792AA5825n) >> 128n
  if ((absTick & 0x2000) !== 0) ratio = (ratio * 0xA9F746462D870FDF8A65DC1F90E061E5n) >> 128n
  if ((absTick & 0x4000) !== 0) ratio = (ratio * 0x70D869A156D2A1B890BB3DF62BAF32F7n) >> 128n
  if ((absTick & 0x8000) !== 0) ratio = (ratio * 0x31BE135F97D08FD981231505542FCFA6n) >> 128n
  if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9AA508B5B7A84E1C677DE54F3E99BC9n) >> 128n
  if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5D6AF8DEDB81196699C329225EE604n) >> 128n
  if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216E584F5FA1EA926041BEDFE98n) >> 128n
  if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48A170391F7DC42444E8FA2n) >> 128n

  if (tick > 0) ratio = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn / ratio

  // Convert from Q128.128 to Q64.96
  return (ratio >> 32n) + (ratio % (1n << 32n) > 0n ? 1n : 0n)
}

function calculateAmounts(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  sqrtPriceX96: bigint,
): { amount0: bigint; amount1: bigint } {
  const sqrtLower = tickToSqrtPriceX96(tickLower)
  const sqrtUpper = tickToSqrtPriceX96(tickUpper)

  let amount0 = BigInt(0)
  let amount1 = BigInt(0)

  if (currentTick < tickLower) {
    // All token0
    amount0 = (liquidity * Q96 * (sqrtUpper - sqrtLower)) / (sqrtLower * sqrtUpper)
  } else if (currentTick >= tickUpper) {
    // All token1
    amount1 = (liquidity * (sqrtUpper - sqrtLower)) / Q96
  } else {
    // In range — split between token0 and token1
    amount0 = (liquidity * Q96 * (sqrtUpper - sqrtPriceX96)) / (sqrtPriceX96 * sqrtUpper)
    amount1 = (liquidity * (sqrtPriceX96 - sqrtLower)) / Q96
  }

  return { amount0, amount1 }
}

// ─── Main Fetch Function ───

/**
 * Fetch all Uniswap V3 LP positions for a wallet on a specific chain.
 */
export async function fetchUniV3Positions(
  wallet: string,
  chain: string,
  alchemyKey: string,
): Promise<UniV3Position[]> {
  const slug = ALCHEMY_CHAIN_SLUGS[chain as keyof typeof ALCHEMY_CHAIN_SLUGS]
  if (!slug) return [] // Chain not supported by Alchemy

  // 1. Get position count
  const balanceData = SELECTORS.balanceOf + padAddress(wallet).slice(2)
  let balanceHex: string
  try {
    balanceHex = await rpcCall(slug, alchemyKey, POSITION_MANAGER, balanceData)
  } catch {
    return [] // Contract may not exist on this chain
  }

  const count = Number(decodeUint256(balanceHex, 0))
  if (count === 0) return []

  // Cap at 50 positions to avoid excessive RPC calls
  const maxPositions = Math.min(count, 50)

  // 2. Get token IDs
  const tokenIds: bigint[] = []
  for (let i = 0; i < maxPositions; i++) {
    const data = SELECTORS.tokenOfOwnerByIndex + padAddress(wallet).slice(2) + padUint256(i).slice(2)
    const result = await rpcCall(slug, alchemyKey, POSITION_MANAGER, data)
    tokenIds.push(decodeUint256(result, 0))
  }

  // 3. Get position details + pool state
  const positions: UniV3Position[] = []
  for (const tokenId of tokenIds) {
    try {
      const posData = SELECTORS.positions + padUint256(tokenId).slice(2)
      const posResult = await rpcCall(slug, alchemyKey, POSITION_MANAGER, posData)

      // positions() returns: nonce(0), operator(1), token0(2), token1(3), fee(4),
      // tickLower(5), tickUpper(6), liquidity(7), ...
      const token0 = decodeAddress(posResult, 2)
      const token1 = decodeAddress(posResult, 3)
      const fee = Number(decodeUint256(posResult, 4))
      const tickLower = decodeInt24(posResult, 5)
      const tickUpper = decodeInt24(posResult, 6)
      const liquidity = decodeUint256(posResult, 7)

      // Skip closed positions (zero liquidity)
      if (liquidity === BigInt(0)) continue

      // 4. Get pool address
      const getPoolData = GET_POOL_SELECTOR +
        padAddress(token0).slice(2) +
        padAddress(token1).slice(2) +
        padUint256(fee).slice(2)
      const poolResult = await rpcCall(slug, alchemyKey, FACTORY, getPoolData)
      const poolAddress = decodeAddress(poolResult, 0)

      // 5. Get current pool state (slot0)
      const slot0Result = await rpcCall(slug, alchemyKey, poolAddress, SLOT0_SELECTOR)
      const sqrtPriceX96 = decodeUint256(slot0Result, 0)
      const currentTick = decodeInt24(slot0Result, 1)

      // 6. Calculate token amounts
      const { amount0, amount1 } = calculateAmounts(
        liquidity, tickLower, tickUpper, currentTick, sqrtPriceX96,
      )

      positions.push({
        tokenId: tokenId.toString(),
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        liquidity,
        amount0: amount0.toString(),
        amount1: amount1.toString(),
        currentTick,
        sqrtPriceX96,
        inRange: currentTick >= tickLower && currentTick < tickUpper,
      })
    } catch (err) {
      console.warn(`[uniswap-v3] Failed to decode position ${tokenId}:`, (err as Error).message)
    }
  }

  return positions
}
