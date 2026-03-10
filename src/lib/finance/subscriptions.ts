/**
 * Subscription detection engine.
 * Groups transactions by merchant, detects recurring patterns,
 * and predicts next charge dates.
 */

import { cleanMerchantName } from "./categorize"
import { stringSimilarity } from "./normalize"

// Minimum amount to consider for subscription detection (filters auth holds & micro-charges)
const MIN_SUBSCRIPTION_AMOUNT = 3

// Merchants that frequently recur but are NOT subscriptions
export const EXCLUDED_MERCHANTS = new Set([
  // Rideshare & delivery
  "UBER", "LYFT", "DOORDASH", "GRUBHUB", "UBER EATS",
  "POSTMATES", "INSTACART",
  // P2P transfers
  "VENMO", "ZELLE", "CASH APP", "PAYPAL",
  // Coffee & fast food
  "STARBUCKS", "DUNKIN", "MCDONALD",
  // ATM
  "ATM", "WITHDRAWAL",
  // Groceries
  "COSTCO", "WALMART", "TARGET", "KROGER", "SAFEWAY", "TRADER JOE",
  "WHOLE FOODS", "ALDI", "PUBLIX", "HEB", "SPROUTS", "ALBERTSONS",
  "SAM'S CLUB", "MEIJER", "FOOD LION", "WEGMANS",
  // Gas stations
  "SHELL", "CHEVRON", "EXXON", "BP", "TEXACO",
  // Home improvement
  "HOME DEPOT", "LOWES",
  // Pharmacies
  "CVS", "WALGREENS", "RITE AID",
  // Amazon purchases (subscriptions come as separate names like "PRIME")
  "AMAZON", "AMZN",
  // Finance apps (not subscriptions)
  "EMPOWER",
])

// Transaction categories that should never be flagged as subscriptions
const EXCLUDED_CATEGORIES = new Set([
  "Transfer", "Investment", "Income",
])

interface TransactionInput {
  merchantName: string | null
  rawName: string
  amount: number
  date: string // YYYY-MM-DD
  accountId: string
  category?: string | null
}

export type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "semi_annual" | "yearly"

export interface DetectedSubscription {
  merchantName: string
  amount: number
  frequency: Frequency
  lastChargeDate: string
  nextChargeDate: string
  accountId: string
  confidence: number // 0-1
  category: string | null
}

interface ExistingSubscription {
  merchantName: string
  status: string
}

/**
 * Cluster sorted charges by amount similarity.
 * Consecutive amounts within ±15% of the cluster reference are grouped together.
 */
function clusterByAmount<T extends { amount: number }>(items: T[]): T[][] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => a.amount - b.amount)
  const clusters: T[][] = [[sorted[0]]]
  for (let i = 1; i < sorted.length; i++) {
    const lastCluster = clusters[clusters.length - 1]
    const clusterRef = lastCluster[0].amount
    const inCluster = clusterRef === 0
      ? sorted[i].amount === 0
      : Math.abs(sorted[i].amount - clusterRef) / clusterRef <= 0.15
    if (inCluster) {
      lastCluster.push(sorted[i])
    } else {
      clusters.push([sorted[i]])
    }
  }
  return clusters
}

/**
 * Analyze a cluster of charges (same merchant, similar amount) for recurring pattern.
 * Returns a DetectedSubscription if pattern is detected, null otherwise.
 */
function analyzeCluster(
  merchantName: string,
  charges: Array<{ amount: number; date: string; accountId: string; category?: string | null }>,
  existingSubscriptions: ExistingSubscription[],
): DetectedSubscription | null {
  if (charges.length < 2) return null

  // Sort by date ascending
  const sorted = [...charges].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const amounts = sorted.map((c) => c.amount)
  const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length

  // Compute intervals in days
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const daysDiff = Math.round(
      (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) /
      (1000 * 60 * 60 * 24)
    )
    intervals.push(daysDiff)
  }

  if (intervals.length === 0) return null

  const avgInterval = intervals.reduce((s, i) => s + i, 0) / intervals.length
  const frequency = classifyFrequency(avgInterval)
  if (!frequency) return null

  // For 2-charge detection: only allow longer frequencies (semi_annual, yearly)
  if (charges.length === 2 && !isLongFrequency(frequency)) return null

  let confidence: number

  if (charges.length === 2) {
    confidence = 0.65
  } else {
    const expectedDays = frequencyToDays(frequency)
    const matchingIntervals = intervals.filter(
      (i) => Math.abs(i - expectedDays) <= toleranceForFrequency(frequency)
    )
    if (matchingIntervals.length < Math.min(2, intervals.length)) return null

    confidence = matchingIntervals.length / intervals.length
    if (confidence < 0.6) return null
  }

  // Skip if this merchant was already cancelled
  const alreadyCancelled = existingSubscriptions.some(
    (es) =>
      es.status === "cancelled" &&
      stringSimilarity(es.merchantName, merchantName) > 0.8
  )
  if (alreadyCancelled) return null

  const lastCharge = sorted[sorted.length - 1]
  const lastDate = new Date(lastCharge.date)
  const nextDate = computeNextChargeDate(lastDate, frequency)

  // Most common category
  const catCounts = new Map<string, number>()
  for (const c of sorted) {
    if (c.category) catCounts.set(c.category, (catCounts.get(c.category) ?? 0) + 1)
  }
  const topCategory = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    merchantName,
    amount: Math.round(avgAmount * 100) / 100,
    frequency,
    lastChargeDate: lastCharge.date,
    nextChargeDate: nextDate.toISOString().split("T")[0],
    accountId: lastCharge.accountId,
    confidence,
    category: topCategory,
  }
}

