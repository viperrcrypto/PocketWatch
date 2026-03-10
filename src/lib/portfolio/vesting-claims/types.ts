// ─── Vesting Claims Scanner Types ───

export interface VestingClaim {
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
}

export interface VestingScanResult {
  claims: VestingClaim[]
  platform: string
  chainsChecked: string[]
  error?: string
}

// Per-platform checker interface
export interface VestingChecker {
  platform: string
  iconUrl: string | null
  check(
    evmAddresses: string[],
    solanaAddresses: string[],
    options?: { timeout?: number }
  ): Promise<VestingScanResult>
}

// Chain ID → RPC URL mapping for EVM
export interface ChainRpcConfig {
  chainId: number
  internalId: string
  rpcUrl: string
  name: string
}
