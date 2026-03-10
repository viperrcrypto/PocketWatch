// ─── deBridge Points Checker ───
// Checks if a user has unclaimed DBR points/tokens.
// Free public API — no API key required.

import type { AirdropResult } from "@/lib/portfolio/airdrop-types"
import type { AirdropChecker, AirdropCheckResult } from "./types"

const DEBRIDGE_API = "https://points-api.debridge.finance/api/Points/User"
const TIMEOUT_MS = 10_000

interface DeBridgePointsInfo {
  totalPoints?: number
  claimedPoints?: number
  availablePoints?: number
  // The API may include additional fields
  [key: string]: unknown
}

async function fetchDeBridgePoints(
  address: string,
): Promise<{ info: DeBridgePointsInfo | null; error?: string }> {
  try {
    const url = `${DEBRIDGE_API}/${encodeURIComponent(address)}/Info`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    })

    if (!res.ok) {
      if (res.status === 404) return { info: null }
      return { info: null, error: `deBridge API ${res.status}` }
    }

    const json = await res.json()
    return { info: json as DeBridgePointsInfo }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { info: null, error: msg }
  }
}

function pointsToAirdrop(
  info: DeBridgePointsInfo,
  walletAddress: string,
): AirdropResult | null {
  const total = info.totalPoints ?? 0
  const claimed = info.claimedPoints ?? 0
  const available = info.availablePoints ?? (total - claimed)

  if (available <= 0 && total <= 0) return null

  const status = available > 0 ? "claimable" : "unclaimed"

  return {
    id: `debridge-dbr-${walletAddress.slice(-8)}`,
    protocol: "deBridge",
    token: "DBR",
    chain: "ETH",
    amount: available > 0 ? available : total,
    usdValue: null,
    status,
    claimUrl: "https://app.debridge.finance/rewards",
    iconUrl: "https://app.debridge.finance/favicon.ico",
    deadline: null,
    deadlineDaysLeft: null,
    source: "registry",
    address: walletAddress,
  }
}

export const deBridgeChecker: AirdropChecker = {
  platform: "deBridge",
  iconUrl: "https://app.debridge.finance/favicon.ico",

  async check(
    evmAddresses: string[],
    _solanaAddresses: string[],
    _options?: { timeout?: number; userId?: string },
  ): Promise<AirdropCheckResult> {
    const allAirdrops: AirdropResult[] = []
    const errors: string[] = []

    for (const address of evmAddresses) {
      const { info, error } = await fetchDeBridgePoints(address)

      if (error) {
        errors.push(`${address.slice(0, 10)}...: ${error}`)
      }

      if (info) {
        const airdrop = pointsToAirdrop(info, address)
        if (airdrop) {
          allAirdrops.push(airdrop)
        }
      }
    }

    return {
      airdrops: allAirdrops,
      platform: "deBridge",
      chainsChecked: ["ETH"],
      ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
    }
  },
}
