/**
 * Transaction Intelligence Engine — detects refunds, deposits, double charges,
 * budget warnings, bill reminders, large transactions, and unusual spend.
 *
 * Returns NewAlert[] for events not yet in the FinanceAlert table.
 */

import { db } from "@/lib/db"
import { stringSimilarity } from "./normalize"
import { cleanMerchantName } from "./categorize"

const LOOKBACK_HOURS = 24
const REFUND_MATCH_DAYS = 90
const REFUND_AMOUNT_TOLERANCE = 0.2
const LARGE_TRANSACTION_THRESHOLD = 500
const BUDGET_WARNING_THRESHOLD = 0.8
const UNUSUAL_SPEND_MULTIPLIER = 2
const BILL_REMINDER_DAYS = 3
const DOUBLE_CHARGE_AMOUNT_TOLERANCE = 0.5
const DOUBLE_CHARGE_DAY_TOLERANCE = 1

// Categories that indicate income/transfer (not refunds or spending)
const NON_SPENDING_CATEGORIES = new Set([
  "Transfer", "Investment", "Income", "Credit Card Payment",
  "Loan", "Rent", "Mortgage",
])

export interface NewAlert {
  alertType: string
  title: string
  message: string
  amount?: number
  merchantName?: string
  transactionId?: string
  metadata?: Record<string, unknown>
}

function fmtUSD(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Refund + Deposit Detection ───────────────────────────────

async function detectRefundsAndDeposits(userId: string): Promise<NewAlert[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000)

  // Negative amounts in Plaid = money received (credits, refunds, deposits)
  const credits = await db.financeTransaction.findMany({
    where: {
      userId,
      isExcluded: false,
      isDuplicate: false,
      createdAt: { gte: cutoff },
      amount: { lt: 0 },
    },
    select: { id: true, name: true, merchantName: true, amount: true, date: true, category: true },
  })

  if (credits.length === 0) return []

  // Already-alerted transaction IDs
  const existingAlerts = await db.financeAlert.findMany({
    where: {
      userId,
      transactionId: { in: credits.map((c) => c.id) },
      alertType: { in: ["refund", "deposit"] },
    },
    select: { transactionId: true },
  })
  const alertedIds = new Set(existingAlerts.map((a) => a.transactionId))

  const alerts: NewAlert[] = []
  const refundLookbackDate = new Date()
  refundLookbackDate.setDate(refundLookbackDate.getDate() - REFUND_MATCH_DAYS)

  for (const credit of credits) {
    if (alertedIds.has(credit.id)) continue

    const creditMerchant = cleanMerchantName(credit.merchantName ?? credit.name)
    const absAmount = Math.abs(credit.amount)

    // Skip non-spending categories for refund matching
    if (credit.category && NON_SPENDING_CATEGORIES.has(credit.category)) {
      // This is a deposit/income, not a refund
      alerts.push({
        alertType: "deposit",
        title: "Money Received",
        message: `${fmtUSD(absAmount)} from ${creditMerchant || credit.name}`,
        amount: absAmount,
        merchantName: creditMerchant || credit.merchantName || credit.name,
        transactionId: credit.id,
      })
      continue
    }

    // Try to match with a prior charge from same merchant
    const candidates = await db.financeTransaction.findMany({
      where: {
        userId,
        isExcluded: false,
        isDuplicate: false,
        amount: { gt: 0 },
        date: { gte: refundLookbackDate },
      },
      select: { id: true, name: true, merchantName: true, amount: true, date: true },
      orderBy: { date: "desc" },
      take: 200,
    })

    let isRefund = false
    const matchedCharge = creditMerchant
      ? candidates.find((c) => {
          const chargeMerchant = cleanMerchantName(c.merchantName ?? c.name)
          if (!chargeMerchant) return false
          const merchantMatch = stringSimilarity(creditMerchant, chargeMerchant) > 0.7
          const amountMatch = c.amount > 0
            ? Math.abs(absAmount - c.amount) / c.amount <= REFUND_AMOUNT_TOLERANCE
            : false
          return merchantMatch && amountMatch
        })
      : undefined

    if (matchedCharge) {
      isRefund = true
      alerts.push({
        alertType: "refund",
        title: "Refund Detected",
        message: `${fmtUSD(absAmount)} refund from ${creditMerchant || credit.name}`,
        amount: absAmount,
        merchantName: creditMerchant || credit.merchantName || credit.name,
        transactionId: credit.id,
        metadata: { matchedChargeId: matchedCharge.id, matchedAmount: matchedCharge.amount },
      })
    }

    if (!isRefund) {
      alerts.push({
        alertType: "deposit",
        title: "Money Received",
        message: `${fmtUSD(absAmount)} from ${creditMerchant || credit.name}`,
        amount: absAmount,
        merchantName: creditMerchant || credit.merchantName || credit.name,
        transactionId: credit.id,
      })
    }
  }

  return alerts
}

