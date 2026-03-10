/**
 * Data normalizer + deduplication for dual-provider (Plaid + SimpleFIN) bank data.
 * Merges accounts by institution + mask + type.
 * Deduplicates transactions by date + amount + merchant similarity.
 */

export interface NormalizedAccount {
  externalId: string
  provider: "plaid" | "simplefin"
  institutionName: string
  accountName: string
  type: string
  mask: string | null
  currentBalance: number
  availableBalance: number | null
  creditLimit: number | null
  currency: string
}

export interface NormalizedTransaction {
  externalId: string
  provider: "plaid" | "simplefin"
  accountExternalId: string
  date: string
  merchantName: string
  rawName: string
  amount: number
  isPending: boolean
  category: string | null
  plaidCategory: string | null
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[])

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }

  return dp[m][n]
}

/**
 * String similarity (0-1) based on normalized Levenshtein distance.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / maxLen
}

/**
 * Check if two institution names refer to the same bank (fuzzy).
 */
function institutionsMatch(a: string, b: string): boolean {
  return stringSimilarity(a, b) > 0.7
}

export interface DeduplicatedAccount {
  primary: NormalizedAccount
  linked: NormalizedAccount | null
}

/**
 * Deduplicate accounts from both providers.
 * Plaid is primary when both match.
 */
export function deduplicateAccounts(
  accounts: NormalizedAccount[]
): DeduplicatedAccount[] {
  const plaidAccounts = accounts.filter((a) => a.provider === "plaid")
  const simplefinAccounts = accounts.filter((a) => a.provider === "simplefin")
  const matchedSimplefin = new Set<string>()
  const result: DeduplicatedAccount[] = []

  for (const plaid of plaidAccounts) {
    const match = simplefinAccounts.find(
      (sf) =>
        !matchedSimplefin.has(sf.externalId) &&
        institutionsMatch(plaid.institutionName, sf.institutionName) &&
        plaid.type === sf.type &&
        (plaid.mask === sf.mask || !plaid.mask || !sf.mask)
    )

    if (match) {
      matchedSimplefin.add(match.externalId)
      result.push({ primary: plaid, linked: match })
    } else {
      result.push({ primary: plaid, linked: null })
    }
  }

  // Add unmatched SimpleFIN accounts
  for (const sf of simplefinAccounts) {
    if (!matchedSimplefin.has(sf.externalId)) {
      result.push({ primary: sf, linked: null })
    }
  }

  return result
}

export interface DeduplicatedTransaction {
  transaction: NormalizedTransaction
  isDuplicate: boolean
}

/**
 * Deduplicate transactions for a single account (both providers).
 * When both have the same transaction, Plaid's version wins.
 */
export function deduplicateTransactions(
  transactions: NormalizedTransaction[]
): DeduplicatedTransaction[] {
  const plaidTxs = transactions.filter((t) => t.provider === "plaid")
  const simplefinTxs = transactions.filter((t) => t.provider === "simplefin")
  const result: DeduplicatedTransaction[] = []
  const duplicatedSimplefin = new Set<string>()

  // All Plaid transactions are kept
  for (const ptx of plaidTxs) {
    result.push({ transaction: ptx, isDuplicate: false })
  }

  // Check each SimpleFIN transaction against Plaid
  for (const stx of simplefinTxs) {
    const isDupe = plaidTxs.some(
      (ptx) =>
        ptx.date === stx.date &&
        Math.abs(Math.abs(ptx.amount) - Math.abs(stx.amount)) < 0.01 &&
        stringSimilarity(ptx.merchantName, stx.merchantName) > 0.7
    )

    if (isDupe) {
      duplicatedSimplefin.add(stx.externalId)
      result.push({ transaction: stx, isDuplicate: true })
    } else {
      result.push({ transaction: stx, isDuplicate: false })
    }
  }

  return result
}
