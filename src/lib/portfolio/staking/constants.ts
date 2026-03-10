import type { StakingDataConfidence } from "./types"

export const HOUR_MS = 60 * 60 * 1000
export const FREEZE_DUST_STREAK = 3
export const DUST_QTY_THRESHOLD = 1e-8
export const DUST_USD_THRESHOLD = 1
export const MAX_BACKFILL_ROWS = 50_000

export const CONFIDENCE_RANK: Record<StakingDataConfidence, number> = {
  estimated: 1,
  modeled: 2,
  exact: 3,
}

export const ZERION_TO_TX_CHAIN: Record<string, string> = {
  ethereum: "ETHEREUM",
  arbitrum: "ARBITRUM",
  base: "BASE",
  polygon: "POLYGON",
  bsc: "BSC",
  optimism: "OPTIMISM",
  avalanche: "AVALANCHE",
  gnosis: "GNOSIS",
  fantom: "FANTOM",
  linea: "LINEA",
  scroll: "SCROLL",
  blast: "BLAST",
  mantle: "MANTLE",
  zksync: "ZKSYNC",
  mode: "MODE",
}

export const TX_TO_ZERION_CHAIN: Record<string, string> = Object.fromEntries(
  Object.entries(ZERION_TO_TX_CHAIN).map(([zerion, tx]) => [tx, zerion]),
)

export const RECEIPT_PROJECTS = new Set([
  "aave-v2",
  "aave-v3",
  "pendle",
  "ether.fi-stake",
  "ether.fi-liquid",
  "rocket-pool",
  "coinbase-wrapped-staked-eth",
  "frax-ether",
  "renzo",
  "kelp-dao",
  "swell-liquid-staking",
  "stakewise-v3",
  "mantle-staked-eth",
  "ankr",
  "stader",
  "ethena",
])

export const RECEIPT_SYMBOL_PATTERNS: RegExp[] = [
  /^PT-/i,
  /^YT-/i,
  /^a(Eth|Arb|Pol|Opt|Base|Ava)/,
  /^a(USDC|USDT|DAI|WETH|WBTC|LINK|UNI|MATIC)$/i,
  /^(stETH|wstETH|rETH|cbETH|eETH|weETH|liquidETH|katanaETH|ezETH|rsETH|pufETH|sUSDe|frxETH|sfrxETH|swETH|rswETH|osETH|mETH|ankrETH|ETHx)$/i,
  /^(sUSDai|sDAI|sUSDS)$/i,
]

export const REWARD_CATEGORY_HINTS = [
  "reward",
  "rewards",
  "claim",
]

export const KNOWN_REWARD_DISTRIBUTORS: Record<string, Record<string, string[]>> = {
  "aave-v3": {
    ETHEREUM: ["0x8164cc65827dcfe994ab23944cbc90e0aa80bfcb"],
    ARBITRUM: ["0x929ec64c34a17401f460460d4b9390518e5b473e"],
    OPTIMISM: ["0x929ec64c34a17401f460460d4b9390518e5b473e"],
    POLYGON: ["0x929ec64c34a17401f460460d4b9390518e5b473e"],
    AVALANCHE: ["0x929ec64c34a17401f460460d4b9390518e5b473e"],
    BASE: ["0xf9cc4f0d883f1a1eb2c253bdb46c254ca51e1f44"],
  },
  pendle: {
    // Pendle distributes fees/rewards through Router interactions and the
    // VotingController. These addresses cover common reward-like inflows.
    ETHEREUM: [
      "0x888888888889758f76e7103c6cbf23abbf58f946", // Router v4
      "0x00000000005bbb0ef59571e58418f9a4357b68a0", // Router v3
      "0x44087e105137a5095c008aab6a6530182821f2f0", // VotingController / fee distributor
    ],
    ARBITRUM: [
      "0x888888888889758f76e7103c6cbf23abbf58f946", // Router v4
      "0x00000000005bbb0ef59571e58418f9a4357b68a0", // Router v3
    ],
  },
}

export const STABLE_UNDERLYING_SYMBOLS = new Set([
  "USDC", "USDT", "DAI", "USDE", "RLUSD",
  "FRAX", "LUSD", "GHO", "PYUSD", "CUSD", "TUSD",
  "BUSD", "USDP", "GUSD", "USDD", "FDUSD", "DOLA", "MIM",
  "CUSDO", "USDO",
  // Savings / yield-bearing stablecoin wrappers
  "SDAI", "SUSDAI", "SUSDE", "SUSDS", "USDS",
])

export function isStableUnderlying(symbol: string | null): boolean {
  if (!symbol) return false
  return STABLE_UNDERLYING_SYMBOLS.has(symbol.toUpperCase())
}

// ─── Helper functions ───

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function hourStart(date = new Date()): Date {
  return new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS)
}

export function yearStartUtc(year: number): Date {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
}

export function yearEndUtc(year: number): Date {
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
}

export function toEpochSeconds(input: Date | string | number | null | undefined): number {
  if (!input) return 0
  if (typeof input === "number") return Math.floor(input)
  if (typeof input === "string") {
    const ts = new Date(input).getTime()
    return Number.isFinite(ts) ? Math.floor(ts / 1000) : 0
  }
  const ts = input.getTime()
  return Number.isFinite(ts) ? Math.floor(ts / 1000) : 0
}

export function toAssetKey(wallet: string, chain: string, asset: string): string {
  return `${wallet.toLowerCase()}:${chain}:${asset.toLowerCase()}`
}

export function toSymbolKey(wallet: string, chain: string, symbol: string): string {
  return `${wallet.toLowerCase()}:${chain}:${symbol.toUpperCase()}`
}

export function getTxChain(chain: string): string | null {
  return ZERION_TO_TX_CHAIN[chain.toLowerCase()] ?? null
}

export function getZerionChainFromTx(txChain: string): string | null {
  return TX_TO_ZERION_CHAIN[txChain.toUpperCase()] ?? null
}

export function walletChainKey(wallet: string, chain: string): string {
  return `${wallet.toLowerCase()}:${chain}`
}

export function toTxKey(wallet: string, chain: string, txHash: string): string {
  return `${wallet.toLowerCase()}:${chain}:${txHash.toLowerCase()}`
}

export function isFutureMaturity(maturityDate: string | null): boolean {
  if (!maturityDate) return false
  const ts = new Date(maturityDate).getTime()
  return Number.isFinite(ts) && ts > Date.now()
}

export function buildPositionKey(input: {
  wallet: string
  chain: string
  protocol: string | null
  symbol: string
  contractAddress: string | null
}): string {
  const wallet = input.wallet.toLowerCase()
  const chain = input.chain.toLowerCase()
  const protocol = (input.protocol ?? "unknown").toLowerCase().replace(/\s+/g, "-")
  const idPart = input.contractAddress
    ? input.contractAddress.toLowerCase()
    : `symbol:${input.symbol.toLowerCase()}`
  return `${wallet}:${chain}:${protocol}:${idPart}`
}
