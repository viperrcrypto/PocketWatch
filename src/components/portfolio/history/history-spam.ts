// ─── Spam Detection — Tier 1 (Instant, client-side) ───

const SPAM_URL_PATTERN = /https?:\/\/|\.com|\.io|\.xyz|\.net|\.org|\.site|\.top|\.click|\.claim/i
const SPAM_KEYWORD_PATTERN = /\b(visit|claim|airdrop.*reward|free.*token|voucher|redeem|bonus.*token)\b/i
const SCAM_NAME_PATTERN = /[^\w\s].*[^\w\s]|^\$.*reward|claim.*\d|airdrop.*#|\d{3,}x/i

export const KNOWN_TOKENS = new Set([
  // Native chain tokens
  "ETH", "WETH", "BTC", "WBTC", "BNB", "WBNB", "SOL", "WSOL",
  "MATIC", "POL", "AVAX", "FTM", "ONE", "NEAR", "SUI", "SEI", "INJ",
  "APT", "ATOM", "DOT", "KSM", "ADA", "XRP", "TRX", "LTC",
  // Stablecoins
  "USDC", "USDT", "DAI", "BUSD", "TUSD", "FRAX", "PYUSD", "RLUSD", "LUSD", "RAI",
  "USDS", "FDUSD", "USDP",
  // DeFi blue-chips
  "LINK", "UNI", "AAVE", "CRV", "LDO", "RPL", "ENS", "MKR", "SNX", "COMP",
  "BAL", "SUSHI", "GRT", "FET", "RNDR", "PEPE", "SHIB", "APE",
  "stETH", "rETH", "cbETH", "GNO",
  "DYDX", "1INCH", "YFI", "PENDLE", "ENA",
  "EIGEN", "ETHFI", "SAFE", "COW", "SSV", "BLUR",
  // Layer 2 / bridges
  "ARB", "OP", "STRK", "ZK", "MANTA",
  // Solana ecosystem
  "JTO", "JUP", "BONK", "WIF", "PYTH", "ORCA", "RAY", "MNGO", "MSOL", "JSOL",
  "OpenClaw",
])

const STABLECOINS = new Set(["USDC", "USDT", "DAI", "BUSD", "TUSD", "FRAX", "PYUSD", "RLUSD", "LUSD", "RAI"])

