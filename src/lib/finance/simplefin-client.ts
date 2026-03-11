/**
 * SimpleFIN Bridge client for bank account connections.
 * Flow: Setup Token → claim → Access URL → poll accounts + transactions.
 */

export interface SimpleFINOrg {
  name: string
  url: string | null
}

export interface SimpleFINTransaction {
  id: string
  posted: number // Unix timestamp
  amount: string // decimal string
  description: string
  payee?: string
  memo?: string
  pending?: boolean
}

export interface SimpleFINAccount {
  id: string
  org: SimpleFINOrg
  name: string
  currency: string
  balance: string // decimal string
  available?: string
  "balance-date": number // Unix timestamp
  transactions: SimpleFINTransaction[]
}

export interface SimpleFINResponse {
  errors: string[]
  accounts: SimpleFINAccount[]
}

/**
 * Claim a setup token to get an Access URL.
 * Setup tokens are base64-encoded URLs provided by the user from simplefin.org.
 */
export async function claimSetupToken(setupToken: string): Promise<string> {
  // Decode the base64 setup token to get the claim URL
  const claimUrl = atob(setupToken.trim())

  // SSRF protection: only allow SimpleFIN Bridge domains
  let parsed: URL
  try {
    parsed = new URL(claimUrl)
  } catch {
    throw new Error("Invalid SimpleFIN setup token: not a valid URL")
  }
  if (!parsed.hostname.endsWith(".simplefin.org") && parsed.hostname !== "simplefin.org") {
    throw new Error("Invalid SimpleFIN setup token: unexpected domain")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Invalid SimpleFIN setup token: must be HTTPS")
  }

  const response = await fetch(claimUrl, {
    method: "POST",
    headers: { "Content-Length": "0" },
  })

  if (!response.ok) {
    throw new Error(`SimpleFIN claim failed: ${response.status} ${response.statusText}`)
  }

  // Response body is the Access URL
  const accessUrl = await response.text()

  if (!accessUrl.startsWith("https://")) {
    throw new Error("Invalid access URL received from SimpleFIN")
  }

  return accessUrl
}

/**
 * Parse a SimpleFIN access URL into a clean base URL + Authorization header.
 * Prevents credentials from leaking into logs/stack traces via URL strings.
 *
 * Access URL format: https://user:pass@bridge.simplefin.org/simplefin
 */
function parseAccessUrl(accessUrl: string): { baseUrl: string; authHeader: string } {
  const parsed = new URL(accessUrl)
  const username = decodeURIComponent(parsed.username)
  const password = decodeURIComponent(parsed.password)

  if (!username || !password) {
    throw new Error("SimpleFIN access URL missing credentials")
  }

  // Build clean URL without credentials
  parsed.username = ""
  parsed.password = ""
  const baseUrl = parsed.toString().replace(/\/$/, "")

  // Build Basic auth header
  const authHeader = `Basic ${btoa(`${username}:${password}`)}`

  return { baseUrl, authHeader }
}

/**
 * Fetch accounts and transactions from SimpleFIN.
 * Credentials are extracted from the URL and sent via Authorization header
 * to prevent leakage in logs or stack traces.
 */
