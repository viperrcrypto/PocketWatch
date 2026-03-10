// ─── Hedgey Finance Vesting/Lockup Claims Checker ───
// Hedgey uses ERC-721 NFTs to represent vesting and lockup plans.
// Same contract addresses across all supported EVM mainnets (except zkSync).

import { formatUnits } from "viem"
import type { VestingChecker, VestingScanResult, VestingClaim } from "./types"
import { getPublicClient, EIP155_TO_INTERNAL, withTimeout, resolveERC20Token } from "./rpc"

// ─── Contract Addresses (same on all mainnets except zkSync) ───

const HEDGEY_CONTRACTS = {
  tokenVestingPlans: "0x2CDE9919e81b20B4B33DD562a48a84b54C48F00C" as `0x${string}`,
  votingTokenVestingPlans: "0x1bb64AF7FE05fc69c740609267d2AbE3e119Ef82" as `0x${string}`,
  tokenLockupPlans: "0x1961A23409CA59EEDCA6a99c97E4087DaD752486" as `0x${string}`,
  votingTokenLockupPlans: "0x73cD8626b3cD47B009E68380720CFE6679A3Ec3D" as `0x${string}`,
} as const

type HedgeyContractType = keyof typeof HEDGEY_CONTRACTS

// ─── Supported Chains ───

const HEDGEY_CHAIN_IDS: number[] = [
  1,      // Ethereum
  42161,  // Arbitrum
  10,     // Optimism
  137,    // Polygon
  8453,   // Base
  56,     // BSC
  43114,  // Avalanche
  100,    // Gnosis
  250,    // Fantom
  59144,  // Linea
  534352, // Scroll
  81457,  // Blast
  5000,   // Mantle
]

// ─── Contract ABI (read-only functions) ───

const HEDGEY_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "plans",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "start", type: "uint256" },
      { name: "cliff", type: "uint256" },
      { name: "rate", type: "uint256" },
      { name: "period", type: "uint256" },
      { name: "vestingAdmin", type: "address" },
      { name: "adminTransferOBO", type: "bool" },
    ],
  },
  {
    name: "planBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "planId", type: "uint256" },
      { name: "blockTime", type: "uint256" },
      { name: "redemptionTime", type: "uint256" },
    ],
    outputs: [
      { name: "balance", type: "uint256" },
      { name: "remainder", type: "uint256" },
      { name: "latestUnlock", type: "uint256" },
    ],
  },
] as const

// ─── Constants ───

const MAX_PLANS_PER_CONTRACT = 20
const DEFAULT_TIMEOUT_MS = 15_000

// ─── Helpers ───

function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address || "UNKNOWN"
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function timestampToIso(ts: bigint): string | null {
  const num = Number(ts)
  if (num <= 0) return null
  return new Date(num * 1000).toISOString()
}

/**
 * Estimate the end date from vesting plan parameters.
 * end = start + (amount / rate) * period
 * Falls back to null if rate or period is zero.
 */
function estimateEndDate(
  start: bigint,
  amount: bigint,
  rate: bigint,
  period: bigint,
): string | null {
  if (rate === 0n || period === 0n) return null
  try {
    const totalPeriods = (amount + rate - 1n) / rate // ceiling division
    const durationSeconds = totalPeriods * period
    const endTimestamp = start + durationSeconds
    return timestampToIso(endTimestamp)
  } catch {
    return null
  }
}

// ─── Per-chain scan logic ───

