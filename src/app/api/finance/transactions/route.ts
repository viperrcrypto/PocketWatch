import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { NextResponse, type NextRequest } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { z } from "zod/v4"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F4001", "Authentication required", 401)

  const { searchParams } = new URL(req.url)

  const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    category: z.string().max(100).optional(),
    accountId: z.string().max(100).optional(),
    search: z.string().max(200).optional(),
    minAmount: z.coerce.number().finite().optional(),
    maxAmount: z.coerce.number().finite().optional(),
    sort: z.enum(["date", "amount", "merchant"]).default("date"),
    order: z.enum(["asc", "desc"]).default("desc"),
    includeExcluded: z.enum(["true", "false"]).default("false"),
  })

  const qp = querySchema.safeParse(Object.fromEntries(searchParams.entries()))
  if (!qp.success) {
    return apiError("F4003", qp.error.issues[0]?.message ?? "Invalid query parameters", 400)
  }

  const { page, limit, startDate, endDate, category, accountId, search, minAmount, maxAmount, sort, order, includeExcluded } = qp.data

  try {
    const where: Prisma.FinanceTransactionWhereInput = {
      userId: user.id,
      isDuplicate: false,
      ...(includeExcluded !== "true" && { isExcluded: false }),
    }

    if (startDate) where.date = { ...((where.date as object) ?? {}), gte: new Date(startDate) }
    if (endDate) where.date = { ...((where.date as object) ?? {}), lte: new Date(endDate) }
    if (category) where.category = category
    if (accountId) where.accountId = accountId
    if (search) {
      where.OR = [
        { merchantName: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ]
    }
    if (minAmount !== undefined) where.amount = { ...((where.amount as object) ?? {}), gte: minAmount }
    if (maxAmount !== undefined) where.amount = { ...((where.amount as object) ?? {}), lte: maxAmount }

    const orderBy: Prisma.FinanceTransactionOrderByWithRelationInput =
      sort === "amount" ? { amount: order } :
      sort === "merchant" ? { merchantName: order } :
      { date: order }

    const [transactions, total] = await Promise.all([
      db.financeTransaction.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          account: {
            select: { name: true, institutionId: true, mask: true },
          },
        },
      }),
      db.financeTransaction.count({ where }),
    ])

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    return apiError("F4002", "Failed to fetch transactions", 500, err)
  }
}

const patchSchema = z.object({
  transactionId: z.string().min(1, "transactionId required"),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).max(20).optional(),
  isExcluded: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F4010", "Authentication required", 401)

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F4011", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { transactionId, category, subcategory, notes, tags, isExcluded } = parsed.data

  try {
    const tx = await db.financeTransaction.findFirst({
      where: { id: transactionId, userId: user.id },
    })
    if (!tx) return apiError("F4012", "Transaction not found", 404)

    const updated = await db.financeTransaction.update({
      where: { id: transactionId },
      data: {
        ...(category !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
        ...(notes !== undefined && { notes }),
        ...(tags !== undefined && { tags }),
        ...(isExcluded !== undefined && { isExcluded }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to update transaction")
    return apiError("F4013", mapped.message, mapped.status, err)
  }
}
