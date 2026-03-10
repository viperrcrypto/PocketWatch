// ─── LlamaPay Vesting Claims Checker ───

import { parseAbiItem, formatUnits, type PublicClient } from "viem"
import type { VestingChecker, VestingScanResult, VestingClaim } from "./types"
import { getPublicClient, EIP155_TO_INTERNAL, withTimeout } from "./rpc"

// ─── Factory Contract Addresses ───

const LLAMAPAY_VESTING_FACTORIES: Record<number, `0x${string}`> = {
  1: "0xcf61782465Ff973638143d6492B51A85986aB347",
  42161: "0x62E13BE78af77C86D38a027ae432F67d9EcD4c10",
  137: "0x62E13BE78af77C86D38a027ae432F67d9EcD4c10",
  10: "0x62E13BE78af77C86D38a027ae432F67d9EcD4c10",
  43114: "0x62E13BE78af77C86D38a027ae432F67d9EcD4c10",
  250: "0x62E13BE78af77C86D38a027ae432F67d9EcD4c10",
  56: "0x62E13BE78af77C86D38a027ae432F67d9EcD4c10",
  8453: "0x62E13BE78af77C86D38a027ae432F67d9EcD4c10",
  81457: "0x62E13BE78af77C86D38a027ae432F67d9EcD4c10",
  100: "0x62E13BE78af77C86D38a027ae432F67d9EcD4c10",
}

// ─── ABIs ───

const VESTING_ESCROW_CREATED_EVENT = parseAbiItem(
  "event VestingEscrowCreated(address indexed funder, address indexed token, address indexed recipient, address escrow, uint256 amount, uint256 vestingStart, uint256 vestingDuration, uint256 cliffLength)"
)

