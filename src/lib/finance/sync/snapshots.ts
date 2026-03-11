/**
 * Finance snapshot management: daily snapshots and historical backfill.
 */

import { db } from "@/lib/db"

const DEPOSIT_TYPES = new Set(["checking", "savings", "investment", "brokerage"])
const DEBT_TYPES = new Set(["credit", "business_credit", "loan", "mortgage"])

/** Convert Date to "YYYY-MM-DD" using UTC */
function toUtcDateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Today at UTC midnight */
function todayUtc(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

/** Add days to a UTC date */
function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/**
 * Save a daily finance snapshot (net worth tracking).
 */
export async function saveFinanceSnapshot(userId: string): Promise<void> {
  const accounts = await db.financeAccount.findMany({
    where: { userId, isHidden: false },
    include: {
      institution: {
        select: {
          provider: true,
          status: true,
        },
      },
    },
  })

  const canonicalAccounts = accounts.filter((acct) => {
    if (acct.institution.status === "disconnected") return false
    if (acct.institution.provider === "simplefin" && acct.linkedExternalId) return false
    return true
  })

  const breakdown = { checking: 0, savings: 0, credit: 0, loan: 0, investment: 0, mortgage: 0 }
  let totalAssets = 0
  let totalDebt = 0

  for (const acct of canonicalAccounts) {
    const balance = acct.currentBalance ?? 0
    switch (acct.type) {
      case "checking":
        breakdown.checking += balance
        totalAssets += balance
        break
      case "savings":
        breakdown.savings += balance
        totalAssets += balance
        break
      case "investment":
      case "brokerage":
        breakdown.investment += balance
        totalAssets += balance
        break
      case "credit":
      case "business_credit":
        breakdown.credit += Math.abs(balance)
        totalDebt += Math.abs(balance)
        break
      case "loan":
        breakdown.loan += Math.abs(balance)
        totalDebt += Math.abs(balance)
        break
      case "mortgage":
        breakdown.mortgage += Math.abs(balance)
        totalDebt += Math.abs(balance)
        break
    }
  }

  const n = new Date()
  const today = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))

  await db.financeSnapshot.upsert({
    where: {
      userId_date: { userId, date: today },
    },
    create: {
      userId,
      date: today,
      totalAssets,
      totalDebt,
      netWorth: totalAssets - totalDebt,
      breakdown: JSON.stringify(breakdown),
    },
    update: {
      totalAssets,
      totalDebt,
      netWorth: totalAssets - totalDebt,
      breakdown: JSON.stringify(breakdown),
    },
  })
}

/**
 * Backfill historical daily snapshots from transaction history.
 *
 * For each account, starts with today's currentBalance and walks backwards
 * through transactions to reconstruct daily balances.
 */
