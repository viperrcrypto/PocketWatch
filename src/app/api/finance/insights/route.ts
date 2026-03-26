import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { getCached, setCache } from "@/lib/cache"
import { NextResponse } from "next/server"

const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F8001", "Authentication required", 401)

  const month = new Date().toISOString().slice(0, 7)
  const cacheKey = `finance-insights:${user.id}:${month}`
  const cached = getCached<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const baseWhere = {
      userId: user.id,
      isDuplicate: false,
      isExcluded: false,
    }

    // Find the two most recent months that actually have data
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
    const thisMonthEnd = new Date(Number(thisMonthParts[0]), Number(thisMonthParts[1]), 1)

    const lastMonthStart = lastMonthStr ? new Date(`${lastMonthStr}-01`) : null
    const lastMonthParts = lastMonthStr?.split("-")
    const lastMonthEnd = lastMonthParts
      ? new Date(Number(lastMonthParts[0]), Number(lastMonthParts[1]), 1)
      : null

    // Run all queries in parallel
    const [thisMonthSpending, lastMonthSpending, thisMonthIncome, lastMonthIncome, topMerchants] = await Promise.all([
      // FIX Bug 5: Exclude Transfer/Income/Investment from spending totals
      db.financeTransaction.groupBy({
        by: ["category"],
        where: { ...baseWhere, date: { gte: thisMonthStart, lt: thisMonthEnd }, amount: { gt: 0 }, category: { notIn: ["Transfer", "Income", "Investment", "Crypto"] } },
        _sum: { amount: true },
      }),
      lastMonthStart && lastMonthEnd
        ? db.financeTransaction.groupBy({
            by: ["category"],
            where: { ...baseWhere, date: { gte: lastMonthStart, lt: lastMonthEnd }, amount: { gt: 0 }, category: { notIn: ["Transfer", "Income", "Investment", "Crypto"] } },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
      db.financeTransaction.aggregate({
        where: { ...baseWhere, date: { gte: thisMonthStart, lt: thisMonthEnd }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      lastMonthStart && lastMonthEnd
        ? db.financeTransaction.aggregate({
            where: { ...baseWhere, date: { gte: lastMonthStart, lt: lastMonthEnd }, amount: { lt: 0 } },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      db.financeTransaction.groupBy({
        by: ["merchantName"],
        where: { ...baseWhere, date: { gte: thisMonthStart, lt: thisMonthEnd }, amount: { gt: 0 }, merchantName: { not: null } },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),
    ])

    // Build category comparison
    const lastMonthMap = new Map(
      lastMonthSpending.map((s) => [s.category, s._sum.amount ?? 0])
    )

    const categoryComparison = thisMonthSpending.map((s) => {
      const thisAmount = s._sum.amount ?? 0
      const lastAmount = lastMonthMap.get(s.category) ?? 0
      // FIX Bug 7: Show null for new categories instead of 0%
      const change = lastAmount > 0 ? ((thisAmount - lastAmount) / lastAmount) * 100 : (thisAmount > 0 ? null : 0)

      return {
        category: s.category,
        thisMonth: Math.round(thisAmount * 100) / 100,
        lastMonth: Math.round(lastAmount * 100) / 100,
        changePercent: change != null ? Math.round(change * 10) / 10 : null,
      }
    }).sort((a, b) => b.thisMonth - a.thisMonth)

    const totalSpending = thisMonthSpending.reduce((s, c) => s + (c._sum.amount ?? 0), 0)
    const totalIncome = Math.abs(thisMonthIncome._sum.amount ?? 0)
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpending) / totalIncome) * 100 : 0

    const result = {
      totalSpending: Math.round(totalSpending * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      lastMonthSpending: Math.round(lastMonthSpending.reduce((s, c) => s + (c._sum.amount ?? 0), 0) * 100) / 100,
      lastMonthIncome: Math.round(Math.abs(lastMonthIncome._sum.amount ?? 0) * 100) / 100,
      savingsRate: Math.round(savingsRate * 10) / 10,
      categoryComparison,
      topMerchants: topMerchants.map((m) => ({
        merchantName: m.merchantName,
        total: Math.round((m._sum.amount ?? 0) * 100) / 100,
        count: m._count,
      })),
    }
    setCache(cacheKey, result, CACHE_TTL)
    return NextResponse.json(result)
  } catch (err) {
    return apiError("F8002", "Failed to generate insights", 500, err)
  }
}
