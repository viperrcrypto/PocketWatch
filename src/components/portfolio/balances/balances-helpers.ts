import { KNOWN_TOKENS } from "./balances-constants"

/** Try to get a readable name from a CAIP identifier like eip155:1/erc20:0x... */
export function fallbackDisplayName(caipId: string): string {
  // Extract contract address from CAIP format
  const match = caipId.match(/erc20:0x([a-fA-F0-9]+)$/i)
  if (match) {
    const addr = `0x${match[1]}`.toLowerCase()
    const known = KNOWN_TOKENS[addr]
    if (known) return known
    // Show shortened address as last resort
    return `0x${match[1].slice(0, 4)}...${match[1].slice(-4)}`
  }
  // Non-ERC20 CAIP -- just shorten it
  if (caipId.length > 20) {
    return caipId.slice(0, 10) + "..." + caipId.slice(-6)
  }
  return caipId
}
