/**
 * Yield resolver orchestrator.
 * Single entry point for all yield/APY data. Routes to the best source:
 *   1. Aave V3 → on-chain APY (exact match with app.aave.com)
 *   2. Pendle  → Pendle API implied APY + P&L (exact match with app.pendle.finance)
 *   3. Others  → DefiLlama + Merkl incentives (existing fallback)
 */

import { ZERION_CHAIN_ID_MAP } from "../multi-chain-client"
import { getAaveV3LiveApy, isAaveV3Supported } from "./aave-v3"
import { getAaveV3ClaimableRewards, type AaveRewardItem } from "./aave-rewards"
import { getPendleMarketApy, getPendleUserPositions, isPendleSupported } from "./pendle"
import { getEtherFiLiveApy } from "./etherfi-apy"
import { getYieldForPosition } from "../defi-yields"
import { getMerklIncentiveApr } from "../merkl-yields"

// ─── Types ───

export type YieldSource = "on-chain" | "pendle-api" | "defillama"

export interface YieldResult {
  apyBase: number
  apyReward: number | null
  totalApy: number
  source: YieldSource
  pnl: number | null
  pnlPercent: number | null
  maturityDate: string | null
  /** ERC-4626 vault share→asset rate (for EtherFi vaults). Stored in snapshot sourceMeta. */
  vaultRate?: number
  /** Pendle market address for position-level valuation matching. */
  marketAddress?: string | null
}

export interface RewardItem {
  wallet?: string | null
  chainId: number
  rewardToken: string
  symbol: string
  decimals: number
  amount: number
  amountRaw: string
  usdValue: number | null
  source: "aave-rewards-controller" | "zerion"
}

// ─── Position descriptor (what the route passes in) ───

interface PositionInput {
  defiProject: string | null
  chain: string                // Zerion chain name
  symbol: string
  underlying: string | null
  contractAddress: string | null
  value: number
  userId?: string
}

// ─── Resolve yield for a single position ───

export async function resolveYield(position: PositionInput): Promise<YieldResult | null> {
  const chainId = ZERION_CHAIN_ID_MAP[position.chain?.toLowerCase()]
  const project = position.defiProject

  // ─── Route 1: Aave V3 (on-chain) ───
  if (project === "aave-v3" && chainId && isAaveV3Supported(chainId) && position.contractAddress) {
    try {
      const [onChain, merklApr] = await Promise.all([
        getAaveV3LiveApy(chainId, position.contractAddress),
        getMerklIncentiveApr(position.chain, project, {
          positionAddress: position.contractAddress,
        }),
      ])

      if (onChain) {
        const apyReward = merklApr && merklApr > 0 ? merklApr : null
        const totalApy = onChain.apyBase + (apyReward ?? 0)
        return {
          apyBase: onChain.apyBase,
          apyReward,
          totalApy,
          source: "on-chain",
          pnl: null,
          pnlPercent: null,
          maturityDate: null,
        }
      }
    } catch (err) {
      console.warn(`[yields] Aave on-chain read failed for ${position.symbol}:`, err)
    }
  }

  // ─── Route 1.5: EtherFi (on-chain / DeFiLlama-derived) ───
  if (
    (project === "ether.fi-stake" || project === "ether.fi-liquid")
    && position.symbol
  ) {
    try {
      const etherfi = await getEtherFiLiveApy(
        position.symbol,
        position.contractAddress,
        position.userId,
      )
      if (etherfi) {
        return {
          apyBase: etherfi.apyBase,
          apyReward: null,
          totalApy: etherfi.apyBase,
          source: "on-chain",
          pnl: null,
          pnlPercent: null,
          maturityDate: null,
          vaultRate: etherfi.vaultRate,
        }
      }
    } catch (err) {
      console.warn(`[yields] EtherFi APY fetch failed for ${position.symbol}:`, err)
    }
    // Fall through to DeFiLlama
  }

  // ─── Route 2: Pendle (API) ───
  if (project === "pendle" && chainId && isPendleSupported(chainId)) {
    try {
      const marketData = await getPendleMarketApy(chainId, position.symbol, position.contractAddress)
      if (marketData) {
        return {
          apyBase: marketData.impliedApy,
          apyReward: null,
          totalApy: marketData.impliedApy,
          source: "pendle-api",
          pnl: null,
          pnlPercent: null,
          maturityDate: marketData.maturityDate,
          marketAddress: marketData.marketAddress,
        }
      }
    } catch (err) {
      console.warn(`[yields] Pendle API failed for ${position.symbol}:`, err)
    }
    // Do not fall back to generic pools for Pendle; it tends to overstate APY.
    // Returning null is safer than showing an inaccurate rate.
    return null
  }

  // ─── Route 3: DefiLlama + Merkl (fallback) ───
  if (project) {
    try {
      const [yieldInfo, merklApr] = await Promise.all([
        getYieldForPosition(project, position.chain, position.symbol),
        getMerklIncentiveApr(position.chain, project, {
          positionAddress: position.contractAddress,
        }),
      ])

      if (yieldInfo) {
        const apyBase = yieldInfo.apyBase ?? yieldInfo.apy
        const apyReward = ((yieldInfo.apyReward ?? 0) + (merklApr ?? 0)) || null
        const totalApy = apyBase + (apyReward ?? 0)
        return {
          apyBase,
          apyReward,
          totalApy,
          source: "defillama",
          pnl: null,
          pnlPercent: null,
          maturityDate: null,
        }
      }

      // DefiLlama missed but Merkl has data
      if (merklApr && merklApr > 0) {
        return {
          apyBase: 0,
          apyReward: merklApr,
          totalApy: merklApr,
          source: "defillama",
          pnl: null,
          pnlPercent: null,
          maturityDate: null,
        }
      }
    } catch (err) {
      console.warn(`[yields] DefiLlama/Merkl failed for ${position.symbol}:`, err)
    }
  }

  return null
}

