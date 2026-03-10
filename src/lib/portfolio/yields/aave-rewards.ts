/**
 * Aave V3 claimable rewards reader.
 * Reads unclaimed incentive rewards from Aave RewardsController contracts.
 * Zerion misses these — this reads them directly from on-chain.
 */

import { formatUnits } from "viem"
import { getPublicClient, safeContractRead, resolveERC20Token } from "../multi-chain-client"

// ─── RewardsController addresses by chain ───

const REWARDS_CONTROLLER: Record<number, `0x${string}`> = {
  1:     "0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb",  // Ethereum
  42161: "0x929EC64c34a17401F460460D4B9390518E5B473e",  // Arbitrum
  10:    "0x929EC64c34a17401F460460D4B9390518E5B473e",  // Optimism
  137:   "0x929EC64c34a17401F460460D4B9390518E5B473e",  // Polygon
  8453:  "0xf9cc4F0D883F1a1eb2c253bdb46c254Ca51E1F44",  // Base
  43114: "0x929EC64c34a17401F460460D4B9390518E5B473e",  // Avalanche
}

// ─── ABI ───

const GET_ALL_USER_REWARDS_ABI = [
  {
    name: "getAllUserRewards",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "assets", type: "address[]" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "rewardsList", type: "address[]" },
      { name: "unclaimedAmounts", type: "uint256[]" },
    ],
  },
] as const

// ─── Types ───

export interface AaveRewardItem {
  chainId: number
  rewardToken: string
  symbol: string
  decimals: number
  amount: number       // human-readable
  amountRaw: string    // raw wei
  usdValue: number | null
}

// ─── Cache ───

interface RewardsCache {
  rewards: AaveRewardItem[]
  timestamp: number
}

const rewardsCache = new Map<string, RewardsCache>()
const REWARDS_CACHE_TTL_MS = 2 * 60_000 // 2 minutes

/**
 * Get all unclaimed Aave V3 rewards for a user on a specific chain.
 * @param chainId - EVM chain ID
 * @param userAddress - wallet address
 * @param aTokenAddresses - array of aToken addresses the user holds on this chain
 * @param getUsdPrice - optional callback to resolve USD price for a token
 */
export async function getAaveV3ClaimableRewards(
  chainId: number,
  userAddress: string,
  aTokenAddresses: string[],
  getUsdPrice?: (chainId: number, tokenAddress: string, symbol: string) => Promise<number | null>,
): Promise<AaveRewardItem[]> {
  if (aTokenAddresses.length === 0) return []

  const cacheKey = `${chainId}:${userAddress.toLowerCase()}`
  const cached = rewardsCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < REWARDS_CACHE_TTL_MS) {
    return cached.rewards
  }

  const controllerAddress = REWARDS_CONTROLLER[chainId]
  if (!controllerAddress) return []

  const client = getPublicClient(chainId)
  if (!client) return []

  const assets = aTokenAddresses.map((a) => a as `0x${string}`)
  const user = userAddress as `0x${string}`

  // Call getAllUserRewards
  const result = await safeContractRead<readonly [`0x${string}`[], bigint[]]>(client, {
    address: controllerAddress,
    abi: GET_ALL_USER_REWARDS_ABI,
    functionName: "getAllUserRewards",
    args: [assets, user],
  }, 15_000)

  if (!result) return []

  const [rewardTokens, unclaimedAmounts] = result

  if (!rewardTokens || rewardTokens.length === 0) return []

  // Resolve each reward token
  const rewards: AaveRewardItem[] = []

  for (let i = 0; i < rewardTokens.length; i++) {
    const amount = unclaimedAmounts[i]
    if (!amount || amount === 0n) continue

    const tokenAddress = rewardTokens[i]
    const { symbol, decimals } = await resolveERC20Token(client, tokenAddress)
    const humanAmount = Number(formatUnits(amount, decimals))

    let usdValue: number | null = null
    if (getUsdPrice) {
      usdValue = await getUsdPrice(chainId, tokenAddress, symbol)
      if (usdValue !== null) {
        usdValue = humanAmount * usdValue
      }
    }

    rewards.push({
      chainId,
      rewardToken: tokenAddress,
      symbol,
      decimals,
      amount: humanAmount,
      amountRaw: amount.toString(),
      usdValue,
    })
  }

  rewardsCache.set(cacheKey, { rewards, timestamp: Date.now() })

  if (rewards.length > 0) {
    console.log(`[aave-rewards] Chain ${chainId} user ${userAddress.slice(0, 10)}...: ${rewards.length} reward token(s) found`)
  }

  return rewards
}

/** Check if a chain has an Aave RewardsController deployment */
export function hasAaveRewardsController(chainId: number): boolean {
  return chainId in REWARDS_CONTROLLER
}
