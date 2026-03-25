import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { needsReviewWhere, cleanMerchantName, suggestCategories } from "@/lib/finance/categorize"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/finance/transactions/review
 * Returns transactions needing human review (auto-applied with <0.8 confidence).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F9100", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50)
  const offset = parseInt(searchParams.get("offset") ?? "0")
  const countOnly = searchParams.get("countOnly") === "true"

  try {
    const where = needsReviewWhere(user.id)

    if (countOnly) {
      const count = await db.financeTransaction.count({ where })
      return NextResponse.json({ count })
    }

    const [transactions, total] = await Promise.all([
      db.financeTransaction.findMany({
        where,
        select: {
          id: true,
          merchantName: true,
          name: true,
          amount: true,
          date: true,
          category: true,
          subcategory: true,
          logoUrl: true,
          plaidCategory: true,
          plaidCategoryPrimary: true,
          isAutoApplied: true,
          account: { select: { name: true, mask: true, type: true, subtype: true } },
        },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      db.financeTransaction.count({ where }),
    ])

    // Load rules for suggestions
    const userRules = await db.financeCategoryRule.findMany({
      where: { userId: user.id },
      orderBy: { priority: "desc" },
    })

    const enriched = transactions.map((tx) => {
      const cleaned = cleanMerchantName(tx.merchantName ?? tx.name)
      const suggestions = suggestCategories(
        {
          merchantName: cleaned,
          rawName: tx.name,
          plaidCategory: tx.plaidCategory,
          amount: tx.amount,
          accountType: tx.account.type,
          accountSubtype: tx.account.subtype,
        },
        userRules
      )

      return {
        id: tx.id,
        merchantName: tx.merchantName,
        name: tx.name,
        cleanedName: cleaned,
        amount: tx.amount,
        date: tx.date,
        currentCategory: tx.category,
        currentSubcategory: tx.subcategory,
        logoUrl: tx.logoUrl,
        accountName: tx.account.name,
        accountMask: tx.account.mask,
        suggestedCategories: suggestions,
      }
    })

    return NextResponse.json({
      transactions: enriched,
      total,
      hasMore: offset + limit < total,
    })
  } catch (err) {
    return apiError("F9101", "Failed to load review queue", 500, err)
  }
}
