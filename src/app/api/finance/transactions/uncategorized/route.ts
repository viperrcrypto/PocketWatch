import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { cleanMerchantName, suggestCategories, uncategorizedWhere, type CategoryRule, type CategorySuggestion } from "@/lib/finance/categorize"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/finance/transactions/uncategorized
 * Returns uncategorized transactions with pre-computed category suggestions.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("UC01", "Authentication required", 401)

  const params = request.nextUrl.searchParams
  const limit = Math.min(Number(params.get("limit")) || 20, 50)
  const offset = Number(params.get("offset")) || 0

  try {
    const where = uncategorizedWhere(user.id)

    const [transactions, total] = await Promise.all([
      db.financeTransaction.findMany({
        where,
        select: {
          id: true,
          merchantName: true,
          name: true,
          amount: true,
          date: true,
          plaidCategory: true,
          logoUrl: true,
          account: { select: { name: true, mask: true } },
        },
        orderBy: { date: "desc" },
        skip: offset,
        take: limit,
      }),
      db.financeTransaction.count({ where }),
    ])

    // Fetch user rules once
    const userRules: CategoryRule[] = await db.financeCategoryRule.findMany({
      where: { userId: user.id },
      orderBy: { priority: "desc" },
    })

    // Build correction history: most common category per cleaned merchant name
    const categorized = await db.financeTransaction.groupBy({
      by: ["merchantName", "category"],
      where: {
        userId: user.id,
        category: { not: null, notIn: ["", "Uncategorized"] },
        merchantName: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    })

    const correctionHistory = new Map<string, string>()
    for (const row of categorized) {
      if (!row.merchantName || !row.category) continue
      const key = cleanMerchantName(row.merchantName).toUpperCase()
      if (!correctionHistory.has(key)) {
        correctionHistory.set(key, row.category)
      }
    }

    // Top-used categories for padding suggestions (user's most frequently used)
    const topUsedRaw = await db.financeTransaction.groupBy({
      by: ["category"],
      where: {
        userId: user.id,
        category: { not: null, notIn: ["", "Uncategorized"] },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    })
    const topUsedCategories = topUsedRaw
      .filter((r) => r.category != null)
      .map((r) => r.category as string)

    // Group by cleaned merchant to avoid redundant computation
    const merchantSuggestionCache = new Map<string, CategorySuggestion[]>()

    const enriched = transactions.map((tx) => {
      const cleaned = cleanMerchantName(tx.merchantName ?? tx.name)
      const cacheKey = cleaned.toUpperCase()

      let suggestions = merchantSuggestionCache.get(cacheKey)
      if (!suggestions) {
        suggestions = suggestCategories(
          { merchantName: cleaned, rawName: tx.name, plaidCategory: tx.plaidCategory, amount: tx.amount },
          userRules,
          correctionHistory,
          topUsedCategories
        )
        merchantSuggestionCache.set(cacheKey, suggestions)
      }

      return {
        id: tx.id,
        merchantName: tx.merchantName,
        name: tx.name,
        cleanedName: cleaned,
        amount: tx.amount,
        date: tx.date,
        logoUrl: tx.logoUrl,
        accountName: tx.account?.name ?? null,
        accountMask: tx.account?.mask ?? null,
        suggestedCategories: suggestions,
      }
    })

    return NextResponse.json({
      transactions: enriched,
      total,
      hasMore: offset + limit < total,
    })
  } catch (err) {
    return apiError("UC02", "Failed to fetch uncategorized transactions", 500, err)
  }
}