async function scanChain(
  chainId: number,
  evmAddresses: string[],
): Promise<{ claims: VestingClaim[]; chainLabel: string }> {
  const client = getPublicClient(chainId)
  const chainLabel = EIP155_TO_INTERNAL[chainId] || `CHAIN_${chainId}`

  if (!client) {
    return { claims: [], chainLabel }
  }

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
  const claims: VestingClaim[] = []

  for (const walletAddress of evmAddresses) {
    const addr = walletAddress as `0x${string}`

    for (const contractType of Object.keys(HEDGEY_CONTRACTS) as HedgeyContractType[]) {
      const contractAddress = HEDGEY_CONTRACTS[contractType]

      try {
        // Step 1: Check how many plan NFTs this address owns on this contract
        const nftBalance = await client.readContract({
          address: contractAddress,
          abi: HEDGEY_ABI,
          functionName: "balanceOf",
          args: [addr],
        }) as bigint

        if (nftBalance === 0n) continue

        // Limit to avoid excessive RPC calls
        const count = Number(nftBalance) > MAX_PLANS_PER_CONTRACT
          ? MAX_PLANS_PER_CONTRACT
          : Number(nftBalance)

        // Step 2: Enumerate each owned NFT → get plan details + balance
        for (let i = 0; i < count; i++) {
          try {
            // Get the plan ID (token ID) at this index
            const planId = await client.readContract({
              address: contractAddress,
              abi: HEDGEY_ABI,
              functionName: "tokenOfOwnerByIndex",
              args: [addr, BigInt(i)],
            }) as bigint

            // Get plan details
            const planDetails = await client.readContract({
              address: contractAddress,
              abi: HEDGEY_ABI,
              functionName: "plans",
              args: [planId],
            }) as readonly [
              string,  // token
              bigint,  // amount (remaining locked — vested-unclaimed + unvested)
              bigint,  // start
              bigint,  // cliff
              bigint,  // rate
              bigint,  // period
              string,  // vestingAdmin
              boolean, // adminTransferOBO
            ]

            const [
              tokenAddress,
              amount,
              start,
              cliff,
              rate,
              period,
            ] = planDetails

            // Get current claimable balance
            const planBalance = await client.readContract({
              address: contractAddress,
              abi: HEDGEY_ABI,
              functionName: "planBalanceOf",
              args: [planId, nowSeconds, nowSeconds],
            }) as readonly [bigint, bigint, bigint]

            const [balance, remainder] = planBalance
            // balance = claimable right now
            // remainder = still locked/unvested

            // Resolve token symbol and decimals
            const tokenMeta = await resolveERC20Token(client, tokenAddress)

            // Determine status (including depleted)
            let status: VestingClaim["status"]
            if (balance === 0n && remainder === 0n) {
              status = "depleted"
            } else if (balance > 0n) {
              status = "claimable"
            } else {
              status = "locked"
            }

            // Total amount = claimable + remainder, converted with actual decimals
            const totalRemaining = balance + remainder
            const claimableNumber = Number(formatUnits(balance, tokenMeta.decimals))
            const lockedNumber = Number(formatUnits(remainder, tokenMeta.decimals))
            const totalNumber = Number(formatUnits(totalRemaining, tokenMeta.decimals))

            const claim: VestingClaim = {
              id: `hedgey-${chainId}-${contractType}-${planId.toString()}`,
              platform: "Hedgey",
              token: tokenMeta.symbol,
              tokenAddress,
              chain: chainLabel,
              totalAmount: totalNumber,
              claimedAmount: 0, // Not tracked on-chain per plan in a single read
              claimableAmount: claimableNumber,
              lockedAmount: lockedNumber,
              usdValue: null,
              startDate: timestampToIso(start),
              endDate: estimateEndDate(start, amount, rate, period),
              cliffDate: timestampToIso(cliff),
              status,
              claimUrl: "https://app.hedgey.finance",
              iconUrl: "https://app.hedgey.finance/favicon.ico",
              walletAddress,
              contractAddress,
              planId: planId.toString(),
            }

            claims.push(claim)
          } catch {
            // Individual plan read failed — skip it
            continue
          }
        }
      } catch {
        // balanceOf failed for this contract on this chain — skip
        continue
      }
    }
  }

  return { claims, chainLabel }
}

// ─── Exported Checker ───

export const hedgeyChecker: VestingChecker = {
  platform: "Hedgey",
  iconUrl: "https://app.hedgey.finance/favicon.ico",

  async check(
    evmAddresses: string[],
    _solanaAddresses: string[],
    options?: { timeout?: number },
  ): Promise<VestingScanResult> {
    const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS

    if (evmAddresses.length === 0) {
      return {
        claims: [],
        platform: "Hedgey",
        chainsChecked: [],
      }
    }

    try {
      const results = await Promise.allSettled(
        HEDGEY_CHAIN_IDS.map((chainId) =>
          withTimeout(
            scanChain(chainId, evmAddresses),
            timeoutMs,
            { claims: [], chainLabel: EIP155_TO_INTERNAL[chainId] || `CHAIN_${chainId}` },
          )
        )
      )

      const allClaims: VestingClaim[] = []
      const chainsChecked: string[] = []

      for (const result of results) {
        if (result.status === "fulfilled") {
          allClaims.push(...result.value.claims)
          chainsChecked.push(result.value.chainLabel)
        }
        // Rejected promises are absorbed by withTimeout fallback
      }

      return {
        claims: allClaims,
        platform: "Hedgey",
        chainsChecked,
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error scanning Hedgey"
      return {
        claims: [],
        platform: "Hedgey",
        chainsChecked: [],
        error: message,
      }
    }
  },
}
