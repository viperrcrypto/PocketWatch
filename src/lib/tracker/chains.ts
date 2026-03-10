// Chain definitions, explorer URLs, and DEX router addresses for the Wallet Tracker.

import type { ChainConfig, TrackerChain } from "./types"

export const CHAIN_CONFIGS: Record<TrackerChain, ChainConfig> = {
  ETHEREUM: {
    id: "ETHEREUM",
    name: "Ethereum",
    shortName: "ETH",
    nativeToken: "ETH",
    nativeDecimals: 18,
    explorerUrl: "https://etherscan.io",
    explorerApiUrl: "https://api.etherscan.io/api",
    apiKeyService: "etherscan",
    iconName: "currency_exchange",
    color: "#627EEA",
    freeApiTier: { ratePerSecond: 0.2, signupUrl: "https://etherscan.io/myapikey", signupLabel: "Etherscan" },
  },
  ARBITRUM: {
    id: "ARBITRUM",
    name: "Arbitrum",
    shortName: "ARB",
    nativeToken: "ETH",
    nativeDecimals: 18,
    explorerUrl: "https://arbiscan.io",
    explorerApiUrl: "https://api.arbiscan.io/api",
    apiKeyService: "arbiscan",
    iconName: "currency_exchange",
    color: "#28A0F0",
    freeApiTier: { ratePerSecond: 0.2, signupUrl: "https://arbiscan.io/myapikey", signupLabel: "Arbiscan" },
  },
  BASE: {
    id: "BASE",
    name: "Base",
    shortName: "BASE",
    nativeToken: "ETH",
    nativeDecimals: 18,
    explorerUrl: "https://basescan.org",
    explorerApiUrl: "https://api.basescan.org/api",
    apiKeyService: "basescan",
    iconName: "currency_exchange",
    color: "#0052FF",
    freeApiTier: { ratePerSecond: 0.2, signupUrl: "https://basescan.org/myapikey", signupLabel: "BaseScan" },
  },
  POLYGON: {
    id: "POLYGON",
    name: "Polygon",
    shortName: "POL",
    nativeToken: "POL",
    nativeDecimals: 18,
    explorerUrl: "https://polygonscan.com",
    explorerApiUrl: "https://api.polygonscan.com/api",
    apiKeyService: "polygonscan",
    iconName: "currency_exchange",
    color: "#8247E5",
    freeApiTier: { ratePerSecond: 0.2, signupUrl: "https://polygonscan.com/myapikey", signupLabel: "PolygonScan" },
  },
  BSC: {
    id: "BSC",
    name: "BNB Chain",
    shortName: "BSC",
    nativeToken: "BNB",
    nativeDecimals: 18,
    explorerUrl: "https://bscscan.com",
    explorerApiUrl: "https://api.bscscan.com/api",
    apiKeyService: "bscscan",
    iconName: "currency_exchange",
    color: "#F0B90B",
    freeApiTier: { ratePerSecond: 0.2, signupUrl: "https://bscscan.com/myapikey", signupLabel: "BscScan" },
  },
  OPTIMISM: {
    id: "OPTIMISM",
    name: "Optimism",
    shortName: "OP",
    nativeToken: "ETH",
    nativeDecimals: 18,
    explorerUrl: "https://optimistic.etherscan.io",
    explorerApiUrl: "https://api-optimistic.etherscan.io/api",
    apiKeyService: "optimism_etherscan",
    iconName: "currency_exchange",
    color: "#FF0420",
    freeApiTier: { ratePerSecond: 0.2, signupUrl: "https://optimistic.etherscan.io/myapikey", signupLabel: "OP Etherscan" },
  },
  LINEA: {
    id: "LINEA",
    name: "Linea",
    shortName: "LINEA",
    nativeToken: "ETH",
    nativeDecimals: 18,
    explorerUrl: "https://lineascan.build",
    explorerApiUrl: "https://api.lineascan.build/api",
    apiKeyService: "lineascan",
    iconName: "currency_exchange",
    color: "#61DFFF",
    freeApiTier: { ratePerSecond: 0.2, signupUrl: "https://lineascan.build/myapikey", signupLabel: "LineaScan" },
  },
  SCROLL: {
    id: "SCROLL",
    name: "Scroll",
    shortName: "SCROLL",
    nativeToken: "ETH",
    nativeDecimals: 18,
    explorerUrl: "https://scrollscan.com",
    explorerApiUrl: "https://api.scrollscan.com/api",
    apiKeyService: "scrollscan",
    iconName: "currency_exchange",
    color: "#FFEEDA",
    freeApiTier: { ratePerSecond: 0.2, signupUrl: "https://scrollscan.com/myapikey", signupLabel: "ScrollScan" },
  },
  ZKSYNC: {
    id: "ZKSYNC",
    name: "zkSync Era",
    shortName: "ZK",
    nativeToken: "ETH",
    nativeDecimals: 18,
    explorerUrl: "https://era.zksync.network",
    explorerApiUrl: "https://block-explorer-api.mainnet.zksync.io/api",
    apiKeyService: "zksync_explorer",
    iconName: "currency_exchange",
    color: "#8C8DFC",
    freeApiTier: { ratePerSecond: 0.2, signupUrl: "https://era.zksync.network/", signupLabel: "zkSync Explorer" },
  },
  SOLANA: {
    id: "SOLANA",
    name: "Solana",
    shortName: "SOL",
    nativeToken: "SOL",
    nativeDecimals: 9,
    explorerUrl: "https://solscan.io",
    explorerApiUrl: "https://api.helius.xyz",
    apiKeyService: "helius",
    iconName: "currency_exchange",
    color: "#9945FF",
  },
}

