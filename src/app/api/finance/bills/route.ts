import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { classifyBillType, enrichMerchantName, type BillType } from "@/lib/finance/bill-type-classifier"
import {
  isGibberishName, isInMonth, currentMonthStr, advanceDate, projectNextDate,
  PLAID_FREQ, buildSubDisplayName, buildCCDisplayName, type BillItem,
} from "@/lib/finance/bill-helpers"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F7001", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const targetMonth = searchParams.get("month") ?? currentMonthStr()

  try {
    const now = new Date()
    const [, targetMon] = targetMonth.split("-").map(Number)
    const [targetYear] = targetMonth.split("-").map(Number)
    const monthEnd = new Date(targetYear, targetMon, 0, 23, 59, 59)

    const [subscriptions, plaidStreams, dismissedSubs] = await Promise.all([
      db.financeSubscription.findMany({
        where: { userId: user.id, status: "active" },
        orderBy: { nextChargeDate: "asc" },
      }),
      db.financeRecurringStream.findMany({
        where: { userId: user.id, streamType: "outflow", isActive: true },
      }),
      db.financeSubscription.findMany({
        where: { userId: user.id, status: "dismissed" },
        select: { merchantName: true },
      }),
    ])

    const dismissedNames = new Set(dismissedSubs.map((d) => d.merchantName.toLowerCase()))

    // Fetch account info
    const allAccountIds = [...new Set([
      ...subscriptions.map((s) => s.accountId),
      ...plaidStreams.map((s) => s.accountId),
    ].filter((id): id is string => id != null))]

    const accounts = allAccountIds.length > 0
      ? await db.financeAccount.findMany({
          where: { id: { in: allAccountIds } },
          select: { id: true, type: true, subtype: true, mask: true, institution: { select: { institutionName: true } } },
        })
      : []
    const accountMap = new Map(accounts.map((a) => [a.id, a]))
    const materializedMerchants = new Set(subscriptions.map((s) => s.merchantName.toLowerCase()))

    const subBills: BillItem[] = []

    // Materialized subscriptions
    for (const s of subscriptions) {
      const bill = projectSubBill(s, accountMap, targetMonth, monthEnd, now)
      if (bill) subBills.push(bill)
    }

    // Plaid streams (skip dismissed and materialized)
    for (const ps of plaidStreams) {
      const name = (ps.merchantName ?? ps.description).toLowerCase()
      if (dismissedNames.has(name) || materializedMerchants.has(name)) continue
      const bill = projectPlaidBill(ps, accountMap, targetMonth, monthEnd, now)
      if (bill) subBills.push(bill)
    }

    // Credit card payments
    const ccBills = await getCCBills(user.id, targetMonth, now)

    const allBills = [...subBills, ...ccBills].sort((a, b) => a.daysUntil - b.daysUntil)

    // Group by bill type
    const groups: Record<string, BillItem[]> = {
      cc_annual_fee: [], insurance: [], membership: [],
      subscription: [], bill: [], cc_payment: [],
    }
    for (const b of allBills) {
      const key = b.billType ?? "bill"
      if (!groups[key]) groups[key] = []
      groups[key].push(b)
    }

    const monthTotal = allBills.reduce((s, b) => s + b.amount, 0)
    const subsOnly = allBills.filter((b) => b.billType === "subscription")
    const monthlyBurnRate = subsOnly.reduce((s, b) => s + b.amount, 0)
    const dueThisWeek = allBills.filter((b) => b.daysUntil <= 7)

    return NextResponse.json({
      bills: allBills,
      monthTotal: Math.round(monthTotal * 100) / 100,
      monthlyBurnRate: Math.round(monthlyBurnRate * 100) / 100,
      groups,
      totalDueThisWeek: dueThisWeek.reduce((s, b) => s + b.amount, 0),
      countDueThisWeek: dueThisWeek.length,
      targetMonth,
    })
  } catch (err) {
    return apiError("F7002", "Failed to fetch upcoming bills", 500, err)
  }
}

