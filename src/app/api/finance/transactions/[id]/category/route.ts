import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { cleanMerchantName } from "@/lib/finance/categorize"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const patchSchema = z.object({
  category: z.string().min(1),
  subcategory: z.string().optional(),
  nickname: z.string().optional(),
  createRule: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return apiError("F4030", "Authentication required", 401)

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F4031", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { category, subcategory, nickname, createRule } = parsed.data

  try {
    const tx = await db.financeTransaction.findFirst({
      where: { id, userId: user.id },
    })
    if (!tx) return apiError("F4032", "Transaction not found", 404)

    // Update transaction category + optional nickname
    const updated = await db.financeTransaction.update({
      where: { id },
      data: {
        category,
        subcategory: subcategory ?? null,
        ...(nickname !== undefined ? { nickname: nickname || null } : {}),
      },
    })

    // Optionally create a category rule for this merchant
    if (createRule && tx.merchantName) {
      const cleaned = cleanMerchantName(tx.merchantName)
      if (cleaned.length > 1) {
        const existing = await db.financeCategoryRule.findFirst({
          where: {
            userId: user.id,
            matchType: "contains",
            matchValue: cleaned,
          },
        })

        const ruleData = {
          category,
          subcategory: subcategory ?? null,
          ...(nickname !== undefined ? { nickname: nickname || null } : {}),
        }

        if (existing) {
          await db.financeCategoryRule.update({
            where: { id: existing.id },
            data: ruleData,
          })
        } else {
          await db.financeCategoryRule.create({
            data: {
              userId: user.id,
              matchType: "contains",
              matchValue: cleaned,
              ...ruleData,
              priority: 10,
            },
          })
        }

        // Batch-apply to other uncategorized transactions with the same merchant
        await db.financeTransaction.updateMany({
          where: {
            userId: user.id,
            id: { not: id },
            OR: [{ category: null }, { category: "" }, { category: "Uncategorized" }],
            name: { contains: cleaned, mode: "insensitive" },
          },
          data: {
            category,
            subcategory: subcategory ?? null,
            ...(nickname !== undefined ? { nickname: nickname || null } : {}),
          },
        })
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    return apiError("F4033", "Failed to update category", 500, err)
  }
}
