import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F8020", "Authentication required", 401)

  try {
    const rules = await db.financeCategoryRule.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    })
    return NextResponse.json(rules)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to fetch rules")
    return apiError("F8021", mapped.message, mapped.status, err)
  }
}

const createRuleSchema = z.object({
  matchType: z.enum(["contains", "exact", "starts_with"]),
  matchValue: z.string().min(1, "Match value is required").max(200),
  category: z.string().min(1, "Category is required").max(100),
  subcategory: z.string().max(100).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F8030", "Authentication required", 401)

  const body = await req.json()
  const parsed = createRuleSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F8031", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  try {
    const rule = await db.financeCategoryRule.create({
      data: {
        userId: user.id,
        matchType: parsed.data.matchType,
        matchValue: parsed.data.matchValue,
        category: parsed.data.category,
        subcategory: parsed.data.subcategory ?? null,
        priority: parsed.data.priority ?? 0,
      },
    })
    return NextResponse.json(rule)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to create rule")
    return apiError("F8032", mapped.message, mapped.status, err)
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F8040", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const ruleId = searchParams.get("ruleId")
  if (!ruleId) return apiError("F8041", "ruleId required", 400)

  try {
    await db.financeCategoryRule.deleteMany({
      where: { id: ruleId, userId: user.id },
    })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to delete rule")
    return apiError("F8042", mapped.message, mapped.status, err)
  }
}
