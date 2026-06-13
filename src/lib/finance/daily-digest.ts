/**
 * Daily "Hello Money" finance digest — a morning summary of the user's money.
 *
 * Composes three sections from real data:
 *  1. New transactions in the last ~24h (count + total spent).
 *  2. Net-worth delta vs the prior FinanceSnapshot.
 *  3. Upcoming bills/subscriptions in the next ~7 days (reuses bill-projections).
 *
 * Returns hasContent=false when nothing is noteworthy so the worker can skip
 * sending. All amounts are scoped to the given userId.
 */

import { db } from "@/lib/db"
import { type BillItem } from "./bill-helpers"
import { projectSubBill, projectPlaidBill, getCCBills } from "./bill-projections"

const TXN_LOOKBACK_MS = 24 * 60 * 60 * 1000
const TXN_DATE_FLOOR_MS = 7 * 24 * 60 * 60 * 1000
const UPCOMING_BILL_LIMIT = 5
const UPCOMING_WINDOW_DAYS = 7

type AccountMap = Map<
  string,
  { type: string; subtype: string | null; name: string; mask: string | null; institution: { institutionName: string | null } | null }
>

interface TxnSummary {
  count: number
  totalSpent: number
}

interface NetWorthDelta {
  current: number
  delta: number
}

/** Format an absolute USD amount, e.g. -1234.5 -> "$1,234.50". */
function usd(amount: number): string {
  return `$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Format a USD amount preserving its sign, e.g. -5000 -> "-$5,000.00". */
function usdSigned(amount: number): string {
  return `${amount < 0 ? "-" : ""}${usd(amount)}`
}

/** New transactions in the last ~24h: count + total spent (positive = outflow). */
async function summarizeRecentTransactions(userId: string): Promise<TxnSummary> {
  // Require BOTH recently-synced (createdAt) and recently-dated (date) so an
  // initial Plaid backfill of months-old rows can't flood the "last 24h" digest.
  // Aggregate so count/total are exact rather than capped at a findMany limit.
  const where = {
    userId,
    createdAt: { gte: new Date(Date.now() - TXN_LOOKBACK_MS) },
    date: { gte: new Date(Date.now() - TXN_DATE_FLOOR_MS) },
    isDuplicate: false,
    isExcluded: false,
    isPending: false,
  }
  const [count, spent] = await Promise.all([
    db.financeTransaction.count({ where }),
    db.financeTransaction.aggregate({ where: { ...where, amount: { gt: 0 } }, _sum: { amount: true } }),
  ])

  return { count, totalSpent: Math.round((spent._sum.amount ?? 0) * 100) / 100 }
}

/** Net-worth delta vs the prior snapshot, when at least two snapshots exist. */
async function summarizeNetWorth(userId: string): Promise<NetWorthDelta | null> {
  const snapshots = await db.financeSnapshot.findMany({
    where: { userId },
    select: { netWorth: true },
    orderBy: { date: "desc" },
    take: 2,
  })

  const [latest, prior] = snapshots
  if (!latest) return null
  if (!prior) return { current: latest.netWorth, delta: 0 }

  return {
    current: latest.netWorth,
    delta: Math.round((latest.netWorth - prior.netWorth) * 100) / 100,
  }
}

/** Build the account map used by the bill projection helpers. */
async function loadAccountMap(
  subAccountIds: Array<string | null>,
  streamAccountIds: Array<string | null>,
): Promise<AccountMap> {
  const ids = [...new Set([...subAccountIds, ...streamAccountIds].filter((id): id is string => id != null))]
  if (ids.length === 0) return new Map()

  const accounts = await db.financeAccount.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      type: true,
      subtype: true,
      name: true,
      mask: true,
      institution: { select: { institutionName: true } },
    },
  })
  return new Map(accounts.map((a) => [a.id, a]))
}

function monthInfo(d: Date): { monthStr: string; monthEnd: Date } {
  const y = d.getFullYear()
  const m = d.getMonth() // 0-based
  return {
    monthStr: `${y}-${String(m + 1).padStart(2, "0")}`,
    monthEnd: new Date(y, m + 1, 0, 23, 59, 59),
  }
}

/** Current month, plus next month when the look-ahead window crosses into it. */
function monthsToCover(now: Date, windowEnd: Date): Array<{ monthStr: string; monthEnd: Date }> {
  const months = [monthInfo(now)]
  if (windowEnd.getMonth() !== now.getMonth() || windowEnd.getFullYear() !== now.getFullYear()) {
    months.push(monthInfo(windowEnd))
  }
  return months
}

/** Upcoming unpaid bills in the next ~7 days, reusing the bill-projection logic. */
async function summarizeUpcomingBills(userId: string): Promise<BillItem[]> {
  const now = new Date()
  const windowEnd = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const months = monthsToCover(now, windowEnd)

  const [subscriptions, plaidStreams, dismissedSubs] = await Promise.all([
    db.financeSubscription.findMany({
      where: { userId, status: "active" },
      orderBy: { nextChargeDate: "asc" },
    }),
    db.financeRecurringStream.findMany({
      where: { userId, streamType: "outflow", isActive: true },
    }),
    db.financeSubscription.findMany({
      where: { userId, status: "dismissed" },
      select: { merchantName: true },
    }),
  ])

  const accountMap = await loadAccountMap(
    subscriptions.map((s) => s.accountId),
    plaidStreams.map((s) => s.accountId),
  )
  const dismissedNames = new Set(dismissedSubs.map((d) => d.merchantName.toLowerCase()))
  const materializedMerchants = new Set(subscriptions.map((s) => s.merchantName.toLowerCase()))

  // Project across the covered month(s) and dedupe — a bill due early next month
  // would otherwise be dropped when only the current month is projected.
  const byKey = new Map<string, BillItem>()
  const add = (b: BillItem) => byKey.set(`${b.merchantName}|${b.billType}|${b.daysUntil}`, b)

  for (const { monthStr, monthEnd } of months) {
    for (const s of subscriptions) {
      const bill = projectSubBill(s, accountMap, monthStr, monthEnd, now)
      if (bill) add(bill)
    }
    for (const ps of plaidStreams) {
      const name = (ps.merchantName ?? ps.description).toLowerCase()
      if (dismissedNames.has(name) || materializedMerchants.has(name)) continue
      const bill = projectPlaidBill(ps, accountMap, monthStr, monthEnd, now)
      if (bill && bill.billType !== "cc_payment") add(bill)
    }
    for (const cc of await getCCBills(userId, monthStr, now)) add(cc)
  }

  return [...byKey.values()]
    .filter((b) => !b.isPaid && b.daysUntil >= 0 && b.daysUntil <= UPCOMING_WINDOW_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, UPCOMING_BILL_LIMIT)
}

/** Compose the transaction line, or null when there is nothing to report. */
function txnLine(txns: TxnSummary): string | null {
  if (txns.count === 0) return null
  const noun = txns.count === 1 ? "transaction" : "transactions"
  if (txns.totalSpent <= 0) return `${txns.count} new ${noun} in the last 24h.`
  return `${txns.count} new ${noun}, ${usd(txns.totalSpent)} spent in the last 24h.`
}

/** Compose the net-worth line, or null when there is no movement to report. */
function netWorthLine(netWorth: NetWorthDelta | null): string | null {
  if (!netWorth || netWorth.delta === 0) return null
  const direction = netWorth.delta > 0 ? "up" : "down"
  return `Net worth ${direction} ${usd(netWorth.delta)} to ${usdSigned(netWorth.current)}.`
}

/** Compose the upcoming-bills line, or null when nothing is due soon. */
function billsLine(bills: BillItem[]): string | null {
  if (bills.length === 0) return null
  const total = bills.reduce((sum, b) => sum + b.amount, 0)
  const next = bills[0]
  const when = next.daysUntil === 0 ? "today" : next.daysUntil === 1 ? "tomorrow" : `in ${next.daysUntil} days`
  const noun = bills.length === 1 ? "bill" : "bills"
  return `${bills.length} ${noun} due this week (${usd(total)}) — ${next.merchantName} ${when}.`
}

/**
 * Build the daily money digest for a user. hasContent is false when there is
 * nothing noteworthy, signalling the worker to skip sending.
 */
export async function buildDailyDigest(
  userId: string,
): Promise<{ title: string; body: string; hasContent: boolean }> {
  const [txns, netWorth, bills] = await Promise.all([
    summarizeRecentTransactions(userId),
    summarizeNetWorth(userId),
    summarizeUpcomingBills(userId),
  ])

  const lines = [txnLine(txns), netWorthLine(netWorth), billsLine(bills)].filter(
    (line): line is string => line != null,
  )

  if (lines.length === 0) {
    return { title: "Hello Money", body: "Nothing new to report today.", hasContent: false }
  }

  return { title: "Hello Money", body: lines.join("\n"), hasContent: true }
}
