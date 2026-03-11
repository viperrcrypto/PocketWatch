// ─── Chain Metadata Registry ───
// Single source of truth for all supported blockchain chains.

export interface ChainMeta {
  id: string
  name: string
  symbol: string
  color: string
  icon: string
  chainPath: string
  explorerUrl: string
  isEvm: boolean
  trustWalletName: string
}

export const CHAIN_REGISTRY: Record<string, ChainMeta> = {
  ETH: {
    id: "ETH",
    name: "Ethereum",
    symbol: "ETH",
    color: "#627EEA",
    icon: "currency_exchange",
    chainPath: "eth",
    explorerUrl: "https://etherscan.io",
    isEvm: true,
    trustWalletName: "ethereum",
  },
  OPTIMISM: {
    id: "OPTIMISM",
    name: "Optimism",
    symbol: "OP",
    color: "#FF0420",
    icon: "device_hub",
    chainPath: "optimism",
    explorerUrl: "https://optimistic.etherscan.io",
    isEvm: true,
    trustWalletName: "optimism",
  },
  ARBITRUM_ONE: {
    id: "ARBITRUM_ONE",
    name: "Arbitrum",
    symbol: "ARB",
    color: "#28A0F0",
    icon: "device_hub",
    chainPath: "arbitrum_one",
    explorerUrl: "https://arbiscan.io",
    isEvm: true,
    trustWalletName: "arbitrum",
  },
  BASE: {
    id: "BASE",
    name: "Base",
    symbol: "BASE",
    color: "#0052FF",
    icon: "device_hub",
    chainPath: "base",
    explorerUrl: "https://basescan.org",
    isEvm: true,
    trustWalletName: "base",
  },
  POLYGON_POS: {
    id: "POLYGON_POS",
    name: "Polygon",
    symbol: "POLY",
    color: "#A855F7",
    icon: "device_hub",
    chainPath: "polygon_pos",
    explorerUrl: "https://polygonscan.com",
    isEvm: true,
    trustWalletName: "polygon",
  },
  AVAX: {
    id: "AVAX",
    name: "Avalanche",
    symbol: "AVAX",
    color: "#FF6B6B",
    icon: "device_hub",
    chainPath: "avax",
    explorerUrl: "https://snowtrace.io",
    isEvm: true,
    trustWalletName: "avalanchec",
  },
  GNOSIS: {
    id: "GNOSIS",
    name: "Gnosis",
    symbol: "GNO",
    color: "#3E6957",
    icon: "device_hub",
    chainPath: "gnosis",
    explorerUrl: "https://gnosisscan.io",
    isEvm: true,
    trustWalletName: "xdai",
  },
  BTC: {
    id: "BTC",
    name: "Bitcoin",
    symbol: "BTC",
    color: "#F7931A",
    icon: "currency_bitcoin",
    chainPath: "btc",
    explorerUrl: "https://mempool.space",
    isEvm: false,
    trustWalletName: "bitcoin",
  },
  SOL: {
    id: "SOL",
    name: "Solana",
    symbol: "SOL",
    color: "#14F195",
    icon: "token",
    chainPath: "sol",
    explorerUrl: "https://solscan.io",
    isEvm: false,
    trustWalletName: "solana",
  },
  // Alias — Helius/Zerion store chain as "SOLANA" in DB
  SOLANA: {
    id: "SOL",
    name: "Solana",
    symbol: "SOL",
    color: "#14F195",
    icon: "token",
    chainPath: "sol",
    explorerUrl: "https://solscan.io",
    isEvm: false,
    trustWalletName: "solana",
  },
  BSC: {
    id: "BSC",
    name: "BSC",
    symbol: "BNB",
    color: "#F0B90B",
    icon: "device_hub",
    chainPath: "bsc",
    explorerUrl: "https://bscscan.com",
    isEvm: true,
    trustWalletName: "smartchain",
  },
  ZKSYNC: {
    id: "ZKSYNC", name: "zkSync", symbol: "ZK", color: "#4E529A",
    icon: "device_hub", chainPath: "zksync_lite", explorerUrl: "https://era.zksync.network",
    isEvm: true, trustWalletName: "zksync",
  },
  LINEA: {
    id: "LINEA", name: "Linea", symbol: "ETH", color: "#61DFFF",
    icon: "device_hub", chainPath: "linea", explorerUrl: "https://lineascan.build",
    isEvm: true, trustWalletName: "linea",
  },
  SCROLL: {
    id: "SCROLL", name: "Scroll", symbol: "ETH", color: "#EDCCA2",
    icon: "device_hub", chainPath: "scroll", explorerUrl: "https://scrollscan.com",
    isEvm: true, trustWalletName: "scroll",
  },
  BLAST: {
    id: "BLAST", name: "Blast", symbol: "ETH", color: "#E6FF2E",
    icon: "device_hub", chainPath: "blast", explorerUrl: "https://blastscan.io",
    isEvm: true, trustWalletName: "blast",
  },
  MANTLE: {
    id: "MANTLE", name: "Mantle", symbol: "MNT", color: "#2ECC94",
    icon: "device_hub", chainPath: "mantle", explorerUrl: "https://mantlescan.xyz",
    isEvm: true, trustWalletName: "mantle",
  },
  MODE: {
    id: "MODE", name: "Mode", symbol: "ETH", color: "#C8FF00",
    icon: "device_hub", chainPath: "mode", explorerUrl: "https://modescan.io",
    isEvm: true, trustWalletName: "mode",
  },
  FANTOM: {
    id: "FANTOM", name: "Fantom", symbol: "FTM", color: "#1969FF",
    icon: "device_hub", chainPath: "fantom", explorerUrl: "https://ftmscan.com",
    isEvm: true, trustWalletName: "fantom",
  },
  ZORA: {
    id: "ZORA", name: "Zora", symbol: "ETH", color: "#FF4F00",
    icon: "device_hub", chainPath: "zora", explorerUrl: "https://zorascan.xyz",
    isEvm: true, trustWalletName: "zora",
  },
  BERACHAIN: {
    id: "BERACHAIN", name: "Berachain", symbol: "BERA", color: "#804A26",
    icon: "device_hub", chainPath: "berachain", explorerUrl: "https://berascan.com",
    isEvm: true, trustWalletName: "berachain",
  },
  MONAD: {
    id: "MONAD", name: "Monad", symbol: "MON", color: "#836EF9",
    icon: "device_hub", chainPath: "monad", explorerUrl: "https://monadexplorer.com",
    isEvm: true, trustWalletName: "monad",
  },
  EXCHANGE: {
    id: "EXCHANGE", name: "Exchange", symbol: "CEX", color: "#6B7280",
    icon: "account_balance", chainPath: "exchange", explorerUrl: "",
    isEvm: false, trustWalletName: "exchange",
  },
}

