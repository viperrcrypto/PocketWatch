// ─── Zerion Rewards Checker ───
// Finds claimable rewards from Zerion portfolio positions.
// Requires a Zerion API key (looked up per-user from DB).

import type { AirdropResult } from "@/lib/portfolio/airdrop-types"
import type { AirdropChecker, AirdropCheckResult } from "./types"
import { selectServiceKey } from "@/lib/portfolio/service-keys"
import { fetchWalletPositions, type ZerionPosition } from "@/lib/portfolio/zerion-client"

const ZERION_CHAIN_MAP: Record<string, string> = {
  ethereum: "ETH",
  polygon: "POLYGON_POS",
  arbitrum: "ARBITRUM_ONE",
  optimism: "OPTIMISM",
  base: "BASE",
  avalanche: "AVAX",
  "binance-smart-chain": "BSC",
  gnosis: "GNOSIS",
  fantom: "FANTOM",
  linea: "LINEA",
  scroll: "SCROLL",
  blast: "BLAST",
  zksync: "ZKSYNC",
}

function mapChainId(zerionChain: string): string {
  return ZERION_CHAIN_MAP[zerionChain] ?? zerionChain.toUpperCase()
}

function rewardToAirdrop(
  position: ZerionPosition,
  walletAddress: string,
): AirdropResult {
  return {
    id: `zerion-reward-${position.id}`,
    protocol: position.protocol ?? "Unknown",
    token: position.symbol,
    chain: mapChainId(position.chain),
    amount: position.quantity,
    usdValue: position.value > 0 ? position.value : null,
    status: "claimable",
    claimUrl: position.protocolUrl ?? null,
    iconUrl: position.iconUrl ?? position.protocolIcon ?? null,
    deadline: null,
    deadlineDaysLeft: null,
    source: "zerion",
    address: walletAddress,
  }
}

export const zerionRewardsChecker: AirdropChecker = {
  platform: "Zerion Rewards",
  iconUrl: "https://app.zerion.io/favicon.ico",

  async check(
    evmAddresses: string[],
    _solanaAddresses: string[],
    options?: { timeout?: number; userId?: string },
  ): Promise<AirdropCheckResult> {
    const userId = options?.userId
    if (!userId) {
      return {
        airdrops: [],
        platform: "Zerion Rewards",
        chainsChecked: [],
        error: "No userId provided — cannot look up Zerion API key",
      }
    }

    const keyEntry = await selectServiceKey(userId, "zerion")
    if (!keyEntry) {
      return {
        airdrops: [],
        platform: "Zerion Rewards",
        chainsChecked: [],
        error: "No Zerion API key configured",
      }
    }

    const allAirdrops: AirdropResult[] = []
    const chainsCheckedSet = new Set<string>()
    const errors: string[] = []

    // Sequential to respect Zerion rate limits
    for (const address of evmAddresses) {
      try {
        const positions = await fetchWalletPositions(keyEntry.key, address)
        const rewards = positions.filter((p) => p.positionType === "reward")

        for (const reward of rewards) {
          chainsCheckedSet.add(mapChainId(reward.chain))
          allAirdrops.push(rewardToAirdrop(reward, address))
        }

        // Track all chains we checked, not just ones with rewards
        for (const p of positions) {
          chainsCheckedSet.add(mapChainId(p.chain))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${address.slice(0, 10)}...: ${msg}`)
      }
    }

    return {
      airdrops: allAirdrops,
      platform: "Zerion Rewards",
      chainsChecked: Array.from(chainsCheckedSet),
      ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
    }
  },
}
