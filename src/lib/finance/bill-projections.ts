/**
 * Bill projection logic: subscription, Plaid stream, and CC payment projection.
 * Extracted from bills route to keep API routes under 200 lines.
 */

import { db } from "@/lib/db"
import { classifyBillType, enrichMerchantName, type BillType } from "./bill-type-classifier"
import {
  isGibberishName, isInMonth, advanceDate, projectNextDate,
  PLAID_FREQ, buildSubDisplayName, buildCCDisplayName, type BillItem,
} from "./bill-helpers"

type AccountMap = Map<string, { type: string; subtype: string | null; name: string; mask: string | null; institution: { institutionName: string | null } | null }>

/** Project a materialized subscription into the target month */
export function projectSubBill(
  s: { id: string; merchantName: string; nickname: string | null; category: string | null; frequency: string; amount: number; billType: string | null; accountId: string | null; nextChargeDate: Date | null; lastChargeDate: Date | null },
  accountMap: AccountMap,
  targetMonth: string, monthEnd: Date, now: Date,
): BillItem | null {
  const next = s.nextChargeDate ? new Date(s.nextChargeDate) : projectNextDate(s.lastChargeDate, s.frequency)
  if (!next) return null

  let isPaid = false
  if (s.lastChargeDate && isInMonth(new Date(s.lastChargeDate), targetMonth)) {
    isPaid = true
  }
  if (!isPaid && next < now && isInMonth(next, targetMonth)) {
    isPaid = true
  }

  const preAdvance = new Date(next)
  while (next < now) advanceDate(next, s.frequency)

  if (isPaid && !isInMonth(next, targetMonth)) {
    const paidDate = s.lastChargeDate && isInMonth(new Date(s.lastChargeDate), targetMonth)
      ? new Date(s.lastChargeDate)
      : preAdvance
    next.setTime(paidDate.getTime())
  }

  if (!isInMonth(next, targetMonth)) {
    if (!projectIntoMonth(next, s.frequency, targetMonth, monthEnd)) {
      if (!isPaid) return null
    }
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
    nextDueDate: next.toISOString().slice(0, 10), daysUntil: isPaid ? -1 : Math.max(0, daysUntil),
    category: s.category, billType, isPaid,
    accountName: acct?.name ?? null,
    accountMask: acct?.mask ?? null,
    institutionName: acct?.institution?.institutionName ?? null,
  }
}