// ─── Derived exports ───

export const SUPPORTED_CHAINS = Object.values(CHAIN_REGISTRY)
export const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_REGISTRY)
export const EVM_CHAIN_IDS = SUPPORTED_CHAINS.filter((c) => c.isEvm).map((c) => c.id)

export const CHAIN_PATH: Record<string, string> = Object.fromEntries(
  SUPPORTED_CHAINS.map((c) => [c.id, c.chainPath])
)

export const CHAIN_LABELS: Record<string, string> = Object.fromEntries(
  SUPPORTED_CHAINS.map((c) => [c.id, c.name])
)

export const CHAIN_OPTIONS = SUPPORTED_CHAINS.map((c) => ({
  id: c.id,
  label: c.name,
}))

// ─── Case-insensitive lookup index ───

const CHAIN_LOOKUP: Record<string, ChainMeta> = {}
for (const chain of SUPPORTED_CHAINS) {
  CHAIN_LOOKUP[chain.id] = chain
  CHAIN_LOOKUP[chain.id.toLowerCase()] = chain
  CHAIN_LOOKUP[chain.chainPath] = chain
  CHAIN_LOOKUP[chain.name.toLowerCase()] = chain // "ethereum", "bitcoin", etc.
  CHAIN_LOOKUP[chain.trustWalletName] = chain    // "ethereum", "bitcoin", "xdai", etc.
}

// Extra aliases for chain names stored in TransactionCache by Zerion/Alchemy
// that don't match any CHAIN_REGISTRY key, name, or trustWalletName.
const EXTRA_ALIASES: Record<string, string> = {
  // Zerion stores these but registry keys differ
  ETHEREUM: "ETH",
  ARBITRUM: "ARBITRUM_ONE",
  POLYGON: "POLYGON_POS",
  AVALANCHE: "AVAX",
  POLYGON_ZKEVM: "POLYGON_POS", // fallback to Polygon explorer
  // Zerion uses hyphenated chain IDs not present in the registry
  "BINANCE-SMART-CHAIN": "BSC",
  "ZKSYNC-ERA": "ZKSYNC",
}
for (const [alias, targetId] of Object.entries(EXTRA_ALIASES)) {
  const meta = CHAIN_LOOKUP[targetId]
  if (meta) {
    CHAIN_LOOKUP[alias] = meta
    CHAIN_LOOKUP[alias.toLowerCase()] = meta
  }
}

// ─── Helpers ───

export function getChainMeta(chainId: string): ChainMeta | undefined {
  return CHAIN_LOOKUP[chainId] ?? CHAIN_LOOKUP[chainId.toLowerCase()]
}

export function getChainColor(chainId: string): string {
  return getChainMeta(chainId)?.color ?? "var(--foreground-muted)"
}

export function getChainLabel(chainId: string): string {
  return getChainMeta(chainId)?.name ?? chainId
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ─── EIP-155 numeric chain ID → internal chain key ───

export const EIP155_CHAIN_ID_MAP: Record<number, string> = {
  1: "ETH",
  10: "OPTIMISM",
  42161: "ARBITRUM_ONE",
  8453: "BASE",
  137: "POLYGON_POS",
  43114: "AVAX",
  100: "GNOSIS",
  56: "BSC",
  324: "ZKSYNC",
  59144: "LINEA",
  534352: "SCROLL",
  81457: "BLAST",
  5000: "MANTLE",
  34443: "MODE",
  250: "FANTOM",
  7777777: "ZORA",
  80094: "BERACHAIN",
  10143: "MONAD",
}

// ─── Well-known native token symbols → chain key ───

export const NATIVE_TOKEN_CHAINS: Record<string, string> = {
  ETH: "ETH",
  BTC: "BTC",
  SOL: "SOL",
  AVAX: "AVAX",
  MATIC: "POLYGON_POS",
  GNO: "GNOSIS",
  XDAI: "GNOSIS",
  BNB: "BSC",
  FTM: "FANTOM",
  MNT: "MANTLE",
  BERA: "BERACHAIN",
  MON: "MONAD",
}
