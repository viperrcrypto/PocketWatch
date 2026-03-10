/**
 * Classifies recurring charges into bill types for dashboard separation.
 * Subscriptions vs CC annual fees vs insurance vs memberships vs generic bills.
 */

export type BillType = "subscription" | "cc_annual_fee" | "insurance" | "membership" | "bill"

/** Known subscription service names (partial match) */
const SUBSCRIPTION_SERVICES = [
  "NETFLIX", "HULU", "DISNEY", "HBO", "SPOTIFY", "APPLE MUSIC", "YOUTUBE",
  "PARAMOUNT", "PEACOCK", "CRUNCHYROLL", "AMAZON PRIME", "PRIME VIDEO",
  "CHATGPT", "OPENAI", "GITHUB", "NOTION", "SLACK", "ZOOM", "DROPBOX",
  "GOOGLE STORAGE", "ICLOUD", "ADOBE", "MICROSOFT 365", "OFFICE 365",
  "NORD VPN", "NORDVPN", "EXPRESS VPN", "EXPRESSVPN", "1PASSWORD",
  "LASTPASS", "BITWARDEN", "GRAMMARLY", "CANVA", "FIGMA",
  "CURSOR", "COPILOT", "CLAUDE", "ANTHROPIC",
  "AUDIBLE", "KINDLE UNLIMITED", "SCRIBD",
  "PELOTON", "STRAVA", "FITBIT PREMIUM", "HEADSPACE", "CALM",
  "XBOX", "PLAYSTATION", "NINTENDO", "STEAM", "EPIC GAMES",
  "TIDAL", "DEEZER", "PANDORA", "SIRIUS",
  "RING", "NEST", "ADT",
  "TELEGRAM", "DISCORD", "X CORP", "SIRIUS XM", "SIRIUSXM",
] as const

/** CC annual fee patterns */
const CC_ANNUAL_FEE_PATTERNS = [
  "ANNUAL MEMBERSHIP FEE",
  "ANNUAL FEE",
  "CARD MEMBER FEE",
  "CARDMEMBER FEE",
  "AF CHARGE",
  "ANNUAL CARD FEE",
] as const

/** Insurance patterns (merchant names) */
const INSURANCE_MERCHANTS = [
  "GEICO", "STATE FARM", "PROGRESSIVE", "ALLSTATE", "FARMERS",
  "LIBERTY MUTUAL", "NATIONWIDE", "USAA",
  "AFLAC", "CIGNA", "AETNA", "HUMANA", "UNITED HEALTH",
  "BLUE CROSS", "BLUE SHIELD", "KAISER",
  "METLIFE", "PRUDENTIAL", "NEW YORK LIFE",
  "AMERICAN INCOME LIFE", "INCOME LIFE",
  "FLEX COMPENSATIO", "FLEX COMPENSATION", // COBRA
  "NAVIA BENEFIT", // Benefits administration (FSA/HSA)
] as const

/** Insurance keyword patterns (partial match) */
const INSURANCE_KEYWORDS = [
  "INSURANCE", "COBRA",
] as const

/** Membership patterns (not CC annual fees) */
const MEMBERSHIP_PATTERNS = [
  "AAA", "COSTCO MEMBER", "SAM'S CLUB MEMBER",
  "YMCA", "YWCA",
  "RENEWAL MEMBERSHIP FEE",
] as const

/** Categories that indicate subscriptions */
const SUBSCRIPTION_CATEGORIES = new Set([
  "Entertainment", "Business Expenses",
])

export interface ClassifyInput {
  merchantName: string
  frequency: string
  category: string | null
  amount: number
  accountType: string | null
  accountSubtype: string | null
}

/**
 * Classify a recurring charge into a bill type.
 * Returns a classification reason string for diagnostics.
 */
export function classifyBillType(input: ClassifyInput): { billType: BillType; reason: string } {
  const upper = input.merchantName.toUpperCase()

  // 1. CC Annual Fee — check first (most specific pattern)
  for (const pattern of CC_ANNUAL_FEE_PATTERNS) {
    if (upper.includes(pattern)) {
      return { billType: "cc_annual_fee", reason: `Matched CC fee pattern: "${pattern}"` }
    }
  }

  // 2. Insurance — known merchants
  for (const merchant of INSURANCE_MERCHANTS) {
    if (upper.includes(merchant)) {
      return { billType: "insurance", reason: `Matched insurance merchant: "${merchant}"` }
    }
  }

  // 2b. Insurance — keyword patterns
  for (const keyword of INSURANCE_KEYWORDS) {
    if (upper.includes(keyword)) {
      return { billType: "insurance", reason: `Matched insurance keyword: "${keyword}"` }
    }
  }

  // 3. Membership — check before subscription (some memberships are monthly)
  for (const pattern of MEMBERSHIP_PATTERNS) {
    if (upper.includes(pattern)) {
      return { billType: "membership", reason: `Matched membership pattern: "${pattern}"` }
    }
  }

  // 4. Subscription — known services OR subscription-like category + frequent billing
  const isFrequentBilling = ["weekly", "biweekly", "monthly"].includes(input.frequency)

  for (const service of SUBSCRIPTION_SERVICES) {
    if (upper.includes(service)) {
      return { billType: "subscription", reason: `Matched known subscription: "${service}"` }
    }
  }

  if (isFrequentBilling && input.category && SUBSCRIPTION_CATEGORIES.has(input.category)) {
    return { billType: "subscription", reason: `Category "${input.category}" + ${input.frequency} frequency` }
  }

  // 5. Bill — everything else
  return { billType: "bill", reason: "Default classification (no specific pattern matched)" }
}

/**
 * Check if a merchant name is generic and should be enriched with account info.
 */
export function isGenericMerchantName(merchantName: string): boolean {
  const upper = merchantName.toUpperCase()
  return CC_ANNUAL_FEE_PATTERNS.some((p) => upper.includes(p))
    || upper === "MEMBERSHIP FEE"
    || upper === "ANNUAL FEE"
    || /^(CARD|CREDIT CARD)\s+(FEE|PAYMENT)$/i.test(merchantName)
}

/**
 * Enrich a generic merchant name with account info.
 * e.g., "ANNUAL MEMBERSHIP FEE" + Chase ••••8402 → "Chase ••••8402 Annual Fee"
 */
export function enrichMerchantName(
  merchantName: string,
  institutionName: string | null,
  accountMask: string | null,
): string {
  if (!isGenericMerchantName(merchantName)) return merchantName
  if (!institutionName && !accountMask) return merchantName

  const cardLabel = institutionName && accountMask
    ? `${institutionName} ••••${accountMask}`
    : institutionName ?? `Card ••••${accountMask}`

  return `${cardLabel} Annual Fee`
}
