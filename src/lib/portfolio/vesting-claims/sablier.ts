// ─── Sablier Vesting Streams Checker ───
// Queries both Lockup and Flow protocols via Envio multi-chain GraphQL indexers.
// Single endpoint per protocol covers ALL EVM chains — no API key required.

import { formatUnits } from "viem"
import type { VestingChecker, VestingScanResult, VestingClaim } from "./types"
import { withTimeout, EIP155_TO_INTERNAL } from "./rpc"
import { ENVIO_FLOW_ENDPOINT, FLOW_QUERY, flowStreamToClaim, type FlowStream } from "./sablier-flow"

// ─── Envio Lockup Endpoint ───

const ENVIO_LOCKUP_ENDPOINT = "https://indexer.hyperindex.xyz/53b7e25/v1/graphql"

// ─── Lockup Query (broadened to catch proxied streams) ───

const LOCKUP_QUERY = `
  query getStreams($address: String!) {
    Stream(where: {_or: [
      {recipient: {_eq: $address}},
      {proxender: {_eq: $address}}
    ]}) {
      id
      chainId
      depositAmount
      intactAmount
      withdrawnAmount
      asset {
        address
        symbol
        decimals
      }
      sender
      recipient
      proxender
      proxied
      startTime
      endTime
      cliffTime
      cancelable
      canceled
      depleted
      transferable
      category
    }
  }
`

// ─── Lockup Response Types ───

interface SablierAsset {
  address: string
  symbol: string
  decimals: number
}

interface LockupStream {
  id: string
  chainId: string
  depositAmount: string
  intactAmount: string
  withdrawnAmount: string
  asset: SablierAsset | null
  sender: string
  recipient: string
  proxender: string | null
  proxied: boolean
  startTime: string | null
  endTime: string | null
  cliffTime: string | null
  cancelable: boolean
  canceled: boolean
  depleted: boolean
  transferable: boolean
  category: string | null
}

interface EnvioResponse<T> {
  data?: { Stream?: T[] }
  errors?: Array<{ message: string }>
}

// Testnet chain IDs to filter out
const TESTNET_CHAIN_IDS = new Set([11155111, 5, 80001])

// ─── Helpers ───

function toEpochIso(timestamp: string | null): string | null {
  if (!timestamp) return null
  const num = Number(timestamp)
  if (Number.isNaN(num) || num <= 0) return null
  return new Date(num * 1000).toISOString()
}

function chainIdToInternal(chainId: string | number): string {
  const id = typeof chainId === "string" ? Number(chainId) : chainId
  return EIP155_TO_INTERNAL[id] || `EVM_${id}`
}

function getTokenInfo(asset: SablierAsset | null): { token: string; tokenAddress: string; decimals: number } {
  const tokenAddress = asset?.address || ""
  const decimals = asset?.decimals ?? 18
  const token = asset?.symbol || (tokenAddress ? `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}` : "UNKNOWN")
  return { token, tokenAddress, decimals }
}

function toDisplay(v: bigint, decimals: number): number {
  try {
    return Number(formatUnits(v, decimals))
  } catch {
    return 0
  }
}

// ─── Fetch from Envio endpoint ───

async function fetchFromEnvio<T>(
  endpoint: string,
  query: string,
  address: string,
  timeoutMs: number,
): Promise<{ streams: T[]; error?: string }> {
  const emptyResult: { streams: T[]; error?: string } = { streams: [] }

  try {
    return await withTimeout(
      (async () => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query,
              variables: { address: address.toLowerCase() },
            }),
            signal: controller.signal,
          })

          if (!res.ok) {
            return { streams: [] as T[], error: `HTTP ${res.status}` }
          }

          const json = (await res.json()) as EnvioResponse<T>

          if (json.errors?.length) {
            return { streams: [] as T[], error: json.errors[0].message }
          }

          return { streams: json.data?.Stream ?? [] }
        } finally {
          clearTimeout(timer)
        }
      })(),
      timeoutMs,
      emptyResult,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { streams: [], error: msg }
  }
}

// ─── Build VestingClaim from a Lockup stream ───