/** Project a materialized subscription into the target month */
function projectSubBill(
  s: { id: string; merchantName: string; nickname: string | null; category: string | null; frequency: string; amount: number; billType: string | null; accountId: string | null; nextChargeDate: Date | null; lastChargeDate: Date | null },
  accountMap: Map<string, { type: string; subtype: string | null; mask: string | null; institution: { institutionName: string | null } | null }>,
  targetMonth: string, monthEnd: Date, now: Date,
): BillItem | null {
  const next = s.nextChargeDate ? new Date(s.nextChargeDate) : projectNextDate(s.lastChargeDate, s.frequency)
  if (!next) return null

  while (next < now) advanceDate(next, s.frequency)

  if (!isInMonth(next, targetMonth)) {
    if (!projectIntoMonth(next, s.frequency, targetMonth, monthEnd)) return null
  }

  const acct = s.accountId ? accountMap.get(s.accountId) : null
  const displayName = buildSubDisplayName(s, acct)
  const { billType } = s.billType
    ? { billType: s.billType as BillType }
    : classifyBillType({
        merchantName: s.merchantName, frequency: s.frequency, category: s.category,
        amount: s.amount, accountType: acct?.type ?? null, accountSubtype: acct?.subtype ?? null,
      })

  const daysUntil = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return {
    id: s.id, merchantName: displayName, amount: s.amount, frequency: s.frequency,
    nextDueDate: next.toISOString().slice(0, 10), daysUntil: Math.max(0, daysUntil),
    category: s.category, billType,
  }
}

/** Project a Plaid stream into the target month */
function projectPlaidBill(
  ps: { streamId: string; merchantName: string | null; description: string; frequency: string; lastDate: Date | null; lastAmount: number | null; averageAmount: number | null; category: string | null; accountId: string | null },
  accountMap: Map<string, { type: string; subtype: string | null; mask: string | null; institution: { institutionName: string | null } | null }>,
  targetMonth: string, monthEnd: Date, now: Date,
): BillItem | null {
  const freq = PLAID_FREQ[ps.frequency] ?? "monthly"
  const next = projectNextDate(ps.lastDate, freq)
  if (!next) return null

  while (next < now) advanceDate(next, freq)
  if (!isInMonth(next, targetMonth)) {
    if (!projectIntoMonth(next, freq, targetMonth, monthEnd)) return null
  }

  const merchantName = ps.merchantName && !isGibberishName(ps.merchantName)
    ? ps.merchantName
    : (!isGibberishName(ps.description) ? ps.description : null)
  const acct = ps.accountId ? accountMap.get(ps.accountId) : null
  const displayName = merchantName
    ? enrichMerchantName(merchantName, acct?.institution?.institutionName ?? null, acct?.mask ?? null)
    : (ps.description || "Unknown Charge")

  const amount = ps.lastAmount ?? ps.averageAmount ?? 0
  const classifyName = merchantName ?? ps.description
  const { billType } = classifyBillType({
    merchantName: classifyName, frequency: freq, category: ps.category ?? null, amount,
    accountType: acct?.type ?? null, accountSubtype: acct?.subtype ?? null,
  })

  const daysUntil = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return {
    id: `plaid:${ps.streamId}`, merchantName: displayName, amount, frequency: freq,
    nextDueDate: next.toISOString().slice(0, 10), daysUntil: Math.max(0, daysUntil),
    category: ps.category ?? null, billType,
  }
}

/** Check if a date can be projected forward into the target month */
function projectIntoMonth(date: Date, frequency: string, targetMonth: string, monthEnd: Date): boolean {
  const projected = new Date(date)
  for (let i = 0; i < 12; i++) {
    if (isInMonth(projected, targetMonth)) return true
    if (projected > monthEnd) return false
    advanceDate(projected, frequency)
  }
  return false
}

/** Get credit card payment bills for the target month */
async function getCCBills(userId: string, targetMonth: string, now: Date): Promise<BillItem[]> {
  const liabilities = await db.financeLiabilityCreditCard.findMany({
    where: { userId, nextPaymentDueDate: { not: null } },
    include: {
      account: {
        select: { name: true, officialName: true, mask: true, institution: { select: { institutionName: true } } },
      },
    },
  })

  return liabilities
    .filter((cc) => cc.nextPaymentDueDate != null && isInMonth(new Date(cc.nextPaymentDueDate!), targetMonth))
    .filter((cc) => {
      // Skip cards with no balance due
      const minPay = cc.minimumPaymentAmount ?? 0
      const stmtBal = cc.lastStatementBalance ?? 0
      return minPay > 0 || stmtBal > 0
    })
    .map((cc) => {
      const nextDue = new Date(cc.nextPaymentDueDate!)
      const daysUntil = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const minPay = cc.minimumPaymentAmount ?? 0
      const stmtBal = cc.lastStatementBalance ?? 0
      return {
        id: `cc-${cc.id}`,
        merchantName: buildCCDisplayName(cc),
        amount: minPay > 0 ? minPay : Math.max(stmtBal, 0),
        frequency: "monthly",
        nextDueDate: nextDue.toISOString().slice(0, 10),
        daysUntil: Math.max(0, daysUntil),
        category: "Credit Card Payment",
        billType: "cc_payment" as const,
      }
    })
}
