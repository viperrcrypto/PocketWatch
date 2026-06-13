/**
 * Trip expense auto-tagging.
 *
 * Assigns FinanceTransactions to a Trip when their date falls inside the trip's
 * date window. Trip.startDate / endDate are ISO yyyy-mm-dd strings; the
 * FinanceTransaction.date column is @db.Date (midnight UTC), so we compare with
 * UTC Date objects spanning the full start day .. full end day (inclusive).
 *
 * Every query is scoped by userId, and tagging never steals rows already tagged
 * to another trip (tripId: null guard).
 */

import { db } from "@/lib/db"

const DEFAULT_TRIP_DAYS = 14
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 24 * 60 * 60 * 1000

// Categories that are never trip-relevant spend (account transfers, paychecks,
// investment buys/dividends, crypto moves). Matches the app-wide "real spend"
// convention used by insights / spending-by-month / trends / budgets, so a
// dividend or a transfer during travel dates never counts as trip spend.
const NON_TRIP_SPEND_CATEGORIES: string[] = ["Transfer", "Income", "Investment", "Crypto"]

export interface TripDateWindow {
  gte: Date
  lte: Date
}

export interface TripSpendSummary {
  count: number
  total: number
  byCategory: ReadonlyArray<{ category: string; total: number; count: number }>
}

export interface TripTaggedTransaction {
  id: string
  date: string
  name: string
  merchantName: string | null
  amount: number
  category: string | null
}

/**
 * Build the inclusive [gte, lte] UTC window for a trip.
 * - gte = startDate at 00:00:00.000 UTC
 * - lte = (endDate ?? startDate + 14d) at 23:59:59.999 UTC
 */
export function tripDateWindow(startDate: string, endDate?: string | null): TripDateWindow {
  if (!ISO_DATE.test(startDate)) {
    throw new Error(`Invalid trip startDate: ${startDate}`)
  }

  const gte = new Date(`${startDate}T00:00:00.000Z`)

  let endIso = endDate ?? null
  if (endIso && !ISO_DATE.test(endIso)) endIso = null

  const endDayStart = endIso
    ? new Date(`${endIso}T00:00:00.000Z`)
    : new Date(gte.getTime() + DEFAULT_TRIP_DAYS * MS_PER_DAY)

  // Extend to the very end of the end day so @db.Date rows on that day match.
  const lte = new Date(endDayStart.getTime() + MS_PER_DAY - 1)

  return { gte, lte }
}

async function loadTrip(userId: string, tripId: string) {
  return db.trip.findFirst({
    where: { id: tripId, userId },
    select: { id: true, startDate: true, endDate: true },
  })
}

/**
 * Tag every still-untagged transaction inside the trip window to this trip.
 * Returns the number of transactions newly tagged.
 */
export async function tagTripExpenses(userId: string, tripId: string): Promise<{ tagged: number }> {
  const trip = await loadTrip(userId, tripId)
  if (!trip) throw new Error("Trip not found")

  const { gte, lte } = tripDateWindow(trip.startDate, trip.endDate)

  const { count } = await db.financeTransaction.updateMany({
    where: {
      userId,
      tripId: null,
      // Never re-tag a transaction the user explicitly removed from this trip.
      tripExcluded: false,
      // Only real spend — never transfers, income, investments, or crypto moves.
      category: { notIn: NON_TRIP_SPEND_CATEGORIES },
      date: { gte, lte },
    },
    data: { tripId },
  })

  return { tagged: count }
}

/**
 * Remove the trip tag from all of this trip's transactions.
 * Returns the number of transactions untagged.
 */
export async function untagTrip(userId: string, tripId: string): Promise<{ untagged: number }> {
  const trip = await loadTrip(userId, tripId)
  if (!trip) throw new Error("Trip not found")

  const { count } = await db.financeTransaction.updateMany({
    where: { userId, tripId },
    data: { tripId: null },
  })

  return { untagged: count }
}

/**
 * Spend summary for a trip: total, count, and per-category breakdown.
 * Excludes excluded/duplicate rows; sums positive (outflow) amounts.
 */
export async function tripSpendSummary(userId: string, tripId: string): Promise<TripSpendSummary> {
  // No existence check needed: the aggregate is scoped by userId+tripId, so a
  // missing/foreign trip yields a zero summary. Callers that need a 404 (the trip
  // GET route) verify the trip themselves before calling this.
  const where = {
    userId,
    tripId,
    isExcluded: false,
    isDuplicate: false,
    isPending: false,
    // Exclude transfers/income/investments/crypto so a dividend or transfer that
    // was tagged before this filter existed drops out of the total immediately.
    category: { notIn: NON_TRIP_SPEND_CATEGORIES },
    // Outflows only — a paycheck/refund tagged inside the window must not
    // subtract from trip spend (matches the codebase's spend convention).
    amount: { gt: 0 },
  } as const

  const [totals, grouped] = await Promise.all([
    db.financeTransaction.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.financeTransaction.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])

  const byCategory = grouped
    .map((row) => ({
      category: row.category ?? "Uncategorized",
      total: row._sum.amount ?? 0,
      count: row._count._all,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    count: totals._count._all,
    total: totals._sum.amount ?? 0,
    byCategory,
  }
}

/**
 * The individual outflow transactions tagged to a trip (the rows behind
 * tripSpendSummary's total) so the UI can show the breakdown and let the user
 * untag a mis-allocated charge. Same filters as the summary; newest first.
 */
export async function tripTaggedTransactions(
  userId: string,
  tripId: string,
): Promise<TripTaggedTransaction[]> {
  // Scoped by userId+tripId — a missing/foreign trip simply returns no rows.
  const rows = await db.financeTransaction.findMany({
    where: {
      userId,
      tripId,
      isExcluded: false,
      isDuplicate: false,
      isPending: false,
      category: { notIn: NON_TRIP_SPEND_CATEGORIES },
      amount: { gt: 0 },
    },
    select: {
      id: true,
      date: true,
      name: true,
      merchantName: true,
      amount: true,
      category: true,
    },
    orderBy: { date: "desc" },
    take: 200,
  })

  return rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    name: r.name,
    merchantName: r.merchantName,
    amount: r.amount,
    category: r.category,
  }))
}
