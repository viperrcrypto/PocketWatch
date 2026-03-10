import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const monthParam = z.string().regex(/^\d{4}-\d{2}$/).optional()

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F8050", "Authentication required", 401)

  try {
    const rawMonth = request.nextUrl.searchParams.get("month") ?? undefined
    const parsed = monthParam.safeParse(rawMonth)
    if (!parsed.success) {
      return apiError("F8051", "Invalid month format. Use YYYY-MM.", 400)
    }

    // Discover months that have spending data
    const monthRows = await db.$queryRaw<Array<{ month: string }>>`
      SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') AS month
      FROM "FinanceTransaction"
      WHERE "userId" = ${user.id}
        AND "isDuplicate" = false
        AND "isExcluded" = false
        AND amount > 0
      ORDER BY month DESC
    `
    const availableMonths = monthRows.map((r) => r.month)

    if (availableMonths.length === 0) {
      return NextResponse.json({
        month: null,
        categories: [],
        totalSpending: 0,
        availableMonths: [],
      })
    }

    // Use requested month if valid, otherwise latest
    const targetMonth =
      rawMonth && availableMonths.includes(rawMonth)
        ? rawMonth
        : availableMonths[0]

    const [yearStr, monthStr] = targetMonth.split("-")
    const year = Number(yearStr)
    const month = Number(monthStr)
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 1) // exclusive

    const spending = await db.financeTransaction.groupBy({
      by: ["category"],
      where: {
        userId: user.id,
        date: { gte: monthStart, lt: monthEnd },
        amount: { gt: 0 },
        isExcluded: false,
        isDuplicate: false,
      },
      _sum: { amount: true },
    })

    const categories = spending
      .map((s) => ({
        category: s.category ?? "Uncategorized",
        total: Math.round((s._sum.amount ?? 0) * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total)

    const totalSpending = categories.reduce((sum, c) => sum + c.total, 0)

    return NextResponse.json({
      month: targetMonth,
      categories,
      totalSpending: Math.round(totalSpending * 100) / 100,
      availableMonths,
    })
  } catch (err) {
    return apiError("F8052", "Failed to fetch monthly spending", 500, err)
  }
}
