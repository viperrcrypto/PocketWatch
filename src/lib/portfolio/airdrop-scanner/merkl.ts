// ─── Merkl Rewards Checker ───
// Checks Merkl (https://merkl.xyz) for unclaimed reward campaigns.
// Free public API — no API key required.

import type { AirdropResult } from "@/lib/portfolio/airdrop-types"
import type { AirdropChecker, AirdropCheckResult } from "./types"

const MERKL_API_BASE = "https://api.merkl.xyz/v4"
const TIMEOUT_MS = 15_000

// Merkl chain IDs → our internal chain IDs
const MERKL_CHAIN_MAP: Record<number, string> = {
  1: "ETH",
  10: "OPTIMISM",
  56: "BSC",
  100: "GNOSIS",
  137: "POLYGON_POS",
  250: "FANTOM",
  324: "ZKSYNC",
  8453: "BASE",
  42161: "ARBITRUM_ONE",
  43114: "AVAX",
  59144: "LINEA",
  534352: "SCROLL",
  81457: "BLAST",
  5000: "MANTLE",
  34443: "MODE",
}

function mapMerklChain(chainId: number): string {
  return MERKL_CHAIN_MAP[chainId] ?? `EVM_${chainId}`
}

// ─── Merkl API response shape ───
// GET /v4/users/{address} returns an array of reward objects

interface MerklReward {
  campaignId?: string
  reason?: string
  amount?: string
  claimed?: string
  pending?: string
  token?: {
    address?: string
    symbol?: string
    decimals?: number
    price?: number | null
  }
  chainId?: number
  protocol?: {
    id?: string
    name?: string
    url?: string
    icon?: string
  }
}

function parseAmount(raw: string | undefined, decimals: number): number {
  if (!raw || raw === "0") return 0
  try {
    const bigVal = BigInt(raw)
    return Number(bigVal) / Math.pow(10, decimals)
  } catch {
    return Number(raw) || 0
  }
}

function rewardToAirdrop(
  reward: MerklReward,
  walletAddress: string,
): AirdropResult | null {
  const decimals = reward.token?.decimals ?? 18
  const totalAmount = parseAmount(reward.amount, decimals)
  const claimedAmount = parseAmount(reward.claimed, decimals)
  const pendingAmount = parseAmount(reward.pending, decimals)

  const unclaimed = totalAmount - claimedAmount
  if (unclaimed <= 0 && pendingAmount <= 0) return null

  const effectiveAmount = pendingAmount > 0 ? pendingAmount : unclaimed
  const tokenPrice = reward.token?.price ?? null
  const usdValue = tokenPrice !== null ? effectiveAmount * tokenPrice : null

  const chainId = reward.chainId ?? 1
  const protocol = reward.protocol?.name ?? reward.reason ?? "Merkl Campaign"
  const token = reward.token?.symbol ?? "UNKNOWN"

  return {
    id: `merkl-${chainId}-${reward.campaignId ?? reward.token?.address ?? token}-${walletAddress.slice(-8)}`,
    protocol,
    token,
    chain: mapMerklChain(chainId),
    amount: effectiveAmount,
    usdValue,
    status: "claimable",
    claimUrl: `https://app.merkl.xyz/users/${walletAddress}`,
    iconUrl: reward.protocol?.icon ?? null,
    deadline: null,
    deadlineDaysLeft: null,
    source: "registry",
    address: walletAddress,
  }
}

async function fetchMerklRewards(
  address: string,
): Promise<{ rewards: MerklReward[]; error?: string }> {
  try {
    const url = `${MERKL_API_BASE}/users/${encodeURIComponent(address)}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    })

    if (!res.ok) {
      if (res.status === 404) return { rewards: [] }
      return { rewards: [], error: `Merkl API ${res.status}` }
    }

    const json = await res.json()

    // Response can be an array of rewards directly,
    // or a chain-keyed object — handle both defensively
    if (Array.isArray(json)) {
      return { rewards: json as MerklReward[] }
    }

    if (json && typeof json === "object") {
      const collected: MerklReward[] = []
      for (const value of Object.values(json)) {
        if (Array.isArray(value)) {
          collected.push(...(value as MerklReward[]))
        } else if (value && typeof value === "object") {
          collected.push(value as MerklReward)
        }
      }
      return { rewards: collected }
    }

    return { rewards: [] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { rewards: [], error: msg }
  }
}

export const merklChecker: AirdropChecker = {
  platform: "Merkl",
  iconUrl: "https://app.merkl.xyz/favicon.ico",

  async check(
    evmAddresses: string[],
    _solanaAddresses: string[],
    _options?: { timeout?: number; userId?: string },
  ): Promise<AirdropCheckResult> {
    const allAirdrops: AirdropResult[] = []
    const chainsCheckedSet = new Set<string>()
    const errors: string[] = []

    for (const address of evmAddresses) {
      const { rewards, error } = await fetchMerklRewards(address)

      if (error) {
        errors.push(`${address.slice(0, 10)}...: ${error}`)
      }

      for (const reward of rewards) {
        if (reward.chainId) {
          chainsCheckedSet.add(mapMerklChain(reward.chainId))
        }
        const airdrop = rewardToAirdrop(reward, address)
        if (airdrop) {
          allAirdrops.push(airdrop)
        }
      }
    }

    return {
      airdrops: allAirdrops,
      platform: "Merkl",
      chainsChecked: Array.from(chainsCheckedSet),
      ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
    }
  },
}
