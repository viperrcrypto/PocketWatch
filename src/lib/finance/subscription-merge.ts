/**
 * Merges FinanceSubscription (detected) + FinanceRecurringStream (provider outflows)
 * into a single unified subscription list, deduplicating by merchant name + amount.
 */

import { stringSimilarity } from "./normalize"
import { computeFrequencyFromDates } from "./subscriptions"

export interface UnifiedSubscription {
  id: string
  source: "detected" | "plaid" | "merged"
  detectionMethod: "auto" | "verified" | "manual"
  merchantName: string
  nickname: string | null
  amount: number
  averageAmount: number | null
  frequency: string
  category: string | null
  accountId: string | null
  lastChargeDate: string | null
  nextChargeDate: string | null
  status: string
  isWanted: boolean
  notes: string | null
  logoUrl: string | null
  plaidStreamId: string | null
  isActive: boolean
  billType: string | null
}

interface DetectedSub {
  id: string
  merchantName: string
  nickname: string | null
  amount: number
  frequency: string
  category: string | null
  accountId: string | null
  lastChargeDate: Date | string | null
  nextChargeDate: Date | string | null
  status: string
  isWanted: boolean
  notes: string | null
  billType: string | null
}

interface PlaidStream {
  streamId: string
  accountId: string | null
  merchantName: string | null
  description: string
  frequency: string
  averageAmount: number | null
  lastAmount: number | null
  lastDate: Date | string | null
  isActive: boolean
  status: string
  streamType: string
  category?: string | null
  transactionIds?: string[]
}

/** Map of Plaid transaction ID → transaction date */
export type TransactionDateMap = Map<string, Date>

const PLAID_FREQUENCY_MAP: Record<string, string> = {
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  SEMI_MONTHLY: "biweekly",
  MONTHLY: "monthly",
  ANNUALLY: "yearly",
}

function toDateStr(d: Date | string | null): string | null {
  if (!d) return null
  if (typeof d === "string") return d.split("T")[0]
  return d.toISOString().split("T")[0]
}

export function normalizeFrequency(plaidFreq: string): string {
  return PLAID_FREQUENCY_MAP[plaidFreq] ?? plaidFreq.toLowerCase()
}

/**
 * Compute corrected frequency for a Plaid stream using actual transaction dates.
 */
function computePlaidStreamFrequency(
  stream: PlaidStream,
  transactionDateMap?: TransactionDateMap,
): string {
  if (transactionDateMap && stream.transactionIds && stream.transactionIds.length >= 2) {
    const dates: Date[] = []
    for (const txId of stream.transactionIds) {
      const d = transactionDateMap.get(txId)
      if (d) dates.push(d)
    }
    const computed = computeFrequencyFromDates(dates)
    if (computed) return computed
  }
  return normalizeFrequency(stream.frequency)
}

/**
 * Merge detected subscriptions with provider recurring outflows.
 * Match criteria: merchant name similarity > 0.75 AND amount within 30%.
 * Our detected frequency takes priority over the provider's.
 * When transactionDateMap is provided, Plaid-only streams get frequency
 * computed from actual transaction intervals instead of Plaid's label.
 */
export function mergeSubscriptions(
  detected: DetectedSub[],
  plaidStreams: PlaidStream[],
  transactionDateMap?: TransactionDateMap,
): UnifiedSubscription[] {
  const outflows = plaidStreams.filter((s) => s.streamType === "outflow")
  const matchedPlaidIds = new Set<string>()
  const result: UnifiedSubscription[] = []

  for (const sub of detected) {
    const match = outflows.find((ps) => {
      if (matchedPlaidIds.has(ps.streamId)) return false
      const name = ps.merchantName ?? ps.description
      const nameSim = stringSimilarity(sub.merchantName, name)
      if (nameSim < 0.75) return false
      const plaidAmt = ps.lastAmount ?? ps.averageAmount ?? 0
      if (plaidAmt === 0) return nameSim >= 0.75
      const ratio = Math.abs(sub.amount - plaidAmt) / Math.max(sub.amount, plaidAmt)
      return ratio <= 0.3
    })

    if (match) {
      matchedPlaidIds.add(match.streamId)
      result.push({
        id: sub.id,
        source: "merged",
        detectionMethod: "verified",
        merchantName: sub.merchantName,
        nickname: sub.nickname,
        amount: match.lastAmount ?? sub.amount,
        averageAmount: match.averageAmount,
        // Prefer OUR detected frequency — we analyze actual transaction intervals
        frequency: sub.frequency,
        category: sub.category,
        accountId: sub.accountId ?? match.accountId,
        lastChargeDate: toDateStr(match.lastDate) ?? toDateStr(sub.lastChargeDate),
        nextChargeDate: toDateStr(sub.nextChargeDate),
        status: sub.status,
        isWanted: sub.isWanted,
        notes: sub.notes,
        logoUrl: null,
        plaidStreamId: match.streamId,
        isActive: match.isActive,
        billType: sub.billType,
      })
    } else {
      result.push({
        id: sub.id,
        source: "detected",
        detectionMethod: "auto",
        merchantName: sub.merchantName,
        nickname: sub.nickname,
        amount: sub.amount,
        averageAmount: null,
        frequency: sub.frequency,
        category: sub.category,
        accountId: sub.accountId,
        lastChargeDate: toDateStr(sub.lastChargeDate),
        nextChargeDate: toDateStr(sub.nextChargeDate),
        status: sub.status,
        isWanted: sub.isWanted,
        notes: sub.notes,
        logoUrl: null,
        plaidStreamId: null,
        isActive: sub.status === "active",
        billType: sub.billType,
      })
    }
  }

  // Add unmatched provider outflows as virtual subscriptions
  for (const ps of outflows) {
    if (matchedPlaidIds.has(ps.streamId)) continue
    const rawName = (ps.merchantName && ps.merchantName.trim()) || ps.description
    // Filter out gibberish (Plaid tokens, base64 strings)
    const isGibberish = rawName.length > 20 && !/\s/.test(rawName)
    const name = isGibberish ? (ps.category ?? "Unknown Subscription") : rawName
    result.push({
      id: `plaid:${ps.streamId}`,
      source: "plaid",
      detectionMethod: "auto",
      merchantName: name,
      nickname: null,
      amount: ps.lastAmount ?? ps.averageAmount ?? 0,
      averageAmount: ps.averageAmount,
      frequency: computePlaidStreamFrequency(ps, transactionDateMap),
      category: ps.category ?? null,
      accountId: ps.accountId,
      lastChargeDate: toDateStr(ps.lastDate),
      nextChargeDate: null,
      status: "active",
      isWanted: true,
      notes: null,
      logoUrl: null,
      plaidStreamId: ps.streamId,
      isActive: ps.isActive,
      billType: null, // classified later during enrichment
    })
  }

  return result
}
