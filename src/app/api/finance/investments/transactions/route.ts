import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("FIT10", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)))
  const type = searchParams.get("type")

  try {
    const where: any = { userId: user.id }
    if (type) where.type = type

    const [transactions, total] = await Promise.all([
      db.financeInvestmentTransaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.financeInvestmentTransaction.count({ where }),
    ])

    // Join with securities
    const secIds = [...new Set(transactions.map((t) => t.securityId).filter(Boolean))] as string[]
    const securities = await db.financeInvestmentSecurity.findMany({
      where: { userId: user.id, securityId: { in: secIds } },
      select: { securityId: true, name: true, tickerSymbol: true, type: true },
    })
    const secMap = new Map(securities.map((s) => [s.securityId, s]))

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        ...t,
        security: secMap.get(t.securityId ?? "") ?? null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    return apiError("FIT11", "Failed to fetch investment transactions", 500, err)
  }
}
