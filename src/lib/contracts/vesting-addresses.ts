/**
 * VestingEscrow Contract Addresses
 * Update these after deployment to each network
 */

export const VESTING_ESCROW_ADDRESSES = {
  // Mainnets
  mainnet: "0x0000000000000000000000000000000000000000", // Update after mainnet deployment
  arbitrum: "0x0000000000000000000000000000000000000000", // Update after Arbitrum deployment
  base: "0x0000000000000000000000000000000000000000", // Update after Base deployment
  polygon: "0x0000000000000000000000000000000000000000", // Update after Polygon deployment

  // Testnets
  sepolia: "0x0000000000000000000000000000000000000000", // Update after Sepolia deployment
  arbitrumSepolia: "0x0000000000000000000000000000000000000000", // Update after Arbitrum Sepolia deployment
  baseSepolia: "0x0000000000000000000000000000000000000000", // Update after Base Sepolia deployment
  polygonMumbai: "0x0000000000000000000000000000000000000000", // Update after Mumbai deployment

  // Local development
  localhost: "0x0000000000000000000000000000000000000000", // Update for local testing
} as const;

export type SupportedChain = keyof typeof VESTING_ESCROW_ADDRESSES;

/**
 * Get the VestingEscrow address for a given chain
 * @param chainId - The chain ID
 * @returns The VestingEscrow contract address
 */
export function getVestingEscrowAddress(chainId: number): `0x${string}` {
  const chainMap: Record<number, SupportedChain> = {
    1: "mainnet",
    42161: "arbitrum",
    8453: "base",
    137: "polygon",
    11155111: "sepolia",
    421614: "arbitrumSepolia",
    84532: "baseSepolia",
    80001: "polygonMumbai",
    31337: "localhost",
  };

  const chain = chainMap[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  return VESTING_ESCROW_ADDRESSES[chain] as `0x${string}`;
}

/**
 * Campaign IDs
 * Generate campaign IDs using keccak256(toUtf8Bytes("CAMPAIGN_NAME"))
 */
export const CAMPAIGN_IDS = {
  SEED_ROUND: "0x0000000000000000000000000000000000000000000000000000000000000000", // Update with actual campaign ID
  PRIVATE_SALE: "0x0000000000000000000000000000000000000000000000000000000000000000", // Update with actual campaign ID
  PUBLIC_SALE: "0x0000000000000000000000000000000000000000000000000000000000000000", // Update with actual campaign ID
  TEAM: "0x0000000000000000000000000000000000000000000000000000000000000000", // Update with actual campaign ID
  ADVISORS: "0x0000000000000000000000000000000000000000000000000000000000000000", // Update with actual campaign ID
} as const;