// ─── Double Charge Detection ──────────────────────────────────

async function detectDoubleCharges(userId: string): Promise<NewAlert[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000)

  const recent = await db.financeTransaction.findMany({
    where: {
      userId,
      isExcluded: false,
      isDuplicate: false,
      createdAt: { gte: cutoff },
      amount: { gt: 0 },
    },
    select: { id: true, name: true, merchantName: true, amount: true, date: true },
    orderBy: { date: "asc" },
  })

  if (recent.length < 2) return []

  const existingAlerts = await db.financeAlert.findMany({
    where: { userId, alertType: "double_charge", sentAt: { gte: cutoff } },
    select: { transactionId: true, metadata: true },
  })
  const alertedIds = new Set<string | null | undefined>()
  for (const a of existingAlerts) {
    alertedIds.add(a.transactionId)
    const meta = a.metadata as Record<string, string> | null
    if (meta?.secondTransactionId) alertedIds.add(meta.secondTransactionId)
  }
  const matched = new Set<string>()
  const alerts: NewAlert[] = []

  for (let i = 0; i < recent.length; i++) {
    const a = recent[i]
    if (matched.has(a.id) || alertedIds.has(a.id)) continue

    for (let j = i + 1; j < recent.length; j++) {
      const b = recent[j]
      if (matched.has(b.id) || alertedIds.has(b.id)) continue

      const dayDiff = Math.abs(a.date.getTime() - b.date.getTime()) / (1000 * 60 * 60 * 24)
      if (dayDiff > DOUBLE_CHARGE_DAY_TOLERANCE) continue

      const amountDiff = Math.abs(a.amount - b.amount)
      if (amountDiff > DOUBLE_CHARGE_AMOUNT_TOLERANCE) continue

      const aMerchant = cleanMerchantName(a.merchantName ?? a.name)
      const bMerchant = cleanMerchantName(b.merchantName ?? b.name)
      if (!aMerchant || !bMerchant || stringSimilarity(aMerchant, bMerchant) < 0.7) continue

      matched.add(a.id)
      matched.add(b.id)
      alerts.push({
        alertType: "double_charge",
        title: "Possible Double Charge",
        message: `${fmtUSD(a.amount)} charged twice at ${aMerchant}`,
        amount: a.amount,
        merchantName: aMerchant,
        transactionId: a.id,
        metadata: { secondTransactionId: b.id },
      })
      break
    }
  }

  return alerts
}

// ─── Budget Warnings ──────────────────────────────────────────

async function detectBudgetWarnings(userId: string): Promise<NewAlert[]> {
  const budgets = await db.financeBudget.findMany({
    where: { userId, isActive: true },
    select: { category: true, monthlyLimit: true },
  })
  if (budgets.length === 0) return []

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const today = now.toISOString().split("T")[0]

  const existingAlerts = await db.financeAlert.findMany({
    where: { userId, alertType: "budget_warning", sentAt: { gte: monthStart } },
    select: { metadata: true },
  })
  const alertedCategories = new Set(
    existingAlerts.map((a) => (a.metadata as Record<string, string> | null)?.dedupKey).filter(Boolean),
  )

  const alerts: NewAlert[] = []

  for (const budget of budgets) {
    const dedupKey = budget.category
    if (alertedCategories.has(dedupKey)) continue

    const agg = await db.financeTransaction.aggregate({
      where: { userId, category: budget.category, isExcluded: false, isDuplicate: false, date: { gte: monthStart }, amount: { gt: 0 } },
      _sum: { amount: true },
    })

    const spent = agg._sum.amount ?? 0
    const ratio = spent / budget.monthlyLimit

    if (ratio >= 1) {
      alerts.push({
        alertType: "budget_warning",
        title: "Budget Exceeded",
        message: `${budget.category}: ${fmtUSD(spent)} / ${fmtUSD(budget.monthlyLimit)} (${Math.round(ratio * 100)}%)`,
        amount: spent,
        merchantName: budget.category,
        metadata: { dedupKey, ratio },
      })
    } else if (ratio >= BUDGET_WARNING_THRESHOLD) {
      alerts.push({
        alertType: "budget_warning",
        title: "Budget Warning",
        message: `${budget.category}: ${fmtUSD(spent)} / ${fmtUSD(budget.monthlyLimit)} (${Math.round(ratio * 100)}%)`,
        amount: spent,
        merchantName: budget.category,
        metadata: { dedupKey, ratio },
      })
    }
  }

  return alerts
}

