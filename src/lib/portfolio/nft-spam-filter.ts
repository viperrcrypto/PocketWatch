// ─── NFT Collection Spam Scoring ───
//
// Multi-signal scoring system for detecting spam/scam NFT collections.
// Each collection is scored 0–100; score >= SPAM_THRESHOLD = likely spam.

const SPAM_THRESHOLD = 50

export interface SpamResult {
  isSpam: boolean
  score: number
  reasons: string[]
}

export interface SpamScoringInput {
  name: string
  floorPrice: number | null
  openSeaSlug: string | null
  isSpamAlchemy?: boolean
}

// URL patterns commonly found in phishing NFT names
const URL_PATTERN = /\.(com|io|xyz|finance|org|net|app|cc|co|me|info|site|link|club)\b|https?:\/\/|www\.|t\.me\//i

// Scam bait keywords (word-boundary matched)
const SCAM_KEYWORDS = /\b(claim|airdrop|drop|visit|reward|free|bonus|staked|eligible|activate|redeem|congratulations|winner)\b/i

// Fake ticker prefix (e.g. "$WLFIPAS1752", "$SUI DROP")
const FAKE_TICKER_PATTERN = /^\$/

// Large number + token name lure (e.g. "135 000 CAKE", "$50,000 ETH")
const LARGE_NUMBER_TOKEN_PATTERN = /\d[\d\s,.]{3,}\s*[A-Z]{2,}/

// Emoji detection (covers most common emoji ranges)
const EMOJI_PATTERN = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}✅❌⚡🔥💰🎁🎉🏆]/u

/**
 * Score an NFT collection for spam likelihood.
 * Returns a score (0–100) and the reasons that contributed.
 */
export function scoreNFTCollection(collection: SpamScoringInput): SpamResult {
  const { name, floorPrice, openSeaSlug, isSpamAlchemy } = collection
  let score = 0
  const reasons: string[] = []

  // Signal 1: Alchemy classified as spam (borderline cases that pass excludeFilter)
  if (isSpamAlchemy) {
    score += 50
    reasons.push("Alchemy spam classification")
  }

  // Signal 2: Name contains URL pattern — classic phishing
  if (URL_PATTERN.test(name)) {
    score += 60
    reasons.push("URL in collection name")
  }

  // Signal 3: Scam bait keywords
  if (SCAM_KEYWORDS.test(name)) {
    score += 40
    reasons.push("Scam keyword in name")
  }

  // Signal 4: Emoji in collection name
  if (EMOJI_PATTERN.test(name)) {
    score += 15
    reasons.push("Emoji in collection name")
  }

  // Signal 5: Zero floor price — primary spam signal
  if (floorPrice === null || floorPrice === 0) {
    score += 40
    reasons.push("No floor price (no market activity)")
  }

  // Signal 6: No OpenSea slug — no verified marketplace presence
  if (!openSeaSlug) {
    score += 15
    reasons.push("No OpenSea listing")
  }

  // Signal 7: Fake ticker prefix ($WLFIPAS1752, $SUI DROP)
  if (FAKE_TICKER_PATTERN.test(name)) {
    score += 25
    reasons.push("Fake ticker prefix ($)")
  }

  // Signal 8: Large number + token name lure (135 000 CAKE, $50,000 ETH)
  if (LARGE_NUMBER_TOKEN_PATTERN.test(name)) {
    score += 30
    reasons.push("Large number + token name lure")
  }

  // Signal 9: ALL CAPS name (> 5 chars) — common scam pattern
  if (name.length > 5 && name === name.toUpperCase() && /[A-Z]/.test(name)) {
    score += 10
    reasons.push("ALL CAPS name")
  }

  // Signal 10: Single-character or empty name
  if (name.length <= 1) {
    score += 20
    reasons.push("Single-character name")
  }

  // Cap at 100
  const finalScore = Math.min(score, 100)
  return {
    isSpam: finalScore >= SPAM_THRESHOLD,
    score: finalScore,
    reasons,
  }
}
