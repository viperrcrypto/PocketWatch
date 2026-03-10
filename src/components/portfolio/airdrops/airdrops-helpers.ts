import type { AirdropResult } from "@/lib/portfolio/airdrop-types"
import type { VestingClaimsResponse } from "./airdrops-constants"

function mapClaimToAirdrop(claim: VestingClaimsResponse["claims"][number]): AirdropResult {
  const isDepleted = claim.status === "depleted" || claim.status === "fully_claimed"
  return {
    id: claim.id,
    protocol: claim.platform,
    token: claim.token,
    chain: claim.chain,
    amount: isDepleted
      ? claim.totalAmount
      : claim.status === "claimable"
        ? claim.claimableAmount
        : claim.lockedAmount,
    usdValue: claim.usdValue,
    status: isDepleted
      ? ("claimed" as const)
      : claim.status === "claimable"
        ? ("claimable" as const)
        : ("unclaimed" as const),
    claimUrl: claim.claimUrl,
    iconUrl: claim.iconUrl,
    deadline: claim.endDate,
    deadlineDaysLeft: claim.endDate
      ? Math.ceil((new Date(claim.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null,
    source: "vesting" as const,
    address: claim.walletAddress,
    vestingPlatform: claim.platform,
  }
}

// Convert vesting claims to AirdropResult format, split into active and depleted
export function vestingClaimsToAirdrops(
  data: VestingClaimsResponse | null,
): { active: AirdropResult[]; depleted: AirdropResult[] } {
  if (!data?.claims) return { active: [], depleted: [] }

  const active: AirdropResult[] = []
  const depleted: AirdropResult[] = []

  for (const claim of data.claims) {
    const mapped = mapClaimToAirdrop(claim)
    if (claim.status === "depleted" || claim.status === "fully_claimed") {
      depleted.push(mapped)
    } else {
      active.push(mapped)
    }
  }

  return { active, depleted }
}