const ESCROW_ABI = [
  {
    name: "unclaimed",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "locked",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "recipient",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "token",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "startTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "endTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalLocked",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalClaimed",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "disabledAt",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

const ERC20_DECIMALS_ABI = [
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const

// ─── Max blocks to scan per getLogs call ───
// Some RPCs limit single getLogs range, so we chunk into windows.

const CHUNK_SIZE = 500_000n
const MAX_TOTAL_BLOCKS = 20_000_000n // ~2.7 years on Ethereum, covers most vesting escrows

// ─── Helpers ───

function timestampToIso(ts: bigint): string | null {
  if (ts === 0n) return null
  return new Date(Number(ts) * 1000).toISOString()
}

interface EscrowDetails {
  escrowAddress: `0x${string}`
  tokenAddress: `0x${string}`
  tokenSymbol: string
  decimals: number
  unclaimed: bigint
  locked: bigint
  totalLocked: bigint
  totalClaimed: bigint
  startTime: bigint
  endTime: bigint
}

async function readEscrowDetails(
  client: PublicClient,
  escrowAddress: `0x${string}`
): Promise<EscrowDetails | null> {
  try {
    const [unclaimed, locked, tokenAddress, startTime, endTime, totalLocked, totalClaimed] =
      await Promise.all([
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "unclaimed",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "locked",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "token",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "startTime",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "endTime",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "totalLocked",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "totalClaimed",
        }),
      ])

    // Fetch token metadata
    let decimals = 18
    let tokenSymbol = "UNKNOWN"
    try {
      const [dec, sym] = await Promise.all([
        client.readContract({
          address: tokenAddress,
          abi: ERC20_DECIMALS_ABI,
          functionName: "decimals",
        }),
        client.readContract({
          address: tokenAddress,
          abi: ERC20_DECIMALS_ABI,
          functionName: "symbol",
        }),
      ])
      decimals = dec
      tokenSymbol = sym
    } catch {
      // Use defaults if token metadata read fails
    }

    return {
      escrowAddress,
      tokenAddress,
      tokenSymbol,
      decimals,
      unclaimed,
      locked,
      totalLocked,
      totalClaimed,
      startTime,
      endTime,
    }
  } catch {
    return null
  }
}

async function scanChainForWallet(
  chainId: number,
  walletAddress: `0x${string}`
): Promise<VestingClaim[]> {
  const factoryAddress = LLAMAPAY_VESTING_FACTORIES[chainId]
  if (!factoryAddress) return []

  const client = getPublicClient(chainId)
  if (!client) return []

  const chainName = EIP155_TO_INTERNAL[chainId] || `CHAIN_${chainId}`

  // Scan event logs in chunks to cover the full range without hitting RPC limits
  const currentBlock = await client.getBlockNumber()
  const earliestBlock = currentBlock > MAX_TOTAL_BLOCKS ? currentBlock - MAX_TOTAL_BLOCKS : 0n

  const logs: Awaited<ReturnType<typeof client.getLogs>>= []
  for (let from = earliestBlock; from <= currentBlock; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE - 1n > currentBlock ? currentBlock : from + CHUNK_SIZE - 1n
    try {
      const chunk = await client.getLogs({
        address: factoryAddress,
        event: VESTING_ESCROW_CREATED_EVENT,
        args: {
          recipient: walletAddress,
        },
        fromBlock: from,
        toBlock: to,
      })
      logs.push(...chunk)
    } catch {
      // If a chunk fails (RPC limit), skip it and continue
      continue
    }
  }

  if (logs.length === 0) return []

  // Read details from each escrow contract
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type VestingEscrowArgs = { escrow?: `0x${string}`; vestingStart?: bigint; cliffLength?: bigint }
  const escrowResults = await Promise.allSettled(
    logs.map((log) => {
      const escrowAddress = ((log as unknown as { args: VestingEscrowArgs }).args.escrow) as `0x${string}`
      return readEscrowDetails(client, escrowAddress)
    })
  )

  const claims: VestingClaim[] = []

  for (let i = 0; i < escrowResults.length; i++) {
    const result = escrowResults[i]
    if (result.status !== "fulfilled" || !result.value) continue

    const details = result.value
    const log = logs[i]

    const claimableAmount = Number(formatUnits(details.unclaimed, details.decimals))
    const lockedAmount = Number(formatUnits(details.locked, details.decimals))
    const totalAmount = Number(formatUnits(details.totalLocked, details.decimals))
    const claimedAmount = Number(formatUnits(details.totalClaimed, details.decimals))

    let status: VestingClaim["status"]
    if (details.unclaimed > 0n) {
      status = "claimable"
    } else if (details.locked > 0n) {
      status = "locked"
    } else {
      status = "depleted"
    }

    // Compute cliff date from event args
    const _logArgs = (log as unknown as { args: VestingEscrowArgs }).args
    const vestingStart = _logArgs.vestingStart ?? 0n
    const cliffLength = _logArgs.cliffLength ?? 0n
    const cliffTimestamp = vestingStart + cliffLength
    const cliffDate = cliffLength > 0n ? timestampToIso(cliffTimestamp) : null

    claims.push({
      id: `llamapay-vesting-${chainId}-${details.escrowAddress.toLowerCase()}`,
      platform: "LlamaPay",
      token: details.tokenSymbol,
      tokenAddress: details.tokenAddress,
      chain: chainName,
      totalAmount,
      claimedAmount,
      claimableAmount,
      lockedAmount,
      usdValue: null,
      startDate: timestampToIso(details.startTime),
      endDate: timestampToIso(details.endTime),
      cliffDate,
      status,
      claimUrl: "https://llamapay.io/vesting",
      iconUrl: "https://llamapay.io/favicon.ico",
      walletAddress: walletAddress.toLowerCase(),
      contractAddress: details.escrowAddress,
      planId: `${chainId}-${details.escrowAddress.toLowerCase()}`,
    })
  }

  return claims
}

// ─── Exported Checker ───

export const llamaPayChecker: VestingChecker = {
  platform: "LlamaPay",
  iconUrl: "https://llamapay.io/favicon.ico",

  async check(
    evmAddresses: string[],
    _solanaAddresses: string[],
    options?: { timeout?: number }
  ): Promise<VestingScanResult> {
    const timeout = options?.timeout ?? 30_000
    const supportedChainIds = Object.keys(LLAMAPAY_VESTING_FACTORIES).map(Number)
    const chainsChecked: string[] = supportedChainIds.map(
      (id) => EIP155_TO_INTERNAL[id] || `CHAIN_${id}`
    )

    if (evmAddresses.length === 0) {
      return { claims: [], platform: "LlamaPay", chainsChecked }
    }

    try {
      // Build all (wallet, chain) combinations to scan
      const tasks: Array<{ chainId: number; wallet: `0x${string}` }> = []
      for (const addr of evmAddresses) {
        const wallet = addr.toLowerCase() as `0x${string}`
        for (const chainId of supportedChainIds) {
          tasks.push({ chainId, wallet })
        }
      }

      // Run all tasks in parallel with a global timeout
      const results = await withTimeout(
        Promise.allSettled(
          tasks.map(({ chainId, wallet }) =>
            scanChainForWallet(chainId, wallet)
          )
        ),
        timeout,
        tasks.map(() => ({
          status: "rejected" as const,
          reason: new Error("Timeout"),
        }))
      )

      const allClaims: VestingClaim[] = []
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          allClaims.push(...result.value)
        }
      }

      return {
        claims: allClaims,
        platform: "LlamaPay",
        chainsChecked,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error scanning LlamaPay vesting"
      return {
        claims: [],
        platform: "LlamaPay",
        chainsChecked,
        error: message,
      }
    }
  },
}