export async function backfillHistoricalSnapshots(userId: string): Promise<number> {
  const accounts = await db.financeAccount.findMany({
    where: { userId, isHidden: false },
    include: {
      institution: { select: { provider: true, status: true } },
    },
  })

  const canonical = accounts.filter((acct) => {
    if (acct.institution.status === "disconnected") return false
    if (acct.institution.provider === "simplefin" && acct.linkedExternalId) return false
    return true
  })

  if (canonical.length === 0) return 0

  const transactions = await db.financeTransaction.findMany({
    where: {
      userId,
      accountId: { in: canonical.map((a) => a.id) },
      isPending: false,
    },
    orderBy: { date: "desc" },
    select: { accountId: true, date: true, amount: true },
  })

  if (transactions.length === 0) {
    // No transactions — seed baseline snapshots from current balances
    // so the chart shows at least a flat line over the last 30 days
    return seedBaselineSnapshots(userId, canonical)
  }

  // Group transactions by account -> date -> sum of amounts
  const txByAccountDate = new Map<string, Map<string, number>>()
  for (const tx of transactions) {
    const dateKey = toUtcDateKey(tx.date)
    let acctMap = txByAccountDate.get(tx.accountId)
    if (!acctMap) {
      acctMap = new Map()
      txByAccountDate.set(tx.accountId, acctMap)
    }
    acctMap.set(dateKey, (acctMap.get(dateKey) ?? 0) + tx.amount)
  }

  const earliestTx = transactions[transactions.length - 1]
  const today = todayUtc()
  const startDate = new Date(Date.UTC(
    earliestTx.date.getUTCFullYear(),
    earliestTx.date.getUTCMonth(),
    earliestTx.date.getUTCDate(),
  ))

  // Reconstruct daily balances per account by walking backwards
  const accountDailyBalances = new Map<string, Map<string, number>>()

  for (const acct of canonical) {
    const dailyBalances = new Map<string, number>()
    const txMap = txByAccountDate.get(acct.id)
    let balance = acct.currentBalance ?? 0
    const isDebt = DEBT_TYPES.has(acct.type)

    let cursor = new Date(today)
    while (cursor >= startDate) {
      const key = toUtcDateKey(cursor)
      dailyBalances.set(key, balance)

      const dayTxSum = txMap?.get(key) ?? 0
      if (dayTxSum !== 0) {
        balance = isDebt ? balance - dayTxSum : balance + dayTxSum
      }

      cursor = addDaysUtc(cursor, -1)
    }

    accountDailyBalances.set(acct.id, dailyBalances)
  }

  // Aggregate per-account balances into daily snapshots
  const snapshots: Array<{
    date: Date
    totalAssets: number
    totalDebt: number
    netWorth: number
    breakdown: Record<string, number>
  }> = []

  let cursor = new Date(startDate)
  while (cursor <= today) {
    const key = toUtcDateKey(cursor)
    const breakdown: Record<string, number> = {
      checking: 0, savings: 0, credit: 0, loan: 0, investment: 0, mortgage: 0,
    }
    let totalAssets = 0
    let totalDebt = 0

    for (const acct of canonical) {
      const balance = accountDailyBalances.get(acct.id)?.get(key) ?? 0
      const breakdownKey = acct.type === "business_credit" ? "credit"
        : acct.type === "brokerage" ? "investment"
        : acct.type

      if (breakdown[breakdownKey] !== undefined) {
        breakdown[breakdownKey] += DEBT_TYPES.has(acct.type) ? Math.abs(balance) : balance
      }

      if (DEPOSIT_TYPES.has(acct.type)) {
        totalAssets += balance
      } else if (DEBT_TYPES.has(acct.type)) {
        totalDebt += Math.abs(balance)
      }
    }

    snapshots.push({
      date: new Date(cursor),
      totalAssets,
      totalDebt,
      netWorth: totalAssets - totalDebt,
      breakdown,
    })

    cursor = addDaysUtc(cursor, 1)
  }

  if (snapshots.length === 0) return 0

  // Upsert all snapshots — existing ones may have stale data from when
  // account types were incorrect (e.g. credit cards typed as "checking")
  let upserted = 0
  for (const s of snapshots) {
    await db.financeSnapshot.upsert({
      where: { userId_date: { userId, date: s.date } },
      create: {
        userId,
        date: s.date,
        totalAssets: s.totalAssets,
        totalDebt: s.totalDebt,
        netWorth: s.netWorth,
        breakdown: JSON.stringify(s.breakdown),
      },
      update: {
        totalAssets: s.totalAssets,
        totalDebt: s.totalDebt,
        netWorth: s.netWorth,
        breakdown: JSON.stringify(s.breakdown),
      },
    })
    upserted++
  }

  return upserted
}

/**
 * Seed baseline snapshots when no transaction history exists.
 * Creates flat historical snapshots from current balances going back 30 days
 * so the chart shows a meaningful line instead of a single point.
 */
async function seedBaselineSnapshots(
  userId: string,
  accounts: Array<{ id: string; type: string; currentBalance: number | null }>
): Promise<number> {
  const breakdown: Record<string, number> = {
    checking: 0, savings: 0, credit: 0, loan: 0, investment: 0, mortgage: 0,
  }
  let totalAssets = 0
  let totalDebt = 0

  for (const acct of accounts) {
    const balance = acct.currentBalance ?? 0
    const breakdownKey = acct.type === "business_credit" ? "credit"
      : acct.type === "brokerage" ? "investment"
      : acct.type

    if (breakdown[breakdownKey] !== undefined) {
      breakdown[breakdownKey] += DEBT_TYPES.has(acct.type) ? Math.abs(balance) : balance
    }

    if (DEPOSIT_TYPES.has(acct.type)) {
      totalAssets += balance
    } else if (DEBT_TYPES.has(acct.type)) {
      totalDebt += Math.abs(balance)
    }
  }

  const netWorth = totalAssets - totalDebt
  const today = todayUtc()
  const startDate = addDaysUtc(today, -30)

  const existingSnapshots = await db.financeSnapshot.findMany({
    where: { userId, date: { gte: startDate, lte: today } },
    select: { date: true },
  })
  const existingDates = new Set(existingSnapshots.map((s) => toUtcDateKey(s.date)))

  const newSnapshots: Array<{
    userId: string
    date: Date
    totalAssets: number
    totalDebt: number
    netWorth: number
    breakdown: string
  }> = []

  let cursor = new Date(startDate)
  while (cursor <= today) {
    const key = toUtcDateKey(cursor)
    if (!existingDates.has(key)) {
      newSnapshots.push({
        userId,
        date: new Date(cursor),
        totalAssets,
        totalDebt,
        netWorth,
        breakdown: JSON.stringify(breakdown),
      })
    }
    cursor = addDaysUtc(cursor, 1)
  }

  if (newSnapshots.length === 0) return 0

  await db.financeSnapshot.createMany({
    data: newSnapshots,
    skipDuplicates: true,
  })

  return newSnapshots.length
}
