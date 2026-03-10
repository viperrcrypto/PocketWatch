// ─── Vesting Claims Scanner ───
// Aggregates results from all platform-specific checkers.
//
// NOTE: Magna (magna.so) is intentionally excluded. Magna uses per-project API
// tokens with no public "query by wallet" endpoint. Each project deploys isolated
// vesting contracts — there is no shared registry or subgraph to scan generically.

import type { VestingClaim, VestingScanResult } from "./types"
import { teamFinanceChecker } from "./team-finance"
import { sablierChecker } from "./sablier"
import { llamaPayChecker } from "./llamapay"
import { hedgeyChecker } from "./hedgey"
import { streamflowChecker } from "./streamflow"

const ALL_CHECKERS = [
  teamFinanceChecker,
  sablierChecker,
  llamaPayChecker,
  hedgeyChecker,
  streamflowChecker,
]

export interface VestingClaimsScanResponse {
  claims: VestingClaim[]
  summary: {
    totalClaimable: number
    totalLocked: number
    totalDepleted: number
    platformsChecked: string[]
    chainsChecked: string[]
    scannedAt: string
    errors: string[]
  }
}

const SCAN_TIMEOUT_MS = 30_000

export async function scanVestingClaims(
  evmAddresses: string[],
  solanaAddresses: string[],
): Promise<VestingClaimsScanResponse> {
  // Run all checkers in parallel
  const results = await Promise.allSettled(
    ALL_CHECKERS.map((checker) =>
      checker.check(evmAddresses, solanaAddresses, { timeout: SCAN_TIMEOUT_MS })
    )
  )

  const allClaims: VestingClaim[] = []
  const platformsChecked: string[] = []
  const chainsCheckedSet = new Set<string>()
  const errors: string[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const checker = ALL_CHECKERS[i]

    if (result.status === "fulfilled") {
      const scanResult: VestingScanResult = result.value
      allClaims.push(...scanResult.claims)
      platformsChecked.push(scanResult.platform)
      for (const chain of scanResult.chainsChecked) {
        chainsCheckedSet.add(chain)
      }
      if (scanResult.error) {
        errors.push(`${scanResult.platform}: ${scanResult.error}`)
      }
    } else {
      platformsChecked.push(checker.platform)
      errors.push(`${checker.platform}: ${result.reason?.message || "Unknown error"}`)
    }
  }

  // Count by status
  let totalClaimable = 0
  let totalLocked = 0
  let totalDepleted = 0
  for (const claim of allClaims) {
    if (claim.status === "claimable") totalClaimable++
    else if (claim.status === "locked") totalLocked++
    else if (claim.status === "depleted" || claim.status === "fully_claimed") totalDepleted++
  }

  // Sort: claimable first, then locked, then fully_claimed, then depleted
  const statusOrder: Record<string, number> = { claimable: 0, locked: 1, fully_claimed: 2, depleted: 3 }
  allClaims.sort((a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4))

  return {
    claims: allClaims,
    summary: {
      totalClaimable,
      totalLocked,
      totalDepleted,
      platformsChecked,
      chainsChecked: Array.from(chainsCheckedSet),
      scannedAt: new Date().toISOString(),
      errors,
    },
  }
}
