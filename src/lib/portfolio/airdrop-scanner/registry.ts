// ─── Static Registry Checker ───
// Checks known airdrop eligibility via public APIs.
// Each entry defines a protocol with a check URL template.

import type { AirdropResult } from "@/lib/portfolio/airdrop-types"
import type { AirdropChecker, AirdropCheckResult } from "./types"

const TIMEOUT_MS = 10_000

export const REGISTRY_VERSION = "1.0.0"

interface RegistryEntry {
  protocol: string
  token: string
  chain: string
  /** URL template — `{address}` is replaced with the wallet address */
  checkUrl: string
  claimUrl: string
  iconUrl: string | null
  /** Parse the API response to determine eligibility and amount */
  parse(json: unknown, address: string): AirdropResult | null
}

// ─── Registry Entries ───

const REGISTRY_ENTRIES: RegistryEntry[] = [
  {
    protocol: "EigenLayer",
    token: "EIGEN",
    chain: "ETH",
    checkUrl: "https://claims.eigenfoundation.org/clique-eigenLayer-api/campaign/eigenlayer/credentials?walletAddress={address}",
    claimUrl: "https://claims.eigenfoundation.org/",
    iconUrl: "https://app.eigenlayer.xyz/favicon.ico",
    parse(json: unknown, address: string): AirdropResult | null {
      if (!json || typeof json !== "object") return null
      const data = json as Record<string, unknown>

      // The API returns token allocation info if eligible
      const amount = Number(data.tokenAmount ?? data.amount ?? 0)
      if (amount <= 0) return null

      const isClaimed = data.isClaimed === true || data.claimed === true
      return {
        id: `registry-eigenlayer-${address.slice(-8)}`,
        protocol: "EigenLayer",
        token: "EIGEN",
        chain: "ETH",
        amount,
        usdValue: null,
        status: isClaimed ? "claimed" : "claimable",
        claimUrl: "https://claims.eigenfoundation.org/",
        iconUrl: "https://app.eigenlayer.xyz/favicon.ico",
        deadline: null,
        deadlineDaysLeft: null,
        source: "registry",
        address,
      }
    },
  },
  {
    protocol: "LayerZero",
    token: "ZRO",
    chain: "ETH",
    checkUrl: "https://www.layerzero.foundation/api/proof/{address}",
    claimUrl: "https://www.layerzero.foundation/eligibility",
    iconUrl: "https://layerzero.network/favicon.ico",
    parse(json: unknown, address: string): AirdropResult | null {
      if (!json || typeof json !== "object") return null
      const data = json as Record<string, unknown>

      const amount = Number(data.amount ?? data.tokenAmount ?? 0)
      if (amount <= 0) return null

      const isClaimed = data.isClaimed === true || data.claimed === true
      return {
        id: `registry-layerzero-${address.slice(-8)}`,
        protocol: "LayerZero",
        token: "ZRO",
        chain: "ETH",
        amount,
        usdValue: null,
        status: isClaimed ? "claimed" : "claimable",
        claimUrl: "https://www.layerzero.foundation/eligibility",
        iconUrl: "https://layerzero.network/favicon.ico",
        deadline: null,
        deadlineDaysLeft: null,
        source: "registry",
        address,
      }
    },
  },
  {
    protocol: "Starknet",
    token: "STRK",
    chain: "ETH",
    checkUrl: "https://provisions.starknet.io/api/eligibility/{address}",
    claimUrl: "https://provisions.starknet.io/",
    iconUrl: "https://starknet.io/favicon.ico",
    parse(json: unknown, address: string): AirdropResult | null {
      if (!json || typeof json !== "object") return null
      const data = json as Record<string, unknown>

      const amount = Number(data.amount ?? data.eligibleAmount ?? 0)
      if (amount <= 0) return null

      const isClaimed = data.isClaimed === true || data.claimed === true
      return {
        id: `registry-starknet-${address.slice(-8)}`,
        protocol: "Starknet",
        token: "STRK",
        chain: "ETH",
        amount,
        usdValue: null,
        status: isClaimed ? "claimed" : "claimable",
        claimUrl: "https://provisions.starknet.io/",
        iconUrl: "https://starknet.io/favicon.ico",
        deadline: null,
        deadlineDaysLeft: null,
        source: "registry",
        address,
      }
    },
  },
]

// ─── Check a single registry entry for an address ───

async function checkEntry(
  entry: RegistryEntry,
  address: string,
): Promise<AirdropResult | null> {
  try {
    const url = entry.checkUrl.replace("{address}", encodeURIComponent(address))
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    })

    if (!res.ok) return null

    const json = await res.json()
    return entry.parse(json, address)
  } catch {
    // Individual entry failures are non-fatal
    return null
  }
}

// ─── Exported Checker ───

export const registryChecker: AirdropChecker = {
  platform: "Registry",
  iconUrl: null,

  async check(
    evmAddresses: string[],
    _solanaAddresses: string[],
    _options?: { timeout?: number; userId?: string },
  ): Promise<AirdropCheckResult> {
    const allAirdrops: AirdropResult[] = []
    const chainsCheckedSet = new Set<string>()
    const errors: string[] = []

    // Check all entries for all addresses in parallel
    const checks = evmAddresses.flatMap((address) =>
      REGISTRY_ENTRIES.map((entry) => ({
        entry,
        address,
        promise: checkEntry(entry, address),
      }))
    )

    const results = await Promise.allSettled(checks.map((c) => c.promise))

    for (let i = 0; i < results.length; i++) {
      const { entry } = checks[i]
      const result = results[i]

      chainsCheckedSet.add(entry.chain)

      if (result.status === "fulfilled" && result.value) {
        allAirdrops.push(result.value)
      } else if (result.status === "rejected") {
        errors.push(`${entry.protocol}: ${result.reason?.message ?? "Unknown error"}`)
      }
    }

    return {
      airdrops: allAirdrops,
      platform: "Registry",
      chainsChecked: Array.from(chainsCheckedSet),
      ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
    }
  },
}
