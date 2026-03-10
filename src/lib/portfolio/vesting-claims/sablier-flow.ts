// ─── Sablier Flow Protocol Checker ───
// Handles continuous (open-ended) streams from the Flow protocol.
// Separated from the main Lockup checker to keep files within size limits.

import { formatUnits } from "viem"
import type { VestingClaim } from "./types"

// ─── Envio Flow Endpoint ───

export const ENVIO_FLOW_ENDPOINT = "https://indexer.hyperindex.xyz/3b4ea6b/v1/graphql"

// ─── Flow Query ───

export const FLOW_QUERY = `
  query getFlowStreams($address: String!) {
    Stream(where: {recipient: {_eq: $address}}) {
      id
      chainId
      depositedAmount
      withdrawnAmount
      availableAmount
      ratePerSecond
      asset {
        address
        symbol
        decimals
      }
      sender
      recipient
      paused
      voided
      transferable
    }
  }
`

// ─── Flow Response Type ───

interface SablierAsset {
  address: string
  symbol: string
  decimals: number
}

export interface FlowStream {
  id: string
  chainId: string
  depositedAmount: string
  withdrawnAmount: string
  availableAmount: string
  ratePerSecond: string
  asset: SablierAsset | null
  sender: string
  recipient: string
  paused: boolean
  voided: boolean
  transferable: boolean
}

// ─── Helpers (shared with lockup via import args) ───

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

// ─── Build VestingClaim from a Flow stream ───

export function flowStreamToClaim(
  stream: FlowStream,
  walletAddress: string,
  chainIdToInternal: (chainId: string | number) => string,
): VestingClaim | null {
  const deposited = BigInt(stream.depositedAmount || "0")
  const withdrawn = BigInt(stream.withdrawnAmount || "0")
  const available = BigInt(stream.availableAmount || "0")

  if (deposited === 0n && withdrawn === 0n) return null

  const { token, tokenAddress, decimals } = getTokenInfo(stream.asset)

  // Voided or fully withdrawn → depleted
  // (paused with deposited > withdrawn is "locked", not depleted — stream can resume)
  if (stream.voided || (available <= 0n && deposited > 0n && deposited <= withdrawn)) {
    return {
      id: stream.id,
      platform: "Sablier Flow",
      token,
      tokenAddress,
      chain: chainIdToInternal(stream.chainId),
      totalAmount: toDisplay(deposited, decimals),
      claimedAmount: toDisplay(withdrawn, decimals),
      claimableAmount: 0,
      lockedAmount: 0,
      usdValue: null,
      startDate: null,
      endDate: null,
      cliffDate: null,
      status: "depleted",
      claimUrl: `https://app.sablier.com/stream/${stream.id}`,
      iconUrl: "https://app.sablier.com/favicon.ico",
      walletAddress,
      contractAddress: stream.sender,
      planId: stream.id,
    }
  }

  // Flow streams are continuous — available is what can be claimed now
  const locked = deposited > withdrawn + available ? deposited - withdrawn - available : 0n
  const status: VestingClaim["status"] = available > 0n ? "claimable" : "locked"

  return {
    id: stream.id,
    platform: "Sablier Flow",
    token,
    tokenAddress,
    chain: chainIdToInternal(stream.chainId),
    totalAmount: toDisplay(deposited, decimals),
    claimedAmount: toDisplay(withdrawn, decimals),
    claimableAmount: toDisplay(available, decimals),
    lockedAmount: toDisplay(locked, decimals),
    usdValue: null,
    startDate: null,
    endDate: null,
    cliffDate: null,
    status,
    claimUrl: `https://app.sablier.com/stream/${stream.id}`,
    iconUrl: "https://app.sablier.com/favicon.ico",
    walletAddress,
    contractAddress: stream.sender,
    planId: stream.id,
  }
}
