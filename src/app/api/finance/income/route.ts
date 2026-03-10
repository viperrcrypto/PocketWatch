import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET: Return the user's income setting.
 * Returns both the manual override (if set) and the estimated income from transactions.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("FI001", "Authentication required", 401)

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { monthlyIncomeOverride: true },
  })

  // Estimate income from current month transactions
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const result = await db.financeTransaction.aggregate({
    where: {
      userId: user.id,
      date: { gte: monthStart, lt: monthEnd },
      amount: { lt: 0 },
      isDuplicate: false,
      isExcluded: false,
    },
    _sum: { amount: true },
  })

  const estimatedIncome = Math.abs(result._sum.amount ?? 0)

  return NextResponse.json({
    override: fullUser?.monthlyIncomeOverride ?? null,
    estimated: Math.round(estimatedIncome * 100) / 100,
    effective: fullUser?.monthlyIncomeOverride ?? estimatedIncome,
  })
}

/**
 * POST: Set or clear the manual income override.
 * Body: { monthlyIncome: number | null }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("FI002", "Authentication required", 401)

  const body = await req.json().catch(() => null)
  if (body === null) return apiError("FI003", "Invalid request body", 400)

  const monthlyIncome = body.monthlyIncome

  if (monthlyIncome !== null && (typeof monthlyIncome !== "number" || monthlyIncome < 0)) {
    return apiError("FI004", "monthlyIncome must be a positive number or null", 400)
  }

  await db.user.update({
    where: { id: user.id },
    data: { monthlyIncomeOverride: monthlyIncome },
  })

  return NextResponse.json({ monthlyIncomeOverride: monthlyIncome })
}
