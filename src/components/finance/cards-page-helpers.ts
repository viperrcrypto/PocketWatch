/**
 * Helper functions for the credit cards gallery page.
 * Extracted to keep the page file under 400 lines.
 */

/** Rewards program names that Plaid sometimes returns as card names */
const REWARDS_PROGRAM_NAMES = [
  "ultimate rewards",
  "membership rewards",
  "thankyou points",
  "thank you points",
  "cashback rewards",
  "cash back rewards",
  "venture rewards",
  "miles rewards",
]

/** Detect stored card names that are actually cardholder names or rewards programs */
export function looksLikePersonName(name: string): boolean {
  if (name.length > 25 && !isRewardsProgramName(name)) return false
  // Rewards program names (e.g. "Ultimate Rewards®")
  if (isRewardsProgramName(name)) return true
  // Matches patterns like "Z. KAL", "J SMITH", "CF FROST", "JOHN DOE"
  if (/^[A-Z]{1,3}[.\s]/.test(name)) return true
  // Matches "FIRSTNAME LASTNAME" (all caps, 2-3 words, no card-related keywords)
  const cardKeywords = /card|cash|reward|freedom|sapphire|platinum|gold|venture|discover|preferred|everyday|business|unlimited|flex/i
  if (/^[A-Z]+\s[A-Z]+$/.test(name) && !cardKeywords.test(name)) return true
  return false
}

/** Check if a name is a rewards program name rather than a card product */
function isRewardsProgramName(name: string): boolean {
  const cleaned = name.replace(/[®™©]/g, "").trim().toLowerCase()
  return REWARDS_PROGRAM_NAMES.some((rp) => cleaned === rp || cleaned.startsWith(rp))
}

/** Derive a display-friendly card name from Plaid account data */
export function deriveCardName(acct: {
  name: string
  officialName?: string | null
  mask?: string | null
  institutionName: string
}): string {
  const fallback = `${acct.institutionName} Card${acct.mask ? ` ••••${acct.mask}` : ""}`

  // Check officialName first, but still filter out personal names
  if (acct.officialName) {
    const official = acct.officialName.trim()
    if (/^credit\s*card$/i.test(official) || looksLikePersonName(official)) return fallback
    return official
  }

  const name = acct.name.trim()
  if (/^credit\s*card$/i.test(name) || looksLikePersonName(name)) return fallback
  return name
}
