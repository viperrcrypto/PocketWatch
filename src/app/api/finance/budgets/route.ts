import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F5001", "Authentication required", 401)

  try {
    const budgets = await db.financeBudget.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { category: "asc" },
    })

    // Get current month spending per category
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const spending = await db.financeTransaction.groupBy({
      by: ["category"],
      where: {
        userId: user.id,
        date: { gte: monthStart, lte: monthEnd },
        amount: { gt: 0 },
        isExcluded: false,
        isDuplicate: false,
      },
      _sum: { amount: true },
    })

    const spendingMap = new Map(
      spending.map((s) => [s.category, s._sum.amount ?? 0])
    )

    const result = budgets.map((b) => ({
      ...b,
      spent: spendingMap.get(b.category) ?? 0,
      remaining: b.monthlyLimit - (spendingMap.get(b.category) ?? 0),
      percentUsed:
        b.monthlyLimit > 0
          ? ((spendingMap.get(b.category) ?? 0) / b.monthlyLimit) * 100
          : 0,
    }))

    return NextResponse.json(result)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to fetch budgets")
    return apiError("F5002", mapped.message, mapped.status, err)
  }
}

const createSchema = z.object({
  category: z.string().min(1, "Category is required"),
  monthlyLimit: z.number().positive("Monthly limit must be positive"),
  rollover: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F5010", "Authentication required", 401)

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F5011", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { category, monthlyLimit, rollover } = parsed.data

  try {
    const budget = await db.financeBudget.upsert({
      where: { userId_category: { userId: user.id, category } },
      create: {
        userId: user.id,
        category,
        monthlyLimit,
        rollover: rollover ?? false,
      },
      update: { monthlyLimit, rollover: rollover ?? false, isActive: true },
    })

    return NextResponse.json(budget)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to create budget")
    return apiError("F5012", mapped.message, mapped.status, err)
  }
}

const patchSchema = z.object({
  budgetId: z.string().min(1, "budgetId required"),
  monthlyLimit: z.number().positive().optional(),
  rollover: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F5020", "Authentication required", 401)

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F5021", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { budgetId, monthlyLimit, rollover, isActive } = parsed.data

  try {
    const budget = await db.financeBudget.findFirst({
      where: { id: budgetId, userId: user.id },
    })
    if (!budget) return apiError("F5022", "Budget not found", 404)

    const updated = await db.financeBudget.update({
      where: { id: budgetId },
      data: {
        ...(monthlyLimit !== undefined && { monthlyLimit }),
        ...(rollover !== undefined && { rollover }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to update budget")
    return apiError("F5023", mapped.message, mapped.status, err)
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F5030", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const budgetId = searchParams.get("budgetId")
  if (!budgetId) return apiError("F5031", "budgetId required", 400)

  try {
    await db.financeBudget.deleteMany({
      where: { id: budgetId, userId: user.id },
    })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to delete budget")
    return apiError("F5032", mapped.message, mapped.status, err)
  }
}
