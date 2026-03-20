import { getCurrentUser, withUserEncryption } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { currentMonthStr, type BillItem } from "@/lib/finance/bill-helpers"
import { projectSubBill, projectPlaidBill, getCCBills } from "@/lib/finance/bill-projections"
import { lookupMerchantLogos } from "@/lib/finance/merchant-logos"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F7001", "Authentication required", 401)

  return withUserEncryption(async () => {

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
          select: { id: true, type: true, subtype: true, name: true, mask: true, institution: { select: { institutionName: true } } },
        })
      : []
    const accountMap = new Map(accounts.map((a) => [a.id, a]))
    const materializedMerchants = new Set(subscriptions.map((s) => s.merchantName.toLowerCase()))

    const subBills: BillItem[] = []

    for (const s of subscriptions) {
      const bill = projectSubBill(s, accountMap, targetMonth, monthEnd, now)
      if (bill) subBills.push(bill)
    }

    for (const ps of plaidStreams) {
      const name = (ps.merchantName ?? ps.description).toLowerCase()
      if (dismissedNames.has(name) || materializedMerchants.has(name)) continue
      const bill = projectPlaidBill(ps, accountMap, targetMonth, monthEnd, now)
      if (bill) subBills.push(bill)
    }

    const ccBills = await getCCBills(user.id, targetMonth, now)

    // Attach merchant logos from transaction history
    const merchantNames = [...new Set([...subBills, ...ccBills].map((b) => b.merchantName))]
    const logoMap = await lookupMerchantLogos(user.id, merchantNames)
    for (const bill of [...subBills, ...ccBills]) {
      bill.logoUrl = logoMap.get(bill.merchantName) ?? null
    }

    const allBills = [...subBills, ...ccBills].sort((a, b) => {
      if (a.isPaid && !b.isPaid) return 1
      if (!a.isPaid && b.isPaid) return -1
      if (a.isPaid && b.isPaid) return b.daysUntil - a.daysUntil
      return a.daysUntil - b.daysUntil
    })

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
    const upcoming = allBills.filter((b) => !b.isPaid)
    const dueThisWeek = upcoming.filter((b) => b.daysUntil <= 7)
    const paidCount = allBills.filter((b) => b.isPaid).length

    return NextResponse.json({
      bills: allBills,
      monthTotal: Math.round(monthTotal * 100) / 100,
      monthlyBurnRate: Math.round(monthlyBurnRate * 100) / 100,
      groups,
      totalDueThisWeek: dueThisWeek.reduce((s, b) => s + b.amount, 0),
      countDueThisWeek: dueThisWeek.length,
      paidCount,
      targetMonth,
    })
  } catch (err) {
    return apiError("F7002", "Failed to fetch upcoming bills", 500, err)
  }
  }) // withUserEncryption
}
