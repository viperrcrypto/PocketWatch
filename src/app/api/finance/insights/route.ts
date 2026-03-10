import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F8001", "Authentication required", 401)

  try {
    const baseWhere = {
      userId: user.id,
      isDuplicate: false,
      isExcluded: false,
    }

    // Find the two most recent months that actually have data
    // This fixes $0 with Plaid Sandbox (historical data) and works for production
    const recentMonths = await db.$queryRaw<Array<{ month: string }>>`
      SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') AS month
      FROM "FinanceTransaction"
      WHERE "userId" = ${user.id}
        AND "isDuplicate" = false
        AND "isExcluded" = false
      ORDER BY month DESC
      LIMIT 2
    `

    const thisMonthStr = recentMonths[0]?.month
    const lastMonthStr = recentMonths[1]?.month

    // Build date ranges from the actual data months
    const thisMonthStart = thisMonthStr
      ? new Date(`${thisMonthStr}-01`)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const thisMonthParts = thisMonthStr?.split("-") ?? [String(new Date().getFullYear()), String(new Date().getMonth() + 1)]
    const thisMonthEnd = new Date(Number(thisMonthParts[0]), Number(thisMonthParts[1]), 1) // first day of next month

    const lastMonthStart = lastMonthStr ? new Date(`${lastMonthStr}-01`) : null
    const lastMonthParts = lastMonthStr?.split("-")
    const lastMonthEnd = lastMonthParts
      ? new Date(Number(lastMonthParts[0]), Number(lastMonthParts[1]), 1)
      : null

    // This month spending by category
    const thisMonthSpending = await db.financeTransaction.groupBy({
      by: ["category"],
      where: { ...baseWhere, date: { gte: thisMonthStart, lt: thisMonthEnd }, amount: { gt: 0 } },
      _sum: { amount: true },
    })

    // Last month spending by category
    const lastMonthSpending = lastMonthStart && lastMonthEnd
      ? await db.financeTransaction.groupBy({
          by: ["category"],
          where: { ...baseWhere, date: { gte: lastMonthStart, lt: lastMonthEnd }, amount: { gt: 0 } },
          _sum: { amount: true },
        })
      : []

    // This month income
    const thisMonthIncome = await db.financeTransaction.aggregate({
      where: { ...baseWhere, date: { gte: thisMonthStart, lt: thisMonthEnd }, amount: { lt: 0 } },
      _sum: { amount: true },
    })

    // Last month income
    const lastMonthIncome = lastMonthStart && lastMonthEnd
      ? await db.financeTransaction.aggregate({
          where: { ...baseWhere, date: { gte: lastMonthStart, lt: lastMonthEnd }, amount: { lt: 0 } },
          _sum: { amount: true },
        })
      : { _sum: { amount: null } }

    // Top merchants this month
    const topMerchants = await db.financeTransaction.groupBy({
      by: ["merchantName"],
      where: { ...baseWhere, date: { gte: thisMonthStart, lt: thisMonthEnd }, amount: { gt: 0 }, merchantName: { not: null } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    })

    // Build category comparison
    const lastMonthMap = new Map(
      lastMonthSpending.map((s) => [s.category, s._sum.amount ?? 0])
    )

    const categoryComparison = thisMonthSpending.map((s) => {
      const thisAmount = s._sum.amount ?? 0
      const lastAmount = lastMonthMap.get(s.category) ?? 0
      const change = lastAmount > 0 ? ((thisAmount - lastAmount) / lastAmount) * 100 : 0

      return {
        category: s.category,
        thisMonth: Math.round(thisAmount * 100) / 100,
        lastMonth: Math.round(lastAmount * 100) / 100,
        changePercent: Math.round(change * 10) / 10,
      }
    }).sort((a, b) => b.thisMonth - a.thisMonth)

    const totalSpending = thisMonthSpending.reduce((s, c) => s + (c._sum.amount ?? 0), 0)
    const totalIncome = Math.abs(thisMonthIncome._sum.amount ?? 0)
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpending) / totalIncome) * 100 : 0

    return NextResponse.json({
      totalSpending: Math.round(totalSpending * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      lastMonthSpending: lastMonthSpending.reduce((s, c) => s + (c._sum.amount ?? 0), 0),
      lastMonthIncome: Math.abs(lastMonthIncome._sum.amount ?? 0),
      savingsRate: Math.round(savingsRate * 10) / 10,
      categoryComparison,
      topMerchants: topMerchants.map((m) => ({
        merchantName: m.merchantName,
        total: Math.round((m._sum.amount ?? 0) * 100) / 100,
        count: m._count,
      })),
    })
  } catch (err) {
    return apiError("F8002", "Failed to generate insights", 500, err)
  }
}
