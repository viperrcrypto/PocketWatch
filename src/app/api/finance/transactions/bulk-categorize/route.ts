/**
 * POST /api/finance/transactions/bulk-categorize
 * Recategorize multiple transactions at once.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { FINANCE_CATEGORIES } from "@/lib/finance/categories"
import { invalidateCache } from "@/lib/cache"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  category: z.string().min(1),
  createRule: z.boolean().optional(),
})

const validCategories = new Set(Object.keys(FINANCE_CATEGORIES))

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("BK001", "Authentication required", 401)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return apiError("BK002", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { ids, category, createRule } = parsed.data

  // Allow custom categories (user-created) in addition to built-in ones
  const customCats = await db.financeCustomCategory.findMany({
    where: { userId: user.id },
    select: { label: true },
  })
  const allValid = new Set([...validCategories, ...customCats.map((c) => c.label)])

  if (!allValid.has(category)) {
    return apiError("BK003", `Invalid category: ${category}`, 400)
  }

  try {
    const result = await db.financeTransaction.updateMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
      data: {
        category,
        needsReview: false,
        reviewSkippedAt: null,
        // Mark as user-set so a later Plaid "modified" sync won't re-categorize it.
        isAutoApplied: false,
      },
    })

    // Optionally create a confidence rule from the first transaction's merchant
    if (createRule && ids.length > 0) {
      const sample = await db.financeTransaction.findFirst({
        where: { id: ids[0], userId: user.id },
        select: { merchantName: true, name: true },
      })
      const merchant = sample?.merchantName ?? sample?.name
      if (merchant) {
        const existing = await db.financeCategoryRule.findFirst({
          where: { userId: user.id, matchValue: merchant.toUpperCase(), matchType: "contains" },
        })
        if (existing) {
          await db.financeCategoryRule.update({
            where: { id: existing.id },
            data: { category, confidence: 0.7 },
          }).catch(() => {})
        } else {
          await db.financeCategoryRule.create({
            data: { userId: user.id, matchValue: merchant.toUpperCase(), matchType: "contains", category, confidence: 0.7, source: "user" },
          }).catch(() => {})
        }
      }
    }

    invalidateCache("spending")
    invalidateCache("insights")
    invalidateCache("trends")
    invalidateCache("budgets")

    return NextResponse.json({ updated: result.count })
  } catch (err) {
    return apiError("BK004", "Failed to update transactions", 500, err)
  }
}
