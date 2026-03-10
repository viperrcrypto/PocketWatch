// ─── Team.Finance Vesting/Lock Claims Checker ───

import { formatUnits } from "viem"
import type { VestingChecker, VestingScanResult, VestingClaim } from "./types"
import { getPublicClient, EIP155_TO_INTERNAL, withTimeout, resolveERC20Token } from "./rpc"

// ─── Contract ABI (read-only functions) ───

const TEAM_FINANCE_ABI = [
  {
    name: "getDepositsByWithdrawalAddress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_withdrawalAddress", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getDepositDetails",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_id", type: "uint256" }],
    outputs: [
      { name: "tokenAddress", type: "address" },
      { name: "withdrawalAddress", type: "address" },
      { name: "tokenAmount", type: "uint256" },
      { name: "unlockTime", type: "uint256" },
      { name: "withdrawn", type: "bool" },
      { name: "tokenId", type: "uint256" },
      { name: "isNFT", type: "bool" },
      { name: "lockType", type: "uint256" },
      { name: "isMintedNFT", type: "bool" },
    ],
  },
] as const

// ─── Supported Chains ───

const TEAM_FINANCE_CONTRACTS: Record<number, `0x${string}`> = {
  1: "0xe2fe530c047f2d85298b07d9333c05737f1435fb",
  56: "0x0c89c0407775dd89b12918b9c0aa42bf96518820",
  137: "0x3eF7442dF454bA6b7C1deEc8DdF29Cfb2d6e56c7",
  42161: "0xE0B0D2021293Bee9715e1Db3be31b55C00F72A75",
  8453: "0x4f0fd563be89ec8c3e7d595bf3639128c0a7c33a",
  43114: "0x88ada02f6fce2f1a833cd9b4999d62a7ebb70367",
}

const MAX_DEPOSITS_PER_ADDRESS = 50
const DEFAULT_TIMEOUT_MS = 15_000

// ─── Helpers ───

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatUnlockDate(unlockTimestamp: bigint): string {
  return new Date(Number(unlockTimestamp) * 1000).toISOString()
}

// ─── Per-chain scan logic ───

async function scanChain(
  chainId: number,
  contractAddress: `0x${string}`,
  evmAddresses: string[]
): Promise<{ claims: VestingClaim[]; chainLabel: string }> {
  const client = getPublicClient(chainId)
  const chainLabel = EIP155_TO_INTERNAL[chainId] || `CHAIN_${chainId}`

  if (!client) {
    return { claims: [], chainLabel }
  }

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
  const claims: VestingClaim[] = []

  for (const walletAddress of evmAddresses) {
    let depositIds: readonly bigint[]

    try {
      depositIds = (await client.readContract({
        address: contractAddress,
        abi: TEAM_FINANCE_ABI,
        functionName: "getDepositsByWithdrawalAddress",
        args: [walletAddress as `0x${string}`],
      })) as readonly bigint[]
    } catch {
      // RPC error or wallet has no deposits — skip
      continue
    }

    if (!depositIds || depositIds.length === 0) continue

    // Limit to prevent excessive RPC calls
    const idsToCheck = depositIds.slice(0, MAX_DEPOSITS_PER_ADDRESS)

    for (const depositId of idsToCheck) {
      try {
        const details = (await client.readContract({
          address: contractAddress,
          abi: TEAM_FINANCE_ABI,
          functionName: "getDepositDetails",
          args: [depositId],
        })) as readonly [
          string,  // tokenAddress
          string,  // withdrawalAddress
          bigint,  // tokenAmount
          bigint,  // unlockTime
          boolean, // withdrawn
          bigint,  // tokenId
          boolean, // isNFT
          bigint,  // lockType
          boolean, // isMintedNFT
        ]

        const [
          tokenAddress,
          ,            // withdrawalAddress (already known)
          tokenAmount,
          unlockTime,
          withdrawn,
        ] = details

        // Resolve token symbol and decimals
        const tokenMeta = await resolveERC20Token(client, tokenAddress)

        // Convert raw amount using actual token decimals (formatUnits handles BigInt precision)
        const amountNumber = Number(formatUnits(tokenAmount, tokenMeta.decimals))

        // Determine status (including depleted for withdrawn deposits)
        let status: VestingClaim["status"]
        let claimableAmount: number
        let lockedAmount: number

        if (withdrawn) {
          status = "depleted"
          claimableAmount = 0
          lockedAmount = 0
        } else if (unlockTime <= nowSeconds) {
          status = "claimable"
          claimableAmount = amountNumber
          lockedAmount = 0
        } else {
          status = "locked"
          claimableAmount = 0
          lockedAmount = amountNumber
        }

        const claim: VestingClaim = {
          id: `team-finance-${chainId}-${depositId.toString()}`,
          platform: "Team.Finance",
          token: tokenMeta.symbol,
          tokenAddress,
          chain: chainLabel,
          totalAmount: amountNumber,
          claimedAmount: withdrawn ? amountNumber : 0,
          claimableAmount,
          lockedAmount,
          usdValue: null,
          startDate: null,
          endDate: formatUnlockDate(unlockTime),
          cliffDate: null,
          status,
          claimUrl: "https://www.team.finance/claim",
          iconUrl: "https://www.team.finance/favicon.ico",
          walletAddress,
          contractAddress,
          planId: depositId.toString(),
        }

        claims.push(claim)
      } catch {
        // Individual deposit read failed — skip it
        continue
      }
    }
  }

  return { claims, chainLabel }
}

// ─── Exported Checker ───

export const teamFinanceChecker: VestingChecker = {
  platform: "Team.Finance",
  iconUrl: "https://www.team.finance/favicon.ico",

  async check(
    evmAddresses: string[],
    _solanaAddresses: string[],
    options?: { timeout?: number }
  ): Promise<VestingScanResult> {
    const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS

    if (evmAddresses.length === 0) {
      return {
        claims: [],
        platform: "Team.Finance",
        chainsChecked: [],
      }
    }

    const chainEntries = Object.entries(TEAM_FINANCE_CONTRACTS).map(
      ([id, address]) => ({
        chainId: Number(id),
        contractAddress: address,
      })
    )

    try {
      const results = await Promise.allSettled(
        chainEntries.map(({ chainId, contractAddress }) =>
          withTimeout(
            scanChain(chainId, contractAddress, evmAddresses),
            timeoutMs,
            { claims: [], chainLabel: EIP155_TO_INTERNAL[chainId] || `CHAIN_${chainId}` }
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
        // Rejected promises won't happen with withTimeout fallback,
        // but handle defensively
      }

      return {
        claims: allClaims,
        platform: "Team.Finance",
        chainsChecked,
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error scanning Team.Finance"
      return {
        claims: [],
        platform: "Team.Finance",
        chainsChecked: [],
        error: message,
      }
    }
  },
}