// ─── Resolve Pendle valuations (current position value from Pendle API) ───

/**
 * Fetch Pendle position valuations across all chains for the given wallets.
 * Returns a Map keyed by `${chainId}:${marketAddress}` → total USD valuation.
 * Used to override Zerion's value with Pendle's authoritative pricing.
 *
 * Note: Pendle API v2 uses `marketId` as the market contract address (0x...).
 * The consumer (`applyPendleValuations`) looks up by `pendleMarketAddress`
 * from `getPendleMarketApy`, which returns `match.address` — the same value.
 */
export async function resolvePendleValuations(
  walletAddresses: string[],
): Promise<Map<string, number>> {
  const valuationMap = new Map<string, number>()
  try {
    const results = await Promise.all(
      walletAddresses.map((addr) => getPendleUserPositions(addr)),
    )
    for (const positions of results) {
      for (const pos of positions) {
        const key = `${pos.chainId}:${pos.marketId.toLowerCase()}`
        const total = pos.ptValuation + pos.ytValuation + pos.lpValuation
        valuationMap.set(key, (valuationMap.get(key) ?? 0) + total)
      }
    }
  } catch (err) {
    console.warn("[yields] Pendle valuation fetch failed:", err)
  }
  return valuationMap
}

// ─── Resolve on-chain Aave rewards ───

interface AaveRewardsInput {
  chainId: number
  aTokenAddresses: string[]
}

/**
 * Fetch Aave V3 claimable rewards for a user across chains.
 * Groups positions by chain and calls RewardsController once per chain.
 */
export async function resolveAaveRewards(
  positionsByChain: AaveRewardsInput[],
  walletAddresses: string[],
  getUsdPrice?: (chainId: number, tokenAddress: string, symbol: string) => Promise<number | null>,
): Promise<RewardItem[]> {
  const allRewards: RewardItem[] = []

  const promises: Promise<void>[] = []

  for (const { chainId, aTokenAddresses } of positionsByChain) {
    for (const wallet of walletAddresses) {
      promises.push(
        getAaveV3ClaimableRewards(chainId, wallet, aTokenAddresses, getUsdPrice)
          .then((rewards) => {
            for (const r of rewards) {
              allRewards.push({ ...r, wallet, source: "aave-rewards-controller" })
            }
          })
          .catch((err) => {
            console.warn(`[yields] Aave rewards fetch failed for chain ${chainId}:`, err)
          })
      )
    }
  }

  await Promise.all(promises)
  return allRewards
}
