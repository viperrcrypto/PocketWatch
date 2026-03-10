import { getAddress } from "viem"
import { getChainMeta, EIP155_CHAIN_ID_MAP, NATIVE_TOKEN_CHAINS } from "./chains"

// Module-level cache of failed image URLs with time-based expiry (5 min)
const failedUrls = new Map<string, number>()
const FAIL_TTL_MS = 5 * 60_000

export function markImageFailed(url: string): void {
  failedUrls.set(url, Date.now())
}

export function isImageFailed(url: string): boolean {
  const ts = failedUrls.get(url)
  if (!ts) return false
  if (Date.now() - ts > FAIL_TTL_MS) {
    failedUrls.delete(url)
    return false
  }
  return true
}

/**
 * Parse a CAIP-19 identifier like "eip155:1/erc20:0xdAC17F..."
 * Returns { chainKey, contractAddress } or null.
 */
export function parseCaip19(assetId: string): {
  chainKey: string
  contractAddress: string
} | null {
  const match = assetId.match(/^eip155:(\d+)\/erc20:(0x[0-9a-fA-F]{40})$/)
  if (!match) return null

  const numericChainId = parseInt(match[1], 10)
  const chainKey = EIP155_CHAIN_ID_MAP[numericChainId]
  if (!chainKey) return null

  try {
    const checksummed = getAddress(match[2])
    return { chainKey, contractAddress: checksummed }
  } catch {
    return null
  }
}

/**
 * Check if an asset symbol maps to a native chain token (ETH, BTC, SOL, etc.)
 * For these, we use our hand-crafted ChainIcon SVGs instead of Trust Wallet CDN.
 */
export function getNativeChainKey(assetId: string, chain?: string): string | null {
  // CAIP-19 identifiers are ERC-20 tokens, not native
  if (assetId.includes("/")) return null
  return NATIVE_TOKEN_CHAINS[assetId.toUpperCase()] ?? null
}

/**
 * Build the Trust Wallet CDN URL for an ERC-20 token image.
 * Supports CAIP-19 identifiers and raw contract addresses with chain.
 * Returns null if the URL cannot be determined or has previously failed.
 */
export function getTokenImageUrl(assetId: string, chain?: string): string | null {
  // Try CAIP-19 first (e.g., "eip155:1/erc20:0x...")
  const parsed = parseCaip19(assetId)
  if (parsed) {
    const meta = getChainMeta(parsed.chainKey)
    if (!meta?.trustWalletName) return null
    const url = `https://assets-cdn.trustwallet.com/blockchains/${meta.trustWalletName}/assets/${parsed.contractAddress}/logo.png`
    return isImageFailed(url) ? null : url
  }

  // Try raw contract address + chain (e.g., "0xdAC17F..." + "ETHEREUM")
  if (chain && /^0x[0-9a-fA-F]{40}$/.test(assetId)) {
    const meta = getChainMeta(chain)
    if (!meta?.trustWalletName) return null
    try {
      const checksummed = getAddress(assetId)
      const url = `https://assets-cdn.trustwallet.com/blockchains/${meta.trustWalletName}/assets/${checksummed}/logo.png`
      return isImageFailed(url) ? null : url
    } catch {
      return null
    }
  }

  return null
}
