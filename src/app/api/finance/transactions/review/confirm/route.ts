import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { cleanMerchantName, computeNewConfidence, CONFIDENCE } from "@/lib/finance/categorize"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

const bodySchema = z.object({
  transactionId: z.string().min(1),
  action: z.enum(["accept", "change", "skip"]),
  category: z.string().optional(),
  subcategory: z.string().optional(),
})

/**
 * POST /api/finance/transactions/review/confirm
 * Handles accept/change/skip actions from the review flow.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F9200", "Authentication required", 401)

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F9201", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { transactionId, action, category, subcategory } = parsed.data

  try {
    const tx = await db.financeTransaction.findFirst({
      where: { id: transactionId, userId: user.id },
    })
    if (!tx) return apiError("F9202", "Transaction not found", 404)

    if (action === "skip") {
      await db.financeTransaction.update({
        where: { id: transactionId },
        data: { reviewSkippedAt: new Date() },
      })
      return NextResponse.json({ action: "skipped" })
    }

    if (action === "accept") {
      // User confirms the auto-applied category is correct
      await db.financeTransaction.update({
        where: { id: transactionId },
        data: { needsReview: false },
      })

      // Bump confidence on the matching rule
      if (tx.merchantName) {
        const cleaned = cleanMerchantName(tx.merchantName)
        const rule = await db.financeCategoryRule.findFirst({
          where: { userId: user.id, matchValue: cleaned, category: tx.category! },
        })
        if (rule) {
          const newConf = computeNewConfidence(rule.confidence, "confirmed")
          await db.financeCategoryRule.update({
            where: { id: rule.id },
            data: {
              confidence: newConf,
              timesConfirmed: { increment: 1 },
              lastUsedAt: new Date(),
            },
          })

          // If rule crossed AUTO_APPLY threshold, clear review on all matching txns
          if (newConf >= CONFIDENCE.AUTO_APPLY && rule.confidence < CONFIDENCE.AUTO_APPLY) {
            await db.financeTransaction.updateMany({
              where: {
                userId: user.id,
                needsReview: true,
                category: tx.category,
                name: { contains: cleaned, mode: "insensitive" },
              },
              data: { needsReview: false },
            })
          }

          return NextResponse.json({ action: "accepted", confidence: newConf })
        }
      }

      return NextResponse.json({ action: "accepted" })
    }

    // action === "change"
    if (!category) {
      return apiError("F9203", "Category required for change action", 400)
    }

    // Penalize the old rule
    if (tx.merchantName && tx.category) {
      const cleaned = cleanMerchantName(tx.merchantName)
      const oldRule = await db.financeCategoryRule.findFirst({
        where: { userId: user.id, matchValue: cleaned, category: tx.category },
      })
      if (oldRule) {
        await db.financeCategoryRule.update({
          where: { id: oldRule.id },
          data: {
            confidence: computeNewConfidence(oldRule.confidence, "overridden"),
            timesOverridden: { increment: 1 },
            lastUsedAt: new Date(),
          },
        })
      }
    }

    // Update transaction with new category
    await db.financeTransaction.update({
      where: { id: transactionId },
      data: {
        category,
        subcategory: subcategory ?? null,
        isAutoApplied: false,
        needsReview: false,
      },
    })

    // Create/update rule for the new category
    if (tx.merchantName) {
      const cleaned = cleanMerchantName(tx.merchantName)
      if (cleaned.length > 1) {
        const existing = await db.financeCategoryRule.findFirst({
          where: { userId: user.id, matchType: "contains", matchValue: cleaned },
        })
        if (existing) {
          await db.financeCategoryRule.update({
            where: { id: existing.id },
            data: {
              category,
              subcategory: subcategory ?? null,
              confidence: CONFIDENCE.INITIAL_USER,
              source: "user",
              lastUsedAt: new Date(),
            },
          })
        } else {
          await db.financeCategoryRule.create({
            data: {
              userId: user.id,
              matchType: "contains",
              matchValue: cleaned,
              category,
              subcategory: subcategory ?? null,
              priority: 10,
              confidence: CONFIDENCE.INITIAL_USER,
              source: "user",
            },
          })
        }
      }
    }

    return NextResponse.json({ action: "changed", category })
  } catch (err) {
    return apiError("F9204", "Failed to confirm review", 500, err)
  }
}