/** Score a transaction event for spam likelihood. Returns 0-100 (>=50 = spam). */
export function getSpamScore(
  event: Record<string, unknown>,
  sentTokens: Set<string>,
): { score: number; reasons: string[] } {
  const asset = String(event.asset ?? "").trim()
  const assetUpper = asset.toUpperCase()
  const amount = Number(event.amount ?? 0)
  const usdValue = event.usd_value != null ? Number(event.usd_value) : null
  const eventType = String(event.event_type ?? event.type ?? "").toLowerCase()
  const contractAddress = event.contract_address as string | null

  // Fees and withdrawals are always user-initiated — never spam
  if (eventType === "fee" || eventType === "withdrawal") return { score: 0, reasons: [] }

  // Sends: bypass spam scoring ONLY if value is meaningful (not dust)
  if (eventType === "send") {
    const isDust = (usdValue !== null && usdValue < 0.01 && usdValue >= 0)
      || (usdValue === null && amount > 0 && amount < 0.001)
    if (!isDust) return { score: 0, reasons: [] }
    // Fall through to scoring pipeline for dust sends
  }

  const isReceiveOrSwap = eventType === "receive" || eventType === "swap" || eventType === "trade" || eventType === "deposit"
  const isKnown = KNOWN_TOKENS.has(asset) || KNOWN_TOKENS.has(assetUpper)
  const isWhitelisted = isKnown || sentTokens.has(assetUpper)
  const isNativeAsset = !contractAddress || contractAddress === "native"

  let score = 0
  const reasons: string[] = []

  // ── Name-based checks (applies to ALL tokens) ──
  if (SPAM_URL_PATTERN.test(asset)) { score += 50; reasons.push("Name contains URL") }
  if (SPAM_KEYWORD_PATTERN.test(asset)) { score += 40; reasons.push("Scam keyword in name") }
  if (SCAM_NAME_PATTERN.test(asset)) { score += 40; reasons.push("Suspicious name pattern") }
  if (asset.length > 30) { score += 30; reasons.push("Unusually long token name") }

  // ── Scam swap detection (dust swaps, address poisoning via swaps) ──
  if (eventType === "swap" || eventType === "trade") {
    const grouped = event.grouped_transfers as Array<{
      asset: string; amount: number; usd_value: number | null; direction: string | null; classification?: string | null
    }> | undefined

    if (grouped && grouped.length >= 2) {
      const sent = grouped.filter((t) => t.direction === "out" && t.classification !== "gas")
      const received = grouped.filter((t) => t.direction === "in" && t.classification !== "gas")
      const totalSentUsd = sent.reduce((s, t) => s + Math.abs(t.usd_value ?? 0), 0)
      const totalReceivedUsd = received.reduce((s, t) => s + Math.abs(t.usd_value ?? 0), 0)

      // Extreme slippage (>50% loss) — sandwich attack or scam swap
      if (totalSentUsd > 0.01 && totalReceivedUsd > 0) {
        const slippage = (totalReceivedUsd - totalSentUsd) / totalSentUsd
        if (slippage < -0.5) { score += 55; reasons.push(`Extreme slippage (${(slippage * 100).toFixed(0)}%)`) }
      }

      // Swap receiving unknown token (scam NFT or honeypot)
      for (const t of received) {
        const rAsset = t.asset.toUpperCase()
        if (!KNOWN_TOKENS.has(t.asset) && !KNOWN_TOKENS.has(rAsset) && !sentTokens.has(rAsset)) {
          score += 25; reasons.push(`Swap received unknown token: ${t.asset}`)
          break
        }
      }
    }

    // Swap with near-zero total value — dust swap
    if (usdValue !== null && usdValue >= 0 && usdValue < 0.01 && amount > 0) {
      score += 55; reasons.push("Dust swap ($0 value)")
    }
    // Stablecoin dust swap
    if (STABLECOINS.has(assetUpper) && amount > 0 && amount < 0.01) {
      score += 50; reasons.push("Stablecoin dust swap")
    }
  }

  // ── Zero USD value dust (stored as exactly 0) ──
  if (isReceiveOrSwap && usdValue !== null && usdValue === 0 && amount > 0) {
    score += 55
    reasons.push("Zero-value receive (dust attack)")
  }
  // ── Native micro-dust (e.g. 0.00001 SOL worth < $0.01 — dusting attack pattern) ──
  if (isReceiveOrSwap && isNativeAsset && usdValue !== null && usdValue > 0 && usdValue < 0.01 && amount > 0 && amount < 0.001) {
    score += 55
    reasons.push("Native token micro-dust")
  }

  // ── Dust amount checks (applies to ALL inbound tokens) ──
  if (isReceiveOrSwap && amount === 0) { score += 50; reasons.push("Zero amount") }
  if (isReceiveOrSwap && amount > 0 && amount < 0.000001) { score += 40; reasons.push("Microscopic dust amount") }
  if (eventType === "receive" && STABLECOINS.has(assetUpper) && amount > 0 && amount < 0.01) {
    score += 50; reasons.push("Stablecoin dust")
  }
  // Tiny amount with no USD price = unpriced dust (catches 1e-5 SOL with null usdValue)
  if (isReceiveOrSwap && usdValue === null && amount > 0 && amount < 0.001) {
    score += 40; reasons.push("Unpriced micro-amount")
  }
  if (isReceiveOrSwap && !STABLECOINS.has(assetUpper) && amount > 0 && amount < 0.001 && isKnown) {
    score += 20; reasons.push("Known-token dust")
  }

  // ── Outbound dust detection (address poisoning) ──
  if (eventType === "send") {
    if (isNativeAsset && amount > 0 && amount < 0.001 && usdValue !== null && usdValue < 0.01) {
      score += 60; reasons.push("Address poisoning dust send")
    } else if (usdValue !== null && usdValue === 0 && amount > 0) {
      score += 55; reasons.push("Zero-value dust send")
    } else if (usdValue === null && amount > 0 && amount < 0.001) {
      score += 50; reasons.push("Unpriced micro-send")
    }
  }

  // ── Unknown token penalties (ONLY for non-whitelisted tokens) ──
  if (!isWhitelisted) {
    if (isReceiveOrSwap) { score += 25; reasons.push("Unknown token") }
    if (usdValue === null) { score += 20; reasons.push("No price data") }
    if (contractAddress && !isNativeAsset) { score += 10; reasons.push("Unknown contract") }
  }

  return { score: Math.min(100, score), reasons }
}

/** Get full spam assessment: score + reasons (with optional GoPlus tier 2). */
export function getSpamAssessment(
  event: Record<string, unknown>,
  sentTokens: Set<string>,
  goplusScores: Map<string, number>,
): { score: number; reasons: string[] } {
  const { score: base, reasons } = getSpamScore(event, sentTokens)

  const contractAddress = event.contract_address as string | null
  if (contractAddress) {
    const goplusBonus = goplusScores.get(contractAddress.toLowerCase())
    if (goplusBonus !== undefined && goplusBonus > 0) {
      reasons.push("Flagged by security database")
      return { score: Math.min(100, base + goplusBonus), reasons }
    }
  }

  return { score: base, reasons }
}

/** Check if event is spam based on Tier 1 score + optional Tier 2 GoPlus enrichment. */
export function isSpam(
  event: Record<string, unknown>,
  sentTokens: Set<string>,
  goplusScores: Map<string, number>,
): boolean {
  // User-whitelisted transactions are never spam
  if (event.isWhitelisted === true) return false
  return getSpamAssessment(event, sentTokens, goplusScores).score >= 50
}
