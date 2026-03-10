/**
 * Symbol normalization, spam detection, and heuristic pricing utilities
 * for the price resolution pipeline.
 */

const STABLE_SYMBOL_FRAGMENTS = [
  "USD", "USDC", "USDT", "DAI", "USDE", "USDAI", "PYUSD", "RLUSD",
  "FDUSD", "USDP", "TUSD", "GUSD", "LUSD", "FRAX",
]

const ETH_LIKE_FRAGMENTS = [
  "ETH", "WETH", "STETH", "WSTETH", "EETH", "WEETH", "RSETH",
  "EZETH", "CBETH", "ANKRETH", "METH",
]

const SPAM_SYMBOL_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\.com\b/i,
  /\.org\b/i,
  /\.net\b/i,
  /\.xyz\b/i,
  /t\.me\b/i,
  /telegram/i,
  /\bvisit\b/i,
  /\bclaim\b/i,
  /\bairdrop\b/i,
]

export const NATIVE_SYMBOL_BY_CHAIN: Record<string, string> = {
  ETHEREUM: "ETH",
  ARBITRUM: "ETH",
  BASE: "ETH",
  POLYGON: "POL",
  BSC: "BNB",
  OPTIMISM: "ETH",
  LINEA: "ETH",
  SCROLL: "ETH",
  ZKSYNC: "ETH",
  SOLANA: "SOL",
}

export const COINGECKO_PLATFORM_BY_CHAIN: Record<string, string> = {
  ETHEREUM: "ethereum",
  ARBITRUM: "arbitrum-one",
  BASE: "base",
  POLYGON: "polygon-pos",
  BSC: "binance-smart-chain",
  OPTIMISM: "optimistic-ethereum",
  LINEA: "linea",
  SCROLL: "scroll",
  ZKSYNC: "zksync",
  SOLANA: "solana",
}

export function isStableLikeSymbol(normalized: string): boolean {
  return STABLE_SYMBOL_FRAGMENTS.some((fragment) => normalized.includes(fragment))
}

export function isEthLikeSymbol(normalized: string): boolean {
  return ETH_LIKE_FRAGMENTS.some((fragment) => normalized.includes(fragment))
}

export function isLikelySpamTokenSymbol(symbol: string | null): boolean {
  if (!symbol) return false
  const raw = symbol.trim()
  if (!raw) return false
  const lowered = raw.toLowerCase()

  if (SPAM_SYMBOL_PATTERNS.some((pattern) => pattern.test(lowered))) return true

  // Ticker symbols are short; long sentence-like "symbols" are commonly spam.
  const wordCount = raw.split(/\s+/).filter(Boolean).length
  if (wordCount >= 4) return true
  if (raw.length > 28 && /\s/.test(raw)) return true

  // Truncated contract addresses used as symbols (e.g. "EPjF...Dt1v")
  if (/^[A-Za-z0-9]{3,}\.{2,}[A-Za-z0-9]{2,}$/.test(raw)) return true

  return false
}

export function normalizeSymbolForPricing(symbol: string | null): string | null {
  if (!symbol) return null
  let normalized = symbol.trim().toUpperCase()
  if (!normalized) return null

  // Pendle-style wrappers: PT-sUSDai-19FEB2026 / SY-USDC / YT-WETH-...
  if (
    normalized.startsWith("PT-") ||
    normalized.startsWith("SY-") ||
    normalized.startsWith("YT-")
  ) {
    const parts = normalized.split("-")
    if (parts.length >= 2 && parts[1]) normalized = parts[1]
  }

  // Aave-like wrappers: aEthUSDC / aArbUSDC / aEthRLUSD
  normalized = normalized.replace(/^A(ETH|ARB|BASE|OPT|POL|AVA)/, "")

  // Explicit aToken pattern: strip leading "A" only for known underlying symbols
  const ATOKEN_UNDERLYING = /^[Aa](USDC|USDT|DAI|WBTC|WETH|ETH|LINK|UNI|MATIC|ARB|OP|CRV|AAVE|SNX|BAL|COMP|MKR|SUSHI|YFI|GRT|FXS|FRAX|LUSD|cbETH|rETH|stETH|wstETH)$/i
  if (ATOKEN_UNDERLYING.test(normalized)) {
    normalized = normalized.slice(1)
  }

  // Savings/staked wrappers: sUSDai -> USDAI, sUSDe -> USDE, sDAI -> DAI, sFRAX -> FRAX
  normalized = normalized.replace(/^S(USDAI|USDE|DAI|FRAX)$/i, "$1")

  // Compound cTokens: cUSDC -> USDC, cDAI -> DAI, cETH -> ETH
  normalized = normalized.replace(/^C(USDC|USDT|DAI|ETH|WBTC)$/i, "$1")

  return normalized
}

export function isPlausibleResolvedPrice(
  symbol: string | null,
  chain: string,
  price: number,
  nativePrices: Map<string, number>
): boolean {
  if (!Number.isFinite(price) || price <= 0) return false
  if (isLikelySpamTokenSymbol(symbol)) return false

  const normalized = normalizeSymbolForPricing(symbol)
  if (!normalized) return price <= 1_000_000

  if (isStableLikeSymbol(normalized)) {
    return price >= 0.5 && price <= 2
  }

  const nativeSymbol = (NATIVE_SYMBOL_BY_CHAIN[chain] ?? "").toUpperCase()
  const chainNativePrice = nativeSymbol ? nativePrices.get(nativeSymbol) : undefined
  const ethPrice = nativePrices.get("ETH")
  const nativeReferencePrice = nativeSymbol === "ETH"
    ? (ethPrice ?? chainNativePrice)
    : chainNativePrice

  const isNativeLike = !!nativeSymbol && (normalized === nativeSymbol || normalized === `W${nativeSymbol}`)
  const isEthLike = nativeSymbol === "ETH" && isEthLikeSymbol(normalized)

  if ((isNativeLike || isEthLike) && nativeReferencePrice && nativeReferencePrice > 0) {
    return price >= nativeReferencePrice * 0.2 && price <= nativeReferencePrice * 5
  }

  return price <= 1_000_000
}

export function inferHeuristicUsdPrice(
  symbol: string | null,
  chain: string,
  nativePrices: Map<string, number>
): number | null {
  if (isLikelySpamTokenSymbol(symbol)) return null
  const normalized = normalizeSymbolForPricing(symbol)
  if (!normalized) return null

  // Stablecoins and stablecoin wrappers.
  if (isStableLikeSymbol(normalized)) {
    return 1
  }

  const nativeSymbol = (NATIVE_SYMBOL_BY_CHAIN[chain] ?? "").toUpperCase()
  const chainNativePrice = nativeSymbol ? nativePrices.get(nativeSymbol) : undefined
  const ethPrice = nativePrices.get("ETH")

  if (nativeSymbol && (normalized === nativeSymbol || normalized === `W${nativeSymbol}`)) {
    return chainNativePrice ?? null
  }

  if (nativeSymbol === "ETH" && isEthLikeSymbol(normalized)) {
    return ethPrice ?? chainNativePrice ?? null
  }

  return null
}