/** Project a Plaid stream into the target month */
export function projectPlaidBill(
  ps: { streamId: string; merchantName: string | null; description: string; frequency: string; lastDate: Date | null; lastAmount: number | null; averageAmount: number | null; category: string | null; accountId: string | null },
  accountMap: AccountMap,
  targetMonth: string, monthEnd: Date, now: Date,
): BillItem | null {
  const freq = PLAID_FREQ[ps.frequency] ?? "monthly"
  const next = projectNextDate(ps.lastDate, freq)
  if (!next) return null

  let isPaid = false
  if (ps.lastDate && isInMonth(new Date(ps.lastDate), targetMonth)) {
    isPaid = true
  }
  if (!isPaid && next < now && isInMonth(next, targetMonth)) {
    isPaid = true
  }

  const preAdvance = new Date(next)
  while (next < now) advanceDate(next, freq)

  if (isPaid && !isInMonth(next, targetMonth)) {
    const paidDate = ps.lastDate && isInMonth(new Date(ps.lastDate), targetMonth)
      ? new Date(ps.lastDate)
      : preAdvance
    next.setTime(paidDate.getTime())
  }

  if (!isInMonth(next, targetMonth)) {
    if (!projectIntoMonth(next, freq, targetMonth, monthEnd)) {
      if (!isPaid) return null
    }
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
    nextDueDate: next.toISOString().slice(0, 10), daysUntil: isPaid ? -1 : Math.max(0, daysUntil),
    category: ps.category ?? null, billType, isPaid,
    accountName: acct?.name ?? null,
    accountMask: acct?.mask ?? null,
    institutionName: acct?.institution?.institutionName ?? null,
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
export async function getCCBills(userId: string, targetMonth: string, now: Date): Promise<BillItem[]> {
  const bills: BillItem[] = []
  const source1AccountIds = new Set<string>()

  // Source 1: Plaid liability data (has explicit nextPaymentDueDate)
  const liabilities = await db.financeLiabilityCreditCard.findMany({
    where: { userId, nextPaymentDueDate: { not: null } },
    include: {
      account: {
        select: { id: true, name: true, mask: true, institution: { select: { institutionName: true } } },
      },
    },
  })

  for (const cc of liabilities) {
    if (!cc.nextPaymentDueDate || !isInMonth(new Date(cc.nextPaymentDueDate), targetMonth)) continue
    const minPay = cc.minimumPaymentAmount ?? 0
    const stmtBal = cc.lastStatementBalance ?? 0
    if (minPay <= 0 && stmtBal <= 0) continue

    source1AccountIds.add(cc.accountId)

    const nextDue = new Date(cc.nextPaymentDueDate)
    const daysUntil = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    bills.push({
      id: `cc-${cc.id}`,
      merchantName: buildCCDisplayName(cc),
      amount: minPay > 0 ? minPay : Math.max(stmtBal, 0),
      frequency: "monthly",
      nextDueDate: nextDue.toISOString().slice(0, 10),
      daysUntil: Math.max(0, daysUntil),
      category: "Credit Card Payment",
      billType: "cc_payment" as const,
      accountName: cc.account?.name ?? null,
      accountMask: cc.account?.mask ?? null,
      institutionName: cc.account?.institution?.institutionName ?? null,
    })
  }

  // Source 2: All accounts with card profiles not already handled by Source 1.
  // SimpleFIN often misclassifies credit cards as "checking", so we query by
  // CreditCardProfile linkage instead of relying on account type.
  const cardProfiles = await db.creditCardProfile.findMany({
    where: { userId, accountId: { notIn: [...source1AccountIds] } },
    select: { accountId: true, paymentDueDay: true, cardName: true },
  })
  const dueDayMap = new Map(cardProfiles.map((p) => [p.accountId, p.paymentDueDay]))
  const cardNameMap = new Map(cardProfiles.map((p) => [p.accountId, p.cardName]))
  const profileAccountIds = cardProfiles.map((p) => p.accountId)

  const creditAccounts = profileAccountIds.length > 0
    ? await db.financeAccount.findMany({
        where: { id: { in: profileAccountIds } },
        select: {
          id: true, name: true, mask: true,
          currentBalance: true, creditLimit: true,
          institution: { select: { institutionName: true } },
        },
      })
    : []

  const [targetYear, targetMon] = targetMonth.split("-").map(Number)
  for (const acct of creditAccounts) {
    const balance = Math.abs(acct.currentBalance ?? 0)
    if (balance <= 0) continue
    const dueDay = dueDayMap.get(acct.id) ?? 25
    const dueDate = new Date(targetYear, targetMon - 1, dueDay)
    if (!isInMonth(dueDate, targetMonth)) continue

    const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const isPaid = daysUntil < 0

    const displayName = cardNameMap.get(acct.id) ?? acct.name ?? `${acct.institution?.institutionName ?? ""} Card`
    const maskSuffix = acct.mask ? ` ••••${acct.mask}` : ""

    bills.push({
      id: `cc-sfin-${acct.id}`,
      merchantName: `${displayName}${maskSuffix}`,
      amount: balance,
      frequency: "monthly",
      nextDueDate: `${targetYear}-${String(targetMon).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`,
      daysUntil: isPaid ? -1 : Math.max(0, daysUntil),
      category: "Credit Card Payment",
      billType: "cc_payment" as const,
      isPaid,
      accountName: acct.name ?? null,
      accountMask: acct.mask ?? null,
      institutionName: acct.institution?.institutionName ?? null,
    })
  }

  return bills
}