// All supported chains
export const SUPPORTED_CHAINS: TrackerChain[] = [
  "ETHEREUM",
  "ARBITRUM",
  "BASE",
  "POLYGON",
  "BSC",
  "OPTIMISM",
  "LINEA",
  "SCROLL",
  "ZKSYNC",
  "SOLANA",
]

// API key service labels for display
export const API_KEY_SERVICES: { service: string; label: string; chain?: TrackerChain; required: boolean; description?: string }[] = [
  { service: "codex", label: "Codex", required: false, description: "Unified API for all chains — replaces individual chain keys" },
  { service: "alchemy", label: "Alchemy", required: false, description: "Covers all EVM chains + Solana — recommended fallback key" },
  { service: "etherscan", label: "Etherscan", chain: "ETHEREUM", required: false },
  { service: "arbiscan", label: "Arbiscan", chain: "ARBITRUM", required: false },
  { service: "basescan", label: "Basescan", chain: "BASE", required: false },
  { service: "polygonscan", label: "Polygonscan", chain: "POLYGON", required: false },
  { service: "bscscan", label: "BscScan", chain: "BSC", required: false },
  { service: "optimism_etherscan", label: "Optimism Etherscan", chain: "OPTIMISM", required: false },
  { service: "lineascan", label: "LineaScan", chain: "LINEA", required: false },
  { service: "scrollscan", label: "ScrollScan", chain: "SCROLL", required: false },
  { service: "zksync_explorer", label: "zkSync Explorer", chain: "ZKSYNC", required: false },
  { service: "helius", label: "Helius", chain: "SOLANA", required: false },
]

// Known DEX router addresses for transaction classification
export const DEX_ROUTERS: Record<string, { name: string; chains: TrackerChain[] }> = {
  // Uniswap V2 Router
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": { name: "Uniswap V2", chains: ["ETHEREUM"] },
  // Uniswap V3 Router
  "0xe592427a0aece92de3edee1f18e0157c05861564": { name: "Uniswap V3", chains: ["ETHEREUM", "ARBITRUM", "POLYGON", "BASE"] },
  // Uniswap Universal Router
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": { name: "Uniswap", chains: ["ETHEREUM", "ARBITRUM", "POLYGON", "BASE"] },
  // SushiSwap
  "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": { name: "SushiSwap", chains: ["ETHEREUM"] },
  // PancakeSwap V2
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": { name: "PancakeSwap", chains: ["BSC"] },
  // PancakeSwap V3
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": { name: "PancakeSwap V3", chains: ["BSC"] },
  // 1inch V5
  "0x1111111254eeb25477b68fb85ed929f73a960582": { name: "1inch", chains: ["ETHEREUM", "ARBITRUM", "POLYGON", "BSC", "BASE"] },
  // 0x Exchange Proxy
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": { name: "0x", chains: ["ETHEREUM", "ARBITRUM", "POLYGON", "BSC", "BASE"] },
  // Camelot (Arbitrum)
  "0xc873fecbd354f5a56e00e710b90ef4201db2448d": { name: "Camelot", chains: ["ARBITRUM"] },
  // Aerodrome (Base)
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": { name: "Aerodrome", chains: ["BASE"] },
  // QuickSwap (Polygon)
  "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff": { name: "QuickSwap", chains: ["POLYGON"] },
}

// Solana DEX program IDs (from solanamanbot reference)
export const SOLANA_DEX_PROGRAMS: Record<string, string> = {
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA": "PumpSwap",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "Pump.fun",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca",
  "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM": "Pump.fun Mint",
}

// Helper to get chain config
export function getChainConfig(chain: TrackerChain): ChainConfig {
  return CHAIN_CONFIGS[chain]
}

// Helper to get explorer tx URL
export function getExplorerTxUrl(chain: TrackerChain, txHash: string): string {
  const config = CHAIN_CONFIGS[chain]
  if (chain === "SOLANA") {
    return `https://solscan.io/tx/${txHash}`
  }
  return `${config.explorerUrl}/tx/${txHash}`
}

// Helper to get explorer address URL
export function getExplorerAddressUrl(chain: TrackerChain, address: string): string {
  const config = CHAIN_CONFIGS[chain]
  if (chain === "SOLANA") {
    return `https://solscan.io/account/${address}`
  }
  return `${config.explorerUrl}/address/${address}`
}

