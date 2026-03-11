/**
 * Shared multi-chain viem client factory.
 * Used across yield readers, rewards checkers, and on-chain data needs.
 */

import { createPublicClient, http, type PublicClient, type Chain } from "viem"
import {
  mainnet, arbitrum, optimism, polygon, base, avalanche,
  bsc, gnosis, fantom, linea, scroll, blast, mantle, mode, zkSync,
} from "viem/chains"

// ─── Chain Configuration ───

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || ""

export function alchemyUrl(network: string): string | null {
  if (!ALCHEMY_KEY) return null
  return `https://${network}.g.alchemy.com/v2/${ALCHEMY_KEY}`
}

export const VIEM_CHAINS: Record<number, Chain> = {
  1: mainnet,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  8453: base,
  43114: avalanche,
  56: bsc,
  100: gnosis,
  250: fantom,
  59144: linea,
  534352: scroll,
  81457: blast,
  5000: mantle,
  34443: mode,
  324: zkSync,
}

export const PUBLIC_RPCS: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  42161: "https://arbitrum-one-rpc.publicnode.com",
  10: "https://optimism-rpc.publicnode.com",
  137: "https://polygon-bor-rpc.publicnode.com",
  8453: "https://base-rpc.publicnode.com",
  43114: "https://avalanche-c-chain-rpc.publicnode.com",
  56: "https://bsc-rpc.publicnode.com",
  100: "https://gnosis-rpc.publicnode.com",
  250: "https://fantom-rpc.publicnode.com",
  59144: "https://rpc.linea.build",
  534352: "https://rpc.scroll.io",
  81457: "https://rpc.blast.io",
  5000: "https://rpc.mantle.xyz",
  34443: "https://mainnet.mode.network",
  324: "https://mainnet.era.zksync.io",
}

export function getRpcUrl(chainId: number): string {
  const alchemyNetworks: Record<number, string> = {
    1: "eth-mainnet",
    42161: "arb-mainnet",
    10: "opt-mainnet",
    137: "polygon-mainnet",
    8453: "base-mainnet",
  }

  const network = alchemyNetworks[chainId]
  if (network) {
    const url = alchemyUrl(network)
    if (url) return url
  }

  return PUBLIC_RPCS[chainId] || ""
}

// ─── Zerion chain name → EVM chain ID ───

export const ZERION_CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
  gnosis: 100,
  bsc: 56,
  fantom: 250,
  linea: 59144,
  scroll: 534352,
  blast: 81457,
  mantle: 5000,
  zksync: 324,
  mode: 34443,
}

// ─── Client Cache ───

const clientCache = new Map<number, PublicClient>()

export function getPublicClient(chainId: number): PublicClient | null {
  const cached = clientCache.get(chainId)
  if (cached) return cached

  const rpcUrl = getRpcUrl(chainId)
  if (!rpcUrl) return null

  const chain = VIEM_CHAINS[chainId]
  if (!chain) return null

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 15_000, retryCount: 1 }),
  })

  clientCache.set(chainId, client)
  return client
}

/** Get a viem client by Zerion chain name (e.g. "ethereum", "arbitrum") */
export function getPublicClientByZerionChain(zerionChain: string): PublicClient | null {
  const chainId = ZERION_CHAIN_ID_MAP[zerionChain.toLowerCase()]
  if (!chainId) return null
  return getPublicClient(chainId)
}

// ─── Safe contract read with timeout ───

export async function safeContractRead<T>(
  client: PublicClient,
  args: {
    address: `0x${string}`
    abi: readonly unknown[]
    functionName: string
    args?: unknown[]
  },
  timeoutMs = 10_000,
): Promise<T | null> {
  try {
    const result = await Promise.race([
      client.readContract(args as any),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])
    return result as T | null
  } catch {
    return null
  }
}

// ─── ERC20 Token Metadata ───

export const ERC20_META_ABI = [
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const

const tokenMetaCache = new Map<string, { symbol: string; decimals: number }>()

export async function resolveERC20Token(
  client: PublicClient,
  tokenAddress: string,
): Promise<{ symbol: string; decimals: number }> {
  const key = tokenAddress.toLowerCase()
  const cached = tokenMetaCache.get(key)
  if (cached) return cached

  const fallbackSymbol = tokenAddress.length >= 10
    ? `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`
    : "UNKNOWN"
  let symbol = fallbackSymbol
  let decimals = 18

  const addr = tokenAddress as `0x${string}`

  try {
    const dec = await client.readContract({
      address: addr,
      abi: ERC20_META_ABI,
      functionName: "decimals",
    })
    decimals = Number(dec)
  } catch {
    // keep default 18
  }

  try {
    const sym = await client.readContract({
      address: addr,
      abi: ERC20_META_ABI,
      functionName: "symbol",
    })
    if (typeof sym === "string" && sym.length > 0) symbol = sym
  } catch {
    try {
      const raw = await client.readContract({
        address: addr,
        abi: [{
          name: "symbol",
          type: "function",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "bytes32" }],
        }] as const,
        functionName: "symbol",
      })
      if (raw) {
        const hex = raw as `0x${string}`
        const bytes = Buffer.from(hex.slice(2), "hex")
        const decoded = bytes.toString("utf8").replace(/\0/g, "").trim()
        if (decoded.length > 0) symbol = decoded
      }
    } catch {
      // keep fallback
    }
  }

  const result = { symbol, decimals }
  tokenMetaCache.set(key, result)
  return result
}
