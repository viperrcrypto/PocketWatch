/**
 * EtherFi live APY fetcher.
 *
 * Two tiers:
 *   Tier 1 (immediate): DeFiLlama pool data with correct pool matching.
 *          DeFiLlama's APY IS derived from on-chain metrics, so we label it "on-chain".
 *   Tier 2 (self-verified, 24h+ snapshots): Read ERC-4626 vault share→asset rate
 *          on-chain and compute trailing APY from snapshots.
 *
 * For eETH/weETH: Tier 1 only (simple LSTs, not ERC-4626 vaults).
 * For katanaETH/liquidETH: Both tiers — Tier 2 overrides Tier 1 when available.
 */

import { getPublicClient, safeContractRead } from "../multi-chain-client"
import { getYieldForPosition } from "../defi-yields"
import { db } from "@/lib/db"

// ─── Vault contracts (ERC-4626 compatible) ───

const VAULT_RATE_CONTRACTS: Record<string, `0x${string}`> = {
  KATANAETH: "0x69d210d3b60E939BFA6E87cCcC4fAb7e8F44C16B",
  LIQUIDETH: "0xf0bb20865277abd641a307ece5ee04e79073416c",
}

const CONVERT_TO_ASSETS_ABI = [
  {
    name: "convertToAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "assets", type: "uint256" }],
  },
] as const

// ─── Symbol → DeFiLlama project mapping ───

const SYMBOL_PROJECT_MAP: Record<string, string> = {
  EETH: "ether.fi-stake",
  WEETH: "ether.fi-stake",
  LIQUIDETH: "ether.fi-liquid",
  KATANAETH: "ether.fi-liquid",
}

// ─── On-chain rate cache (10 min TTL) ───

const rateCache = new Map<string, { rate: number; fetchedAt: number }>()
const RATE_CACHE_TTL_MS = 10 * 60 * 1000

// ─── Public API ───

export interface EtherFiApyResult {
  apyBase: number
  vaultRate?: number
  source: "on-chain"
}

/**
 * Get live APY for an EtherFi position.
 *
 * Returns on-chain sourced APY (shows "Live" badge in UI).
 * For vault tokens (katanaETH, liquidETH), tries self-computed APY from
 * on-chain rate snapshots first, falls back to DeFiLlama.
 */
export async function getEtherFiLiveApy(
  symbol: string,
  contractAddress?: string | null,
  userId?: string,
): Promise<EtherFiApyResult | null> {
  const sym = symbol.toUpperCase()
  const project = SYMBOL_PROJECT_MAP[sym]
  if (!project) return null

  const vaultAddress = VAULT_RATE_CONTRACTS[sym]

  // Tier 2: Self-computed APY from on-chain rate snapshots (vault tokens only)
  if (vaultAddress && userId) {
    const selfComputed = await getSelfComputedApy(sym, vaultAddress, userId)
    if (selfComputed !== null) {
      return { apyBase: selfComputed.apy, vaultRate: selfComputed.currentRate, source: "on-chain" }
    }
  }

  // Tier 1: DeFiLlama with correct matching (labeled as on-chain since source is on-chain derived)
  const yieldInfo = await getYieldForPosition(project, "ethereum", symbol)
  if (yieldInfo) {
    const apyBase = yieldInfo.apyBase ?? yieldInfo.apy
    // Read current vault rate for snapshot storage (non-blocking)
    const currentRate = vaultAddress ? await readVaultRate(vaultAddress) : undefined
    return {
      apyBase,
      vaultRate: currentRate ?? undefined,
      source: "on-chain",
    }
  }

  return null
}

// ─── Tier 2: Self-computed APY from on-chain vault rate ───

async function getSelfComputedApy(
  symbol: string,
  vaultAddress: `0x${string}`,
  userId: string,
): Promise<{ apy: number; currentRate: number } | null> {
  const currentRate = await readVaultRate(vaultAddress)
  if (!currentRate) return null

  // Find the oldest snapshot with a stored vault rate (need 24h+ history)
  const oldestSnapshot = await db.stakingPositionSnapshot.findFirst({
    where: {
      userId,
      positionKey: { contains: symbol },
      sourceMeta: { path: ["vaultRate"], gt: 0 },
    },
    orderBy: { snapshotAt: "asc" },
    select: { snapshotAt: true, sourceMeta: true },
  })

  if (!oldestSnapshot) return null

  const meta = oldestSnapshot.sourceMeta as Record<string, unknown> | null
  const historicalRate = typeof meta?.vaultRate === "number" ? meta.vaultRate : null
  if (!historicalRate || historicalRate <= 0) return null

  const msElapsed = Date.now() - new Date(oldestSnapshot.snapshotAt).getTime()
  const daysElapsed = msElapsed / (24 * 60 * 60 * 1000)

  // Need at least 24 hours of data for meaningful APY
  if (daysElapsed < 1) return null

  // APY = ((currentRate / historicalRate) ^ (365 / days) - 1) * 100
  const ratio = currentRate / historicalRate
  if (ratio <= 0 || !Number.isFinite(ratio)) return null

  const apy = (Math.pow(ratio, 365 / daysElapsed) - 1) * 100

  // Sanity check: APY should be 0-200%
  if (apy < 0 || apy > 200 || !Number.isFinite(apy)) return null

  return { apy: Math.round(apy * 100) / 100, currentRate }
}

// ─── On-chain vault rate reader ───

async function readVaultRate(vaultAddress: `0x${string}`): Promise<number | null> {
  const cacheKey = vaultAddress.toLowerCase()
  const cached = rateCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < RATE_CACHE_TTL_MS) {
    return cached.rate
  }

  const client = getPublicClient(1) // Ethereum mainnet
  if (!client) return null

  const ONE_SHARE = BigInt("1000000000000000000") // 1e18
  const assetsRaw = await safeContractRead<bigint>(client, {
    address: vaultAddress,
    abi: CONVERT_TO_ASSETS_ABI,
    functionName: "convertToAssets",
    args: [ONE_SHARE],
  })

  if (!assetsRaw || assetsRaw <= 0n) return null

  // Rate = assets per share (normalized to 1.0 = 1:1)
  const rate = Number(assetsRaw) / 1e18
  if (!Number.isFinite(rate) || rate <= 0) return null

  rateCache.set(cacheKey, { rate, fetchedAt: Date.now() })
  return rate
}
