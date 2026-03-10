// ─── Airdrop Scanner Response Types ───
// Mirrors VPS backend response format.

export interface AirdropResult {
  id: string
  protocol: string
  token: string
  chain: string
  amount: number
  usdValue: number | null
  status: "claimable" | "claimed" | "expired" | "unclaimed" | "unknown"
  claimUrl: string | null
  iconUrl: string | null
  deadline: string | null
  deadlineDaysLeft: number | null
  source: "zerion" | "rotki" | "registry" | "vesting"
  address: string
  vestingPlatform?: string
}

export interface AirdropScanResponse {
  airdrops: AirdropResult[]
  summary: {
    totalUnclaimed: number
    totalUnclaimedUsd: number
    chainsChecked: string[]
    registryVersion: string
    scannedAt: string
  }
  meta: {
    fromCache: boolean
  }
}
