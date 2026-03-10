import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { financeRateLimiters, rateLimitHeaders } from "@/lib/rate-limit"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const bulkSchema = z.object({
  transactionIds: z.array(z.string()).min(1, "At least one transactionId required").max(500, "Maximum 500 transactions per request"),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  isExcluded: z.boolean().optional(),
  tags: z.array(z.string()).max(20).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F4020", "Authentication required", 401)

  const rl = financeRateLimiters.bulkUpdate(`bulk:${user.id}`)
  if (!rl.success) {
    return apiError("F4025", "Rate limit exceeded", 429, undefined, rateLimitHeaders(rl))
  }

  const body = await req.json()
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F4021", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { transactionIds, category, subcategory, isExcluded, tags } = parsed.data

  try {
    const result = await db.financeTransaction.updateMany({
      where: {
        id: { in: transactionIds },
        userId: user.id,
      },
      data: {
        ...(category !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
        ...(isExcluded !== undefined && { isExcluded }),
        ...(tags !== undefined && { tags }),
      },
    })

    return NextResponse.json({ updated: result.count })
  } catch (err) {
    const mapped = mapFinanceError(err, "Bulk update failed")
    return apiError("F4022", mapped.message, mapped.status, err)
  }
}
