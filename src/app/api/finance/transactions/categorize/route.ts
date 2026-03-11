import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { invalidateCache } from "@/lib/cache"
import { db } from "@/lib/db"
import { categorizeTransaction, cleanMerchantName, uncategorizedWhere } from "@/lib/finance/categorize"
import { NextResponse } from "next/server"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("F4020", "Authentication required", 401)

  try {
    // Find uncategorized transactions
    const where = uncategorizedWhere(user.id)
    const uncategorized = await db.financeTransaction.findMany({
      where,
      select: {
        id: true,
        merchantName: true,
        name: true,
        plaidCategory: true,
        amount: true,
      },
      take: 500, // batch limit
    })

    if (uncategorized.length === 0) {
      return NextResponse.json({ categorized: 0, remaining: 0 })
    }

    // Fetch user rules
    const userRules = await db.financeCategoryRule.findMany({
      where: { userId: user.id },
      orderBy: { priority: "desc" },
    })

    // Batch updates via $transaction (N+1 → single batch)
    const updates = []
    for (const tx of uncategorized) {
      const cleaned = cleanMerchantName(tx.merchantName ?? tx.name)
      const result = categorizeTransaction(
        { merchantName: cleaned, rawName: tx.name, plaidCategory: tx.plaidCategory, amount: tx.amount },
        userRules
      )

      if (result.category !== "Uncategorized") {
        updates.push(
          db.financeTransaction.update({
            where: { id: tx.id },
            data: { category: result.category, subcategory: result.subcategory },
          })
        )
      }
    }

    await db.$transaction(updates)

    // Invalidate cached insights/suggestions since categories changed
    if (updates.length > 0) {
      invalidateCache(`deep-insights:${user.id}`)
      invalidateCache(`budget-suggest:${user.id}`)
      invalidateCache(`budget-ai:${user.id}`)
    }

    // Count remaining uncategorized
    const remaining = await db.financeTransaction.count({ where })

    return NextResponse.json({ categorized: updates.length, remaining })
  } catch (err) {
    return apiError("F4021", "Failed to auto-categorize", 500, err)
  }
}
