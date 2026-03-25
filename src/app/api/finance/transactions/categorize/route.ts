import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { invalidateCache } from "@/lib/cache"
import { db } from "@/lib/db"
import { categorizeTransaction, cleanMerchantName, uncategorizedWhere, CONFIDENCE } from "@/lib/finance/categorize"
import { NextResponse } from "next/server"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("F4020", "Authentication required", 401)

  try {
    const where = uncategorizedWhere(user.id)
    const uncategorized = await db.financeTransaction.findMany({
      where,
      select: {
        id: true,
        merchantName: true,
        name: true,
        plaidCategory: true,
        plaidCategoryPrimary: true,
        amount: true,
        account: { select: { type: true, subtype: true } },
      },
      take: 500,
    })

    if (uncategorized.length === 0) {
      return NextResponse.json({ categorized: 0, remaining: 0 })
    }

    const userRules = await db.financeCategoryRule.findMany({
      where: { userId: user.id },
      orderBy: { priority: "desc" },
    })

    const updates = []
    for (const tx of uncategorized) {
      const cleaned = cleanMerchantName(tx.merchantName ?? tx.name)
      const result = categorizeTransaction(
        {
          merchantName: cleaned,
          rawName: tx.name,
          plaidCategory: tx.plaidCategory,
          plaidCategoryPrimary: tx.plaidCategoryPrimary,
          amount: tx.amount,
          accountType: tx.account.type,
          accountSubtype: tx.account.subtype,
        },
        userRules
      )

      if (result.category !== "Uncategorized") {
        const isAutoApplied = result.source === "rule" || result.source === "keyword"
        const needsReview = result.needsReview && result.confidence < CONFIDENCE.AUTO_APPLY
        updates.push(
          db.financeTransaction.update({
            where: { id: tx.id },
            data: {
              category: result.category,
              subcategory: result.subcategory,
              isAutoApplied,
              needsReview,
            },
          })
        )
      }
    }

    await db.$transaction(updates)

    if (updates.length > 0) {
      invalidateCache(`deep-insights:${user.id}`)
      invalidateCache(`budget-suggest:${user.id}`)
      invalidateCache(`budget-ai:${user.id}`)
    }

    const remaining = await db.financeTransaction.count({ where })
    return NextResponse.json({ categorized: updates.length, remaining })
  } catch (err) {
    return apiError("F4021", "Failed to auto-categorize", 500, err)
  }
}
