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

  if (since) {
    // SimpleFIN uses Unix timestamp for start-date
    url.searchParams.set("start-date", Math.floor(since.getTime() / 1000).toString())
  }

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
 * Map SimpleFIN account type from name heuristics.
 */
function inferAccountType(
  name: string
): "checking" | "savings" | "credit" | "investment" | "loan" {
  const lower = name.toLowerCase()
  if (lower.includes("credit")) return "credit"
  if (lower.includes("saving")) return "savings"
  if (lower.includes("invest") || lower.includes("brokerage")) return "investment"
  if (lower.includes("loan") || lower.includes("mortgage")) return "loan"
  return "checking"
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
  isPending: false
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
      type: inferAccountType(acct.name),
      mask: null, // SimpleFIN doesn't provide last 4 digits
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
        isPending: false,
        category: null,
        plaidCategory: null,
      })
    }
  }

  return { accounts, transactions }
}