function lockupStreamToClaim(
  stream: LockupStream,
  walletAddress: string,
): VestingClaim | null {
  const deposited = BigInt(stream.depositAmount || "0")
  const withdrawn = BigInt(stream.withdrawnAmount || "0")
  const intact = BigInt(stream.intactAmount || "0")

  const { token, tokenAddress, decimals } = getTokenInfo(stream.asset)

  const baseClaim = {
    platform: "Sablier" as const,
    token,
    tokenAddress,
    chain: chainIdToInternal(stream.chainId),
    usdValue: null,
    startDate: toEpochIso(stream.startTime),
    endDate: toEpochIso(stream.endTime),
    cliffDate: toEpochIso(stream.cliffTime),
    claimUrl: `https://app.sablier.com/stream/${stream.id}`,
    iconUrl: "https://app.sablier.com/favicon.ico",
    walletAddress,
    contractAddress: stream.sender,
    planId: stream.id,
  }

  // Depleted or canceled with nothing left → depleted
  if (stream.depleted || (stream.canceled && intact <= 0n)) {
    return {
      id: stream.id,
      ...baseClaim,
      totalAmount: toDisplay(deposited, decimals),
      claimedAmount: toDisplay(withdrawn, decimals),
      claimableAmount: 0,
      lockedAmount: 0,
      status: "depleted",
    }
  }

  // Canceled but has remaining funds — those are withdrawable
  if (stream.canceled) {
    return {
      id: stream.id,
      ...baseClaim,
      totalAmount: toDisplay(deposited, decimals),
      claimedAmount: toDisplay(withdrawn, decimals),
      claimableAmount: toDisplay(intact, decimals),
      lockedAmount: 0,
      status: intact > 0n ? "claimable" : "depleted",
    }
  }

  // Normal (non-canceled) stream — linear vesting
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
  const startTime = stream.startTime ? BigInt(stream.startTime) : 0n
  const endTime = stream.endTime ? BigInt(stream.endTime) : 0n
  const cliffTime = stream.cliffTime ? BigInt(stream.cliffTime) : 0n

  let vested: bigint
  if (endTime > 0n && nowSeconds >= endTime) {
    vested = deposited
  } else if (cliffTime > 0n && nowSeconds < cliffTime) {
    vested = 0n
  } else if (startTime > 0n && endTime > startTime && nowSeconds > startTime) {
    vested = (deposited * (nowSeconds - startTime)) / (endTime - startTime)
    if (vested > deposited) vested = deposited
  } else {
    vested = 0n
  }

  const claimable = vested > withdrawn ? vested - withdrawn : 0n
  const locked = deposited > vested ? deposited - vested : 0n

  return {
    id: stream.id,
    ...baseClaim,
    totalAmount: toDisplay(deposited, decimals),
    claimedAmount: toDisplay(withdrawn, decimals),
    claimableAmount: toDisplay(claimable, decimals),
    lockedAmount: toDisplay(locked, decimals),
    status: claimable > 0n ? "claimable" : "locked",
  }
}

// ─── Exported Checker ───

export const sablierChecker: VestingChecker = {
  platform: "Sablier",
  iconUrl: "https://app.sablier.com/favicon.ico",

  async check(
    evmAddresses: string[],
    _solanaAddresses: string[],
    options?: { timeout?: number },
  ): Promise<VestingScanResult> {
    const timeoutMs = options?.timeout ?? 15_000
    const allClaims: VestingClaim[] = []
    const chainsCheckedSet = new Set<string>()
    const errors: string[] = []

    for (const address of evmAddresses) {
      try {
        // Query both Lockup and Flow endpoints in parallel
        const [lockupResult, flowResult] = await Promise.all([
          fetchFromEnvio<LockupStream>(ENVIO_LOCKUP_ENDPOINT, LOCKUP_QUERY, address, timeoutMs),
          fetchFromEnvio<FlowStream>(ENVIO_FLOW_ENDPOINT, FLOW_QUERY, address, timeoutMs),
        ])

        if (lockupResult.error) errors.push(`${address} (Lockup): ${lockupResult.error}`)
        if (flowResult.error) errors.push(`${address} (Flow): ${flowResult.error}`)

        // Process Lockup streams
        for (const stream of lockupResult.streams) {
          const numericChainId = Number(stream.chainId)
          if (TESTNET_CHAIN_IDS.has(numericChainId)) continue
          chainsCheckedSet.add(chainIdToInternal(stream.chainId))

          const claim = lockupStreamToClaim(stream, address)
          if (claim) allClaims.push(claim)
        }

        // Process Flow streams
        for (const stream of flowResult.streams) {
          const numericChainId = Number(stream.chainId)
          if (TESTNET_CHAIN_IDS.has(numericChainId)) continue
          chainsCheckedSet.add(chainIdToInternal(stream.chainId))

          const claim = flowStreamToClaim(stream, address, chainIdToInternal)
          if (claim) allClaims.push(claim)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${address}: ${msg}`)
      }
    }

    return {
      claims: allClaims,
      platform: "Sablier",
      chainsChecked: Array.from(chainsCheckedSet),
      ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
    }
  },
}
