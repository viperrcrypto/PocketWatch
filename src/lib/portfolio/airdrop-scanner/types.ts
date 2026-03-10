// ─── Airdrop Scanner Types ───

import type { AirdropResult } from "@/lib/portfolio/airdrop-types"

export interface AirdropChecker {
  platform: string
  iconUrl: string | null
  check(
    evmAddresses: string[],
    solanaAddresses: string[],
    options?: { timeout?: number; userId?: string }
  ): Promise<AirdropCheckResult>
}

export interface AirdropCheckResult {
  airdrops: AirdropResult[]
  platform: string
  chainsChecked: string[]
  error?: string
}
