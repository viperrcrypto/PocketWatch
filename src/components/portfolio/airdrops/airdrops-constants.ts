export type ViewTab = "airdrops" | "vesting" | "staking"
export type FilterTab = "all" | "claimable" | "unclaimed" | "claimed" | "expired" | "locked"

export const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "claimable", label: "Claimable" },
  { key: "unclaimed", label: "Unclaimed" },
  { key: "locked", label: "Locked" },
  { key: "claimed", label: "Claimed" },
  { key: "expired", label: "Expired" },
]

export const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  claimable: { bg: "bg-success/10", text: "text-success", label: "CLAIMABLE" },
  unclaimed: { bg: "bg-warning/10", text: "text-warning", label: "UNCLAIMED" },
  locked: { bg: "bg-primary/10", text: "text-primary", label: "LOCKED" },
  claimed: { bg: "bg-foreground-muted/10", text: "text-foreground-muted", label: "CLAIMED" },
  expired: { bg: "bg-error/10", text: "text-error", label: "EXPIRED" },
  depleted: { bg: "bg-foreground-muted/10", text: "text-foreground-muted", label: "DEPLETED" },
  unknown: { bg: "bg-foreground-muted/10", text: "text-foreground-muted", label: "UNKNOWN" },
}

// Vesting claims response shape from our API
export interface VestingClaimsResponse {
  claims: Array<{
    id: string
    platform: string
    token: string
    tokenAddress: string
    chain: string
    totalAmount: number
    claimedAmount: number
    claimableAmount: number
    lockedAmount: number
    usdValue: number | null
    startDate: string | null
    endDate: string | null
    cliffDate: string | null
    status: "claimable" | "locked" | "fully_claimed" | "depleted"
    claimUrl: string
    iconUrl: string | null
    walletAddress: string
    contractAddress: string
    planId: string
  }>
  summary: {
    totalClaimable: number
    totalLocked: number
    totalDepleted: number
    platformsChecked: string[]
    chainsChecked: string[]
    scannedAt: string | null
    errors: string[]
  }
  meta?: { fromCache: boolean }
}
