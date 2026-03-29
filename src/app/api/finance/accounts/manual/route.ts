import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import { randomBytes } from "crypto"

const VALID_TYPES = ["checking", "savings", "credit"] as const

const createSchema = z.object({
  name: z.string().min(1, "Account name required").max(200),
  mask: z.string().max(4).optional(),
  type: z.enum(VALID_TYPES).optional().default("credit"),
})

/**
 * POST /api/finance/accounts/manual — create a manual account
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F3040", "Authentication required", 401)

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F3041", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { name, mask, type } = parsed.data

  try {
    // Each manual account gets its own institution (named after the account)
    const institution = await db.financeInstitution.create({
      data: {
        userId: user.id,
        provider: "manual",
        institutionName: name,
        status: "active",
      },
    })

    const externalId = `manual_${Date.now()}_${randomBytes(6).toString("hex")}`

    const account = await db.financeAccount.create({
      data: {
        userId: user.id,
        institutionId: institution.id,
        externalId,
        name,
        type,
        mask: mask || null,
        currency: "USD",
      },
    })

    return NextResponse.json({
      id: account.id,
      name: account.name,
      type: account.type,
      mask: account.mask,
      institutionId: institution.id,
      institutionName: institution.institutionName,
    })
  } catch (err) {
    return apiError("F3042", "Failed to create manual account", 500, err)
  }
}

/**
 * GET /api/finance/accounts/manual — list manual accounts with tx counts
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F3043", "Authentication required", 401)

  try {
    const accounts = await db.financeAccount.findMany({
      where: {
        userId: user.id,
        institution: { provider: "manual" },
      },
      select: {
        id: true,
        name: true,
        type: true,
        mask: true,
        createdAt: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(
      accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        mask: a.mask,
        createdAt: a.createdAt,
        transactionCount: a._count.transactions,
      }))
    )
  } catch (err) {
    return apiError("F3044", "Failed to list manual accounts", 500, err)
  }
}

/**
 * DELETE /api/finance/accounts/manual?accountId=X — delete a manual account
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F3045", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get("accountId")
  if (!accountId) return apiError("F3046", "accountId required", 400)

  try {
    const account = await db.financeAccount.findFirst({
      where: { id: accountId, userId: user.id },
      include: { institution: { select: { id: true, provider: true } } },
    })
    if (!account) return apiError("F3047", "Account not found", 404)
    if (account.institution.provider !== "manual") {
      return apiError("F3048", "Only manual accounts can be deleted here", 400)
    }

    // Delete account + clean up institution in a transaction
    await db.$transaction(async (tx) => {
      await tx.financeAccount.delete({ where: { id: accountId } })

      const remaining = await tx.financeAccount.count({
        where: { institutionId: account.institution.id },
      })
      if (remaining === 0) {
        await tx.financeInstitution.delete({ where: { id: account.institution.id } })
      }
    })

    // Wipe snapshots so they rebuild without deleted data
    await db.financeSnapshot.deleteMany({ where: { userId: user.id } })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    return apiError("F3049", "Failed to delete manual account", 500, err)
  }
}