// ─── Bill Reminders ───────────────────────────────────────────

async function detectBillReminders(userId: string): Promise<NewAlert[]> {
  const now = new Date()
  const reminderCutoff = new Date(now.getTime() + BILL_REMINDER_DAYS * 24 * 60 * 60 * 1000)
  const today = now.toISOString().split("T")[0]

  const bills = await db.financeSubscription.findMany({
    where: { userId, status: "active", nextChargeDate: { gte: now, lte: reminderCutoff } },
    select: { id: true, merchantName: true, amount: true, nextChargeDate: true, nickname: true },
  })

  const existingAlerts = await db.financeAlert.findMany({
    where: { userId, alertType: "bill_reminder", sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    select: { metadata: true },
  })
  const alerted = new Set(
    existingAlerts.map((a) => (a.metadata as Record<string, string> | null)?.dedupKey).filter(Boolean),
  )

  return bills
    .filter((bill) => !alerted.has(`${bill.merchantName}:${today}`))
    .filter((bill) => bill.nextChargeDate != null)
    .map((bill) => {
      const name = bill.nickname ?? bill.merchantName
      const dueDate = bill.nextChargeDate!.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      return {
        alertType: "bill_reminder",
        title: "Bill Due Soon",
        message: `${name}: ${fmtUSD(bill.amount)} on ${dueDate}`,
        amount: bill.amount,
        merchantName: bill.merchantName,
        metadata: { dedupKey: `${bill.merchantName}:${today}` },
      }
    })
}

// ─── Large Transactions ───────────────────────────────────────

async function detectLargeTransactions(userId: string): Promise<NewAlert[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000)

  const large = await db.financeTransaction.findMany({
    where: { userId, isExcluded: false, isDuplicate: false, createdAt: { gte: cutoff }, amount: { gt: LARGE_TRANSACTION_THRESHOLD } },
    select: { id: true, name: true, merchantName: true, amount: true, category: true },
    take: 10,
  })

  const existingAlerts = await db.financeAlert.findMany({
    where: { userId, alertType: "large_transaction", transactionId: { in: large.map((t) => t.id) } },
    select: { transactionId: true },
  })
  const alertedIds = new Set(existingAlerts.map((a) => a.transactionId))

  return large
    .filter((t) => !alertedIds.has(t.id))
    .map((txn) => {
      const merchant = txn.merchantName ?? txn.name
      return {
        alertType: "large_transaction",
        title: "Large Transaction",
        message: `${fmtUSD(txn.amount)} at ${merchant}${txn.category ? ` (${txn.category})` : ""}`,
        amount: txn.amount,
        merchantName: merchant,
        transactionId: txn.id,
      }
    })
}

// ─── Main Entry Point ─────────────────────────────────────────

export async function detectFinancialEvents(userId: string): Promise<NewAlert[]> {
  const [refundsDeposits, doubleCharges, budgetWarnings, billReminders, largeTx] =
    await Promise.all([
      detectRefundsAndDeposits(userId),
      detectDoubleCharges(userId),
      detectBudgetWarnings(userId),
      detectBillReminders(userId),
      detectLargeTransactions(userId),
    ])

  return [...refundsDeposits, ...doubleCharges, ...budgetWarnings, ...billReminders, ...largeTx]
}
