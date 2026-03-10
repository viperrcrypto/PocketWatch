// ─── Shared RPC Utilities for Vesting Claims ───
// Core multi-chain client, ERC20 resolution, and safe reads are in multi-chain-client.ts.
// This file re-exports them and adds vesting-specific utilities (Solana, chain configs).

import type { PublicClient } from "viem"
import type { ChainRpcConfig } from "./types"

// Re-export everything from the shared client
export {
  getPublicClient,
  safeContractRead,
  ERC20_META_ABI,
  resolveERC20Token,
  VIEM_CHAINS,
  PUBLIC_RPCS,
  getRpcUrl,
  alchemyUrl,
  ZERION_CHAIN_ID_MAP,
} from "../multi-chain-client"

import { VIEM_CHAINS, getRpcUrl } from "../multi-chain-client"

// ─── Internal ↔ EIP-155 mapping (vesting-specific) ───

const INTERNAL_TO_EIP155: Record<string, number> = {
  ETH: 1,
  ARBITRUM_ONE: 42161,
  OPTIMISM: 10,
  POLYGON_POS: 137,
  BASE: 8453,
  AVAX: 43114,
  BSC: 56,
  GNOSIS: 100,
  FANTOM: 250,
  LINEA: 59144,
  SCROLL: 534352,
  BLAST: 81457,
  MANTLE: 5000,
  MODE: 34443,
  ZKSYNC: 324,
}

export const EIP155_TO_INTERNAL: Record<number, string> = Object.fromEntries(
  Object.entries(INTERNAL_TO_EIP155).map(([k, v]) => [v, k])
)

// ─── Get chain configs for a platform ───

export function getChainConfigs(chainIds: number[]): ChainRpcConfig[] {
  return chainIds
    .filter((id) => VIEM_CHAINS[id] && getRpcUrl(id))
    .map((id) => ({
      chainId: id,
      internalId: EIP155_TO_INTERNAL[id] || `CHAIN_${id}`,
      rpcUrl: getRpcUrl(id),
      name: VIEM_CHAINS[id]?.name || `Chain ${id}`,
    }))
}

// ─── Solana RPC ───

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"

export async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error.message || "Solana RPC error")
    return json.result as T
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Utility: Safe multicall with timeout ───

export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

// ─── SPL Token Metadata Resolution (Solana) ───

const splTokenCache = new Map<string, { symbol: string; decimals: number }>()

export async function resolveSPLToken(
  mintAddress: string,
): Promise<{ symbol: string; decimals: number }> {
  const cached = splTokenCache.get(mintAddress)
  if (cached) return cached

  const fallbackSymbol = mintAddress.length >= 10
    ? `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`
    : "UNKNOWN"
  let symbol = fallbackSymbol
  let decimals = 6

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5_000)
    try {
      const res = await fetch(`https://tokens.jup.ag/token/${mintAddress}`, {
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json() as { symbol?: string; decimals?: number }
        if (data.symbol) symbol = data.symbol
        if (typeof data.decimals === "number") decimals = data.decimals
      }
    } finally {
      clearTimeout(timer)
    }
  } catch {
    try {
      const accountInfo = await solanaRpc<{
        value: { data: [string, string] } | null
      }>("getAccountInfo", [mintAddress, { encoding: "base64" }])

      if (accountInfo?.value?.data) {
        const buf = Buffer.from(accountInfo.value.data[0], "base64")
        if (buf.length >= 45) {
          decimals = buf[44]
        }
      }
    } catch {
      // keep default decimals=6
    }
  }

  const result = { symbol, decimals }
  splTokenCache.set(mintAddress, result)
  return result
}
