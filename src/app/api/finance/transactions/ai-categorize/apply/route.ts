import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { invalidateCache } from "@/lib/cache"
import { db } from "@/lib/db"
import { CATEGORIES, cleanMerchantName, uncategorizedWhere } from "@/lib/finance/categorize"
import { financeRateLimiters, getClientId } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

const acceptedItemSchema = z.object({
  transactionIds: z.array(z.string().min(1)),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  createRule: z.boolean().optional(),
  merchantName: z.string().min(1),
})

const bodySchema = z.object({
  accepted: z.array(acceptedItemSchema).min(1).max(200),
})

/**
 * POST /api/finance/transactions/ai-categorize/apply
 * Applies user-approved AI categorization suggestions in bulk.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACA01", "Authentication required", 401)

  const rl = financeRateLimiters.bulkUpdate(getClientId(request))
  if (!rl.success) {
    return apiError("ACA02", "Rate limit exceeded", 429)
  }

  const body = await request.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError("ACA03", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const validCategories = new Set(Object.keys(CATEGORIES))
  const { accepted } = parsed.data

  // Validate all categories
  for (const item of accepted) {
    if (!validCategories.has(item.category)) {
      return apiError("ACA04", `Invalid category: ${item.category}`, 400)
    }
  }

  try {
    let rulesCreated = 0

    await db.$transaction(async (tx) => {
      // Batch update all transaction categories
      for (const item of accepted) {
        await tx.financeTransaction.updateMany({
          where: {
            id: { in: item.transactionIds },
            userId: user.id,
          },
          data: {
            category: item.category,
            subcategory: item.subcategory ?? null,
          },
        })

        // Create or update rule if requested
        if (item.createRule) {
          const cleaned = cleanMerchantName(item.merchantName)
          if (cleaned.length > 1) {
            const existing = await tx.financeCategoryRule.findFirst({
              where: { userId: user.id, matchType: "contains", matchValue: cleaned },
            })
            if (existing) {
              await tx.financeCategoryRule.update({
                where: { id: existing.id },
                data: { category: item.category, subcategory: item.subcategory ?? null },
              })
            } else {
              await tx.financeCategoryRule.create({
                data: {
                  userId: user.id,
                  matchType: "contains",
                  matchValue: cleaned,
                  category: item.category,
                  subcategory: item.subcategory ?? null,
                  priority: 10,
                },
              })
            }
            rulesCreated++
          }
        }
      }
    })

    // Invalidate cached insights/suggestions since categories changed
    invalidateCache(`deep-insights:${user.id}`)
    invalidateCache(`budget-suggest:${user.id}`)
    invalidateCache(`budget-ai:${user.id}`)

    // Count remaining uncategorized
    const remaining = await db.financeTransaction.count({
      where: uncategorizedWhere(user.id),
    })

    return NextResponse.json({
      applied: accepted.reduce((sum, a) => sum + a.transactionIds.length, 0),
      rulesCreated,
      remaining,
    })
  } catch (err) {
    return apiError("ACA05", "Failed to apply categorizations", 500, err)
  }
}