// Helper to get explorer token URL
export function getExplorerTokenUrl(chain: TrackerChain, address: string): string {
  const config = CHAIN_CONFIGS[chain]
  if (chain === "SOLANA") {
    return `https://solscan.io/token/${address}`
  }
  return `${config.explorerUrl}/token/${address}`
}

// Detect if an address is a Solana address (base58, 32-44 chars)
export function isSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

// Detect if an address is an EVM address (0x prefix, 40 hex chars)
export function isEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

// DeFiLlama chain identifiers
export const DEFILLAMA_CHAIN_MAP: Record<TrackerChain, string> = {
  ETHEREUM: "ethereum",
  ARBITRUM: "arbitrum",
  BASE: "base",
  POLYGON: "polygon",
  BSC: "bsc",
  OPTIMISM: "optimism",
  LINEA: "linea",
  SCROLL: "scroll",
  ZKSYNC: "era",
  SOLANA: "solana",
}

// Chains synced via Etherscan-family block explorer APIs (txlist/tokentx/etc.)
export const ETHERSCAN_SYNC_CHAINS: Partial<Record<TrackerChain, string>> = {
  BSC: "bscscan",
  LINEA: "lineascan",
  SCROLL: "scrollscan",
  ZKSYNC: "zksync_explorer",
}

// Chains that support alchemy_getAssetTransfers (used by transaction-fetcher)
export const ALCHEMY_TRANSFER_CHAINS: Partial<Record<TrackerChain, string>> = {
  ETHEREUM: "eth-mainnet",
  ARBITRUM: "arb-mainnet",
  BASE: "base-mainnet",
  POLYGON: "polygon-mainnet",
  OPTIMISM: "opt-mainnet",
}

// Full Alchemy RPC chain slugs (for eth_blockNumber, generic RPC, etc.)
export const ALCHEMY_CHAIN_SLUGS: Partial<Record<TrackerChain, string>> = {
  ...ALCHEMY_TRANSFER_CHAINS,
  BSC: "bnb-mainnet",
  LINEA: "linea-mainnet",
  SCROLL: "scroll-mainnet",
  ZKSYNC: "zksync-mainnet",
}

// Codex network IDs for each chain
export const CODEX_NETWORK_IDS: Record<TrackerChain, number> = {
  ETHEREUM: 1,
  ARBITRUM: 42161,
  BASE: 8453,
  POLYGON: 137,
  BSC: 56,
  OPTIMISM: 10,
  LINEA: 59144,
  SCROLL: 534352,
  ZKSYNC: 324,
  SOLANA: 1399811149,
}

// Reverse lookup: Codex networkId → TrackerChain
export const CODEX_NETWORK_TO_CHAIN: Record<number, TrackerChain> = Object.fromEntries(
  Object.entries(CODEX_NETWORK_IDS).map(([chain, id]) => [id, chain as TrackerChain])
) as Record<number, TrackerChain>

// Native token symbols per chain (for identifying native swaps in PnL computation)
export const NATIVE_TOKEN_SYMBOLS: Set<string> = new Set([
  "SOL", "WSOL", "ETH", "WETH", "BNB", "WBNB", "POL", "WPOL", "MATIC", "WMATIC",
])

// CoinGecko IDs for DeFiLlama price API (keyed by native symbol)
export const NATIVE_COINGECKO_IDS: Record<string, string> = {
  SOL: "coingecko:solana",
  WSOL: "coingecko:solana",
  ETH: "coingecko:ethereum",
  WETH: "coingecko:ethereum",
  BNB: "coingecko:binancecoin",
  WBNB: "coingecko:binancecoin",
  POL: "coingecko:matic-network",
  WPOL: "coingecko:matic-network",
  MATIC: "coingecko:matic-network",
  WMATIC: "coingecko:matic-network",
  AVAX: "coingecko:avalanche-2",
  WAVAX: "coingecko:avalanche-2",
  XDAI: "coingecko:xdai",
}

/**
 * Fetch current native token prices from DeFiLlama (SOL, ETH, BNB, POL).
 * Returns a map of uppercase symbol → USD price.
 * Cached per request — call once per feed load.
 */
export async function fetchNativeTokenPrices(): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>()
  try {
    const ids = [...new Set(Object.values(NATIVE_COINGECKO_IDS))].join(",")
    const res = await fetch(`https://coins.llama.fi/prices/current/${ids}`, {
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 60 }, // Cache for 60s in Next.js
    })
    if (!res.ok) return priceMap
    const data = await res.json()
    // Map each native symbol to its price
    for (const [symbol, cgId] of Object.entries(NATIVE_COINGECKO_IDS)) {
      const price = data.coins?.[cgId]?.price
      if (price != null) priceMap.set(symbol.toUpperCase(), price)
    }
  } catch {
    // Return empty map — PnL will fall back to deriveUsd()
  }
  return priceMap
}