/**
 * Detect recurring subscriptions from transaction history.
 * Uses amount clustering to detect multiple tiers from the same merchant
 * (e.g., monthly $9.99 AND yearly $28.99 from Telegram).
 */
export function detectSubscriptions(
  transactions: TransactionInput[],
  existingSubscriptions: ExistingSubscription[] = []
): DetectedSubscription[] {
  // Group by cleaned merchant name
  const groups = new Map<string, Array<{ amount: number; date: string; accountId: string; category?: string | null }>>()

  for (const tx of transactions) {
    if (tx.amount < MIN_SUBSCRIPTION_AMOUNT) continue
    if (tx.category && EXCLUDED_CATEGORIES.has(tx.category)) continue

    const cleaned = cleanMerchantName(tx.merchantName || tx.rawName)
    if (!cleaned) continue

    const upperCleaned = cleaned.toUpperCase()
    if ([...EXCLUDED_MERCHANTS].some((m) => upperCleaned.includes(m))) continue

    let groupKey: string | null = null
    for (const key of groups.keys()) {
      if (stringSimilarity(key, cleaned) > 0.8) {
        groupKey = key
        break
      }
    }

    if (!groupKey) groupKey = cleaned

    const group = groups.get(groupKey) ?? []
    group.push({ amount: tx.amount, date: tx.date, accountId: tx.accountId, category: tx.category })
    groups.set(groupKey, group)
  }

  const detected: DetectedSubscription[] = []

  for (const [merchantName, charges] of groups) {
    if (charges.length < 2) continue

    // Cluster charges by amount similarity to detect multi-tier subscriptions
    const clusters = clusterByAmount(charges)

    for (const cluster of clusters) {
      const result = analyzeCluster(merchantName, cluster, existingSubscriptions)
      if (result) detected.push(result)
    }
  }

  return detected.sort((a, b) => b.amount - a.amount)
}

/**
 * Compute frequency from a list of transaction dates.
 * Used to override Plaid's frequency label with our own interval analysis.
 */
export function computeFrequencyFromDates(dates: Date[]): Frequency | null {
  if (dates.length < 2) return null
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24)))
  }
  const avgInterval = intervals.reduce((s, i) => s + i, 0) / intervals.length
  return classifyFrequency(avgInterval)
}

/**
 * Classify average interval (in days) to a billing frequency.
 * Bands are contiguous with no gaps from 3-450 days.
 */
export function classifyFrequency(avgDays: number): Frequency | null {
  if (avgDays >= 3 && avgDays <= 10) return "weekly"
  if (avgDays >= 11 && avgDays <= 21) return "biweekly"
  if (avgDays >= 22 && avgDays <= 45) return "monthly"
  if (avgDays >= 46 && avgDays <= 135) return "quarterly"
  if (avgDays >= 136 && avgDays <= 230) return "semi_annual"
  if (avgDays >= 231 && avgDays <= 450) return "yearly"
  return null
}

export function frequencyToDays(frequency: Frequency): number {
  switch (frequency) {
    case "weekly": return 7
    case "biweekly": return 14
    case "monthly": return 30
    case "quarterly": return 91
    case "semi_annual": return 182
    case "yearly": return 365
  }
}

export function toleranceForFrequency(frequency: Frequency): number {
  switch (frequency) {
    case "weekly": return 2
    case "biweekly": return 3
    case "monthly": return 5
    case "quarterly": return 10
    case "semi_annual": return 20
    case "yearly": return 20
  }
}

function isLongFrequency(frequency: Frequency): boolean {
  return frequency === "semi_annual" || frequency === "yearly"
}

export function computeNextChargeDate(lastDate: Date, frequency: Frequency): Date {
  const nextDate = new Date(lastDate)
  switch (frequency) {
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
    case "quarterly":
      nextDate.setMonth(nextDate.getMonth() + 3)
      break
    case "semi_annual":
      nextDate.setMonth(nextDate.getMonth() + 6)
      break
    case "yearly":
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      break
    default: // weekly, biweekly
      nextDate.setDate(nextDate.getDate() + frequencyToDays(frequency))
  }
  return nextDate
}
