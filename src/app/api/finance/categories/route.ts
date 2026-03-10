import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { FINANCE_CATEGORIES } from "@/lib/finance/categories"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

/**
 * GET /api/finance/categories
 * Returns merged hardcoded + user custom categories.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("CAT01", "Authentication required", 401)

  try {
    const custom = await db.financeCustomCategory.findMany({
      where: { userId: user.id },
      select: { id: true, label: true, icon: true, hex: true },
      orderBy: { createdAt: "asc" },
    })

    const builtIn = Object.entries(FINANCE_CATEGORIES).map(([key, meta]) => ({
      id: null,
      label: key,
      icon: meta.icon,
      hex: meta.hex,
      isCustom: false,
    }))

    const customMapped = custom.map((c) => ({
      id: c.id,
      label: c.label,
      icon: c.icon,
      hex: c.hex,
      isCustom: true,
    }))

    return NextResponse.json({ categories: [...builtIn, ...customMapped] })
  } catch (err) {
    return apiError("CAT02", "Failed to fetch categories", 500, err)
  }
}

const createSchema = z.object({
  label: z.string().min(1).max(50),
  icon: z.string().optional(),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

/**
 * POST /api/finance/categories
 * Create a custom category.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("CAT03", "Authentication required", 401)

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("CAT04", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { label, icon, hex } = parsed.data

  // Prevent duplicating a built-in category
  if (FINANCE_CATEGORIES[label]) {
    return apiError("CAT05", `"${label}" already exists as a built-in category`, 409)
  }

  try {
    const created = await db.financeCustomCategory.create({
      data: {
        userId: user.id,
        label,
        ...(icon ? { icon } : {}),
        ...(hex ? { hex } : {}),
      },
      select: { id: true, label: true, icon: true, hex: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err: unknown) {
    const prismaErr = err as { code?: string }
    if (prismaErr.code === "P2002") {
      return apiError("CAT06", `Custom category "${label}" already exists`, 409)
    }
    return apiError("CAT07", "Failed to create category", 500, err)
  }
}

/**
 * DELETE /api/finance/categories
 * Delete a custom category by id (passed as query param).
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("CAT08", "Authentication required", 401)

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return apiError("CAT09", "Missing category id", 400)

  try {
    const existing = await db.financeCustomCategory.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) return apiError("CAT10", "Category not found", 404)

    await db.financeCustomCategory.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    return apiError("CAT11", "Failed to delete category", 500, err)
  }
}
