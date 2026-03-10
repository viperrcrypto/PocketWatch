/**
 * Shared Web3 Client Configuration
 *
 * This module provides a single, reusable public client instance for blockchain interactions.
 * Previously duplicated in auth.ts and tx-verify.ts, now centralized for consistency.
 */

import { createPublicClient, http, fallback } from "viem"
import { mainnet } from "viem/chains"

// Alchemy RPC URL (primary provider)
const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
  : null

/**
 * Shared public client for Ethereum mainnet with fallback RPC providers
 *
 * RPC Priority:
 * 1. Alchemy (if API key configured)
 * 2. LlamaRPC
 * 3. Ankr
 * 4. PublicNode
 * 5. 1RPC
 */
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback([
    ...(alchemyUrl ? [http(alchemyUrl)] : []),
    http("https://eth.llamarpc.com"),
    http("https://rpc.ankr.com/eth"),
    http("https://ethereum-rpc.publicnode.com"),
    http("https://1rpc.io/eth"),
  ]),
})

/**
 * Create a public client with a user-specific Alchemy key.
 * Falls back to the default publicClient's RPC stack.
 */
export function createAlchemyClient(alchemyKey: string) {
  const url = `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
  return createPublicClient({
    chain: mainnet,
    transport: fallback([
      http(url),
      http("https://eth.llamarpc.com"),
      http("https://rpc.ankr.com/eth"),
    ]),
  })
}

/**
 * ERC721 Standard ABI for balanceOf function
 * Used for NFT ownership verification
 */
export const ERC721_BALANCE_OF_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const
