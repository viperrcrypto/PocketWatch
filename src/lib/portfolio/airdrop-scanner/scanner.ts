// ─── Airdrop Scanner ───
// Aggregates results from all platform-specific checkers.

import type { AirdropResult, AirdropScanResponse } from "@/lib/portfolio/airdrop-types"
import type { AirdropCheckResult } from "./types"
import { zerionRewardsChecker } from "./zerion-rewards"
import { merklChecker } from "./merkl"
import { deBridgeChecker } from "./deBridge"
import { registryChecker, REGISTRY_VERSION } from "./registry"

const ALL_CHECKERS = [
  zerionRewardsChecker,
  merklChecker,
  deBridgeChecker,
  registryChecker,
]

const SCAN_TIMEOUT_MS = 30_000

// Status priority for sorting: claimable first, then unclaimed, then others
const STATUS_ORDER: Record<string, number> = {
  claimable: 0,
  unclaimed: 1,
  unknown: 2,
  expired: 3,
  claimed: 4,
}

function deduplicateAirdrops(airdrops: AirdropResult[]): AirdropResult[] {
  const seen = new Map<string, AirdropResult>()

  for (const airdrop of airdrops) {
    const key = `${airdrop.protocol}:${airdrop.token}:${airdrop.chain}:${airdrop.address}`
    const existing = seen.get(key)

    if (!existing) {
      seen.set(key, airdrop)
      continue
    }

    // Keep the one with better status (lower order = better)
    const existingOrder = STATUS_ORDER[existing.status] ?? 99
    const newOrder = STATUS_ORDER[airdrop.status] ?? 99
    if (newOrder < existingOrder) {
      seen.set(key, airdrop)
    } else if (newOrder === existingOrder && (airdrop.usdValue ?? 0) > (existing.usdValue ?? 0)) {
      // Same status — prefer the one with USD value
      seen.set(key, airdrop)
    }
  }

  return Array.from(seen.values())
}

export async function scanAirdrops(
  userId: string,
  evmAddresses: string[],
  solanaAddresses: string[],
): Promise<AirdropScanResponse> {
  // Run all checkers in parallel with global timeout
  const results = await Promise.allSettled(
    ALL_CHECKERS.map((checker) =>
      Promise.race([
        checker.check(evmAddresses, solanaAddresses, {
          timeout: SCAN_TIMEOUT_MS,
          userId,
        }),
        new Promise<AirdropCheckResult>((_, reject) =>
          setTimeout(() => reject(new Error("Checker timed out")), SCAN_TIMEOUT_MS)
        ),
      ])
    )
  )

  const allAirdrops: AirdropResult[] = []
  const chainsCheckedSet = new Set<string>()
  const errors: string[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const checker = ALL_CHECKERS[i]

    if (result.status === "fulfilled") {
      const checkResult: AirdropCheckResult = result.value
      allAirdrops.push(...checkResult.airdrops)
      for (const chain of checkResult.chainsChecked) {
        chainsCheckedSet.add(chain)
      }
      if (checkResult.error) {
        errors.push(`${checkResult.platform}: ${checkResult.error}`)
      }
    } else {
      errors.push(`${checker.platform}: ${result.reason?.message ?? "Unknown error"}`)
    }
  }

  // Deduplicate and sort
  const deduplicated = deduplicateAirdrops(allAirdrops)
  const sorted = [...deduplicated].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
  )

  // Build summary
  let totalUnclaimed = 0
  let totalUnclaimedUsd = 0

  for (const airdrop of sorted) {
    if (airdrop.status === "claimable" || airdrop.status === "unclaimed") {
      totalUnclaimed++
      totalUnclaimedUsd += airdrop.usdValue ?? 0
    }
  }

  return {
    airdrops: sorted,
    summary: {
      totalUnclaimed,
      totalUnclaimedUsd,
      chainsChecked: Array.from(chainsCheckedSet),
      registryVersion: REGISTRY_VERSION,
      scannedAt: new Date().toISOString(),
    },
    meta: {
      fromCache: false,
    },
  }
}