export async function getAccountsAndTransactions(
  accessUrl: string,
  since?: Date
): Promise<SimpleFINResponse> {
  const { baseUrl, authHeader } = parseAccessUrl(accessUrl)
  const url = new URL(`${baseUrl}/accounts`)

  // Always request 90-day window (SimpleFIN max) regardless of lastSyncedAt.
  // Using lastSyncedAt as start-date caused 0 transactions when first sync
  // returned none — lastSyncedAt was set anyway, and all future syncs
  // only looked forward from that empty point.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const startDate = since && since < ninetyDaysAgo ? ninetyDaysAgo : (since ?? ninetyDaysAgo)
  url.searchParams.set("start-date", Math.floor(startDate.getTime() / 1000).toString())

  // Include pending transactions (excluded by default)
  url.searchParams.set("pending", "1")

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: authHeader,
    },
  })

  if (!response.ok) {
    throw new Error(`SimpleFIN fetch failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as SimpleFINResponse
  return data
}

/**
 * Known credit-card-only issuers.
 * If institution matches, accounts default to "credit" unless name
 * contains a non-card keyword (savings, checking, deposit, bank, 360).
 */
const CREDIT_CARD_ISSUERS = [
  "american express", "amex", "discover", "discover financial", "capital one",
] as const

const NON_CARD_KEYWORDS = ["saving", "checking", "deposit", "bank", "360"] as const

const CARD_KEYWORDS = [
  "card", "platinum", "gold", "signature", "rewards", "cashback", "cash back",
  "visa", "mastercard", "sapphire", "freedom", "venture", "quicksilver",
  "everyday", "preferred", "reserve", "ink", "world elite",
] as const

/**
 * Map SimpleFIN account type using three-layer inference:
 *   1. Institution name (known CC issuers)
 *   2. Account name keywords (2+ card keywords → credit)
 *   3. Balance sign tiebreaker (1 keyword + negative balance → credit)
 */
function inferAccountType(
  name: string,
  institutionName: string,
  balance: number,
): "checking" | "savings" | "credit" | "investment" | "loan" {
  const lower = name.toLowerCase()
  const instLower = institutionName.toLowerCase()

  // Priority checks — these keywords are unambiguous
  if (lower.includes("saving")) return "savings"
  if (lower.includes("invest") || lower.includes("brokerage")) return "investment"
  if (lower.includes("loan") || lower.includes("mortgage")) return "loan"
  if (lower.includes("credit")) return "credit"

  // Layer 1: Known credit-card issuers
  const isCardIssuer = CREDIT_CARD_ISSUERS.some((issuer) => instLower.includes(issuer))
  const hasNonCardKeyword = NON_CARD_KEYWORDS.some((kw) => lower.includes(kw))
  if (isCardIssuer && !hasNonCardKeyword) return "credit"

  // Layer 2: Count card-product keywords in account name
  const matchCount = CARD_KEYWORDS.reduce(
    (count, kw) => count + (lower.includes(kw) ? 1 : 0),
    0,
  )
  if (matchCount >= 2) return "credit"

  // Layer 3: Single keyword + negative balance → likely credit card
  if (matchCount === 1 && balance < 0) return "credit"

  return "checking"
}

/**
 * Extract last-4 mask from account names like "Blue Cash Everyday® (2006)".
 */
function extractMask(name: string): string | null {
  const match = name.match(/\((\d{4})\)\s*$/)
  return match ? match[1] : null
}

/**
 * Normalize SimpleFIN data to our common format.
 */
export interface NormalizedSimpleFINAccount {
  externalId: string
  provider: "simplefin"
  institutionName: string
  accountName: string
  type: string
  mask: string | null
  currentBalance: number
  availableBalance: number | null
  creditLimit: number | null
  currency: string
}

export interface NormalizedSimpleFINTransaction {
  externalId: string
  provider: "simplefin"
  accountExternalId: string
  date: string // YYYY-MM-DD
  merchantName: string
  rawName: string
  amount: number // positive = outflow, negative = inflow
  isPending: boolean
  category: null
  plaidCategory: null
}

export function normalizeSimpleFINData(raw: SimpleFINResponse): {
  accounts: NormalizedSimpleFINAccount[]
  transactions: NormalizedSimpleFINTransaction[]
} {
  const accounts: NormalizedSimpleFINAccount[] = []
  const transactions: NormalizedSimpleFINTransaction[] = []

  for (const acct of raw.accounts) {
    const balance = parseFloat(acct.balance)
    const available = acct.available ? parseFloat(acct.available) : null

    accounts.push({
      externalId: acct.id,
      provider: "simplefin",
      institutionName: acct.org.name,
      accountName: acct.name,
      type: inferAccountType(acct.name, acct.org.name, balance),
      mask: extractMask(acct.name),
      currentBalance: balance,
      availableBalance: available,
      creditLimit: null,
      currency: acct.currency || "USD",
    })

    for (const tx of acct.transactions) {
      const amount = parseFloat(tx.amount)
      const date = new Date(tx.posted * 1000)
      const dateStr = date.toISOString().split("T")[0]

      transactions.push({
        externalId: tx.id,
        provider: "simplefin",
        accountExternalId: acct.id,
        date: dateStr,
        merchantName: tx.payee || tx.description,
        rawName: tx.description,
        // SimpleFIN: negative = outflow, positive = inflow
        // Our convention: positive = outflow, negative = inflow
        amount: -amount,
        isPending: tx.pending === true,
        category: null,
        plaidCategory: null,
      })
    }
  }

  return { accounts, transactions }
}
